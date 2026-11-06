'use server';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const AT_MOST_EVERY_MS = 5 * 60_000;

/**
 * Note that this person is using the app, for the admin page.
 *
 * Only writes when the last note is old, in the query itself, so several open
 * tabs cannot pile up writes, and a desktop does not sync on every check-in.
 */
export async function recordPresence(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const now = new Date();
  await prisma.userProgress.updateMany({
    where: {
      userId,
      OR: [{ lastActiveDate: null }, { lastActiveDate: { lt: new Date(now.getTime() - AT_MOST_EVERY_MS) } }],
    },
    data: { lastActiveDate: now },
  });
}
