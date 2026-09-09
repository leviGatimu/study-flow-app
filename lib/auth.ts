import { cache } from 'react';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Add a strong random value to your .env file.'
  );
}

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function login(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(SECRET);

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
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(session, SECRET);
    userId = payload.userId as string;
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
      select: { id: true },
    });

    // A definite answer: the account is gone or deactivated. Reject it.
    if (!user) return null;
    return userId;
  } catch (error) {
    // No answer at all. The token itself is cryptographically valid, so the
    // session is honoured for this request and the incident is logged. Nothing
    // is leaked by doing so: if the database cannot be reached, the queries
    // behind every page will fail too, and the user sees an error rather than
    // someone else's data. Logging them out instead would be a lie about the
    // one thing we actually know.
    console.error('[auth] could not verify the session user; honouring the token:', error);
    return userId;
  }
});
