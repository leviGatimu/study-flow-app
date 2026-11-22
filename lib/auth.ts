import { cache } from 'react';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { prisma } from './prisma';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Add a strong random value to your .env file.'
  );
}

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Sessions are stateless JWTs, so they cannot be deleted - instead each one
 * carries the account's sessionVersion (`sv`) and stops being accepted once
 * that moves on. Tokens issued before this existed have no `sv` and count as
 * version 0, so they keep working until the first bump.
 */
const versionOf = (payload: JWTPayload) => (typeof payload.sv === "number" ? payload.sv : 0);

/**
 * Invalidate every session and desktop sync token of an account. Used by a
 * password change, an admin password reset and "Log out everywhere".
 */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

/** Sign a session or sync token for the account's current session version. */
export async function signSessionToken(userId: string, expiresIn: string, extra: { mentorId?: string } = {}): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return new SignJWT({ userId, sv: user?.sessionVersion ?? 0, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

/**
 * Sign in. With `mentorId`, the session opens THIS student's account read-only
 * for that mentor: the token names the student (so every page reads their data
 * unchanged), carries the student's session version (so "Log out everywhere"
 * signs the mentor out too), and carries the mentor's id, which getUserId
 * re-checks on every request so turning access off takes effect at once.
 */
export async function login(userId: string, mentorId?: string) {
  const token = await signSessionToken(userId, '30d', mentorId ? { mentorId } : {});

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

/**
 * Memoised for the duration of one request.
 *
 * This verifies the session AND checks the user still exists in the database,
 * and it is called by the layout, by the page, and by every server action a
 * page fans out to - so a single dashboard render was paying for the same
 * lookup a dozen times over. At ~165ms per round trip that is seconds.
 *
 * React's cache() is per-request, so a revoked user is still rejected on the
 * very next navigation.
 */
export const getUserId = cache(async function getUserId(): Promise<string | null> {
  return (await readSession())?.userId ?? null;
});

export type MentorSession = { mentorId: string; username: string };

/** The mentor looking at this account, or null for the student themselves (and signed out). */
export const getMentorSession = cache(async function getMentorSession(): Promise<MentorSession | null> {
  return (await readSession())?.mentor ?? null;
});

const MENTOR_SEEN_EVERY_MS = 5 * 60_000;

const readSession = cache(async function readSession(): Promise<{ userId: string; mentor: MentorSession | null } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  let userId: string;
  let version: number;
  let mentorId: string | null = null;
  try {
    const { payload } = await jwtVerify(session, SECRET, { algorithms: ['HS256'] });
    userId = payload.userId as string;
    version = versionOf(payload);
    mentorId = typeof payload.mentorId === 'string' ? payload.mentorId : null;
    if (!userId) return null;
  } catch {
    // The token is missing, expired, tampered with or signed by another
    // deployment. That is a definite "not signed in".
    return null;
  }

  // Verify the user still exists. THE TWO WAYS THIS CAN FAIL ARE NOT THE SAME
  // THING, and treating them alike is what made signed-in users bounce to the
  // welcome screen at random.
  //
  // The whole function used to sit inside one try/catch returning null, so a
  // database that was merely slow or briefly unreachable - Kigali to Frankfurt,
  // through a pooler capped at five connections, on pages that fire seven
  // queries each - read as "this person is not logged in". Every page calls
  // this and redirects on null, so one failed lookup logged the user out of the
  // whole app.
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, sessionVersion: true },
    });

    // A definite answer: the account is gone or deactivated, or this session
    // was logged out (password changed, "log out everywhere"). Reject it.
    if (!user || user.sessionVersion !== version) return null;
    if (!mentorId) return { userId, mentor: null };

    // A mentor's access must still be on, and still be for THIS student.
    const access = await prisma.mentorAccess.findUnique({
      where: { id: mentorId },
      select: { studentId: true, username: true, revokedAt: true, lastSeenAt: true },
    });
    if (!access || access.revokedAt || access.studentId !== userId) return null;
    if (!access.lastSeenAt || Date.now() - access.lastSeenAt.getTime() > MENTOR_SEEN_EVERY_MS) {
      // Best effort, and never inside a mentor's own action (the read-only guard would refuse it).
      void prisma.mentorAccess
        .update({ where: { id: mentorId }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    return { userId, mentor: { mentorId, username: access.username } };
  } catch (error) {
    // No answer at all. The token itself is cryptographically valid, so the
    // session is honoured for this request and the incident is logged. Nothing
    // is leaked by doing so: if the database cannot be reached, the queries
    // behind every page will fail too, and the user sees an error rather than
    // someone else's data. Logging them out instead would be a lie about the
    // one thing we actually know.
    console.error('[auth] could not verify the session user; honouring the token:', error);
    // Unverifiable mentor access is NOT honoured: unlike the student's own
    // session, a mentor's can be revoked, and "the database was slow" must not
    // stretch a revoked mentor's view.
    return mentorId ? null : { userId, mentor: null };
  }
});

/**
 * The same session, presented as a bearer token instead of a cookie.
 *
 * A desktop install syncing to the web app has no browser and therefore no
 * cookie jar, so /api/sync accepts `Authorization: Bearer <token>` - the very
 * token /api/sync/session issues, verified by the same secret, meaning the same
 * thing. Returns null for anything it cannot verify; the caller decides whether
 * to fall back to the cookie.
 *
 * Checks the account still exists and the token's session version is current,
 * like getUserId. Routes call this FIRST and only fall back to the cookie when
 * it returns null, so a valid-looking bearer is never checked anywhere else.
 */
export async function userIdFromBearer(header: string | null): Promise<string | null> {
  if (!header?.startsWith('Bearer ')) return null;
  let userId: string;
  let version: number;
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), SECRET, { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'string' || !payload.userId) return null;
    // A mentor's browser token must never become a device token: /api/sync writes.
    if (payload.mentorId !== undefined) return null;
    userId = payload.userId;
    version = versionOf(payload);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return user && user.sessionVersion === version ? userId : null;
}
