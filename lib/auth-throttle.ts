/**
 * Slows down password guessing on the two sign-in doors: the login form and
 * the desktop pairing endpoint (POST /api/sync/session).
 *
 * Two counters per attempt: one for the username and one for the caller's
 * network address. Five failures for one username, or thirty from one address,
 * inside fifteen minutes lock that key for fifteen minutes. A correct password
 * clears the username's counter (not the address's, which may be guessing at
 * other accounts too).
 *
 * The trade-off is the usual one: someone who knows a username can lock its
 * owner out for fifteen minutes by failing on purpose. That is far cheaper
 * than an unlimited guessing window, and the message says when to try again.
 *
 * The counters live in the AuthThrottle table, so they hold across serverless
 * instances. Takes the Prisma client as an argument and has no `@/` imports,
 * so test/auth-throttle.test.mjs can run it against a real SQLite database.
 */

export const THROTTLE = {
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
  maxPerUser: 5,
  maxPerAddress: 30,
} as const;

type ThrottleRow = { key: string; failures: number; windowStart: Date; lockedUntil: Date | null };

type ThrottleDb = {
  authThrottle: {
    findMany(args: { where: { key: { in: string[] } } }): Promise<ThrottleRow[]>;
    findUnique(args: { where: { key: string } }): Promise<ThrottleRow | null>;
    upsert(args: {
      where: { key: string };
      create: { key: string; failures: number; windowStart: Date; lockedUntil: Date | null };
      update: { failures: number; windowStart: Date; lockedUntil: Date | null };
    }): Promise<unknown>;
    deleteMany(args: { where: { key: string } }): Promise<unknown>;
  };
};

export const userKey = (username: string) => `user:${username.trim().toLowerCase()}`;
export const addressKey = (address: string) => `ip:${address}`;

/** The keys an attempt counts against. No address (desktop, tests) means the username only. */
export function throttleKeys(username: string, address: string | null): string[] {
  return address ? [userKey(username), addressKey(address)] : [userKey(username)];
}

/**
 * The caller's address from proxy headers. On Vercel x-forwarded-for is set by
 * the platform, first entry being the client. Null when there is none.
 */
export function clientAddress(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}

/** Seconds until every given key is unlocked, or 0 when none is locked. */
export async function lockedFor(db: ThrottleDb, keys: string[], now = new Date()): Promise<number> {
  const rows = await db.authThrottle.findMany({ where: { key: { in: keys } } });
  const until = Math.max(0, ...rows.map((r) => (r.lockedUntil ? r.lockedUntil.getTime() : 0)));
  return until > now.getTime() ? Math.ceil((until - now.getTime()) / 1000) : 0;
}

/** Count one failed attempt against every key, locking any that reach their limit. */
export async function recordFailure(db: ThrottleDb, keys: string[], now = new Date()): Promise<void> {
  for (const key of keys) {
    const max = key.startsWith('ip:') ? THROTTLE.maxPerAddress : THROTTLE.maxPerUser;
    const row = await db.authThrottle.findUnique({ where: { key } });
    const fresh = !row || now.getTime() - row.windowStart.getTime() >= THROTTLE.windowMs;
    const failures = fresh ? 1 : row.failures + 1;
    const windowStart = fresh ? now : row.windowStart;
    const lockedUntil = failures >= max ? new Date(now.getTime() + THROTTLE.lockMs) : fresh ? null : row.lockedUntil;
    await db.authThrottle.upsert({
      where: { key },
      create: { key, failures, windowStart, lockedUntil },
      update: { failures, windowStart, lockedUntil },
    });
  }
}

/** A correct password: forget this username's failures. */
export async function clearFailures(db: ThrottleDb, username: string): Promise<void> {
  await db.authThrottle.deleteMany({ where: { key: userKey(username) } });
}

/** What a locked-out caller is told: plain, with when to try again. */
export function lockedMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many sign-in attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}

/**
 * A real bcrypt hash (cost 10) of a random throwaway password. Comparing
 * against it when the username does not exist makes an unknown username take
 * as long as a wrong password (~55 ms), so response time no longer says which
 * usernames exist. It must be a well-formed hash: bcryptjs answers a malformed
 * one instantly, which is exactly the leak this is here to close.
 */
export const DUMMY_HASH = '$2b$10$T9eMWJEb23YF2MCG/hSOB.7lYHRRHxRJTS7DjjY7qLp2/J3yeYp7K';
