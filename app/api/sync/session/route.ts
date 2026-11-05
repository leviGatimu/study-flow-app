/**
 * How a desktop install proves who it is.
 *
 * The desktop runs its own copy of the app against its own local database, so
 * its login is local and works on a plane. But to SYNC it has to prove to the
 * web app that it is the same person, and it cannot use a browser cookie
 * because there is no browser in the loop.
 *
 * So: sign in once, here, with the same credentials as the website, and get a
 * bearer token the device stores. Stage 4's rule in one line - the FIRST login
 * must be online, everything after it is local.
 *
 *   POST /api/sync/session   { username, password }  ->  { token, userId, username }
 *
 * Deliberately the same JWT the browser session cookie carries, verified by the
 * same secret. A second token format would be a second thing to get wrong, and
 * the interesting security property here is not the envelope - it is that the
 * token grants exactly one user's data and the sync route scopes every query to
 * whoever it names.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { prisma, IS_SQLITE } from '@/lib/prisma';
import { signSessionToken } from '@/lib/auth';
import {
  DUMMY_HASH,
  clearFailures,
  clientAddress,
  lockedFor,
  lockedMessage,
  recordFailure,
  throttleKeys,
} from '@/lib/auth-throttle';

export const dynamic = 'force-dynamic';

/**
 * Long, because the whole point is a device that keeps working offline.
 *
 * A device that has to re-authenticate is a device that stops syncing at the
 * worst moment - after a trip, with the most to send. The exposure is the same
 * as the browser session it mirrors.
 */
const TOKEN_LIFETIME = '365d';

export async function POST(request: NextRequest) {
  if (IS_SQLITE) {
    return NextResponse.json({ error: 'This build is a sync client, not a server' }, { status: 400 });
  }
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server is not configured for sync' }, { status: 500 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  // Same throttle as the login form: this is the other door to the account.
  const keys = throttleKeys(username, clientAddress(request.headers));
  const wait = await lockedFor(prisma, keys);
  if (wait > 0) {
    return NextResponse.json(
      { error: lockedMessage(wait) },
      { status: 429, headers: { 'Retry-After': String(wait) } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, passwordHash: true },
  });

  // One message for both "no such user" and "wrong password", and the hash is
  // compared even when there is no user, so the response time does not say
  // which usernames exist. The dummy must be a well-formed hash: bcryptjs
  // answers a malformed one instantly, which is what the old one here did.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordFailure(prisma, keys);
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  await clearFailures(prisma, username);
  // Carries the session version, so a password change or "log out everywhere"
  // on the website also stops this device syncing until it signs in again.
  const token = await signSessionToken(user.id, TOKEN_LIFETIME);

  return NextResponse.json({ token, userId: user.id, username: user.username });
}
