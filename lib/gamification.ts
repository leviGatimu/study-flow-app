import { prisma } from './prisma';

export const RANKS = [
  { minLevel: 1, maxLevel: 10, name: "Bronze Tier", color: "text-orange-400" },
  { minLevel: 11, maxLevel: 30, name: "Silver Tier", color: "text-slate-300" },
  { minLevel: 31, maxLevel: 60, name: "Gold Tier", color: "text-amber-400" },
  { minLevel: 61, maxLevel: 100, name: "Platinum Tier", color: "text-cyan-400" },
  { minLevel: 101, maxLevel: 999, name: "Diamond Elite", color: "text-indigo-400" },
];

export function getRankInfo(level: number) {
  return RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || RANKS[0];
}

export function getXpForNextLevel(level: number) {
  return level * 1000;
}

/**
 * UserProgress.xp is the REMAINDER inside the current level, not a lifetime
 * total, so the two representations have to convert both ways: the ledger
 * stores lifetime grants, the UI reads the remainder.
 *
 * Reaching level L costs 1000 * (1 + 2 + ... + (L-1)).
 */
export function lifetimeXpFor(level: number, xp: number): number {
  return 1000 * ((level - 1) * level) / 2 + xp;
}

/** The inverse: lifetime total -> the level and remainder the app displays. */
export function levelFromLifetimeXp(total: number): { level: number; xp: number } {
  let level = 1;
  let remaining = Math.max(0, total);
  while (remaining >= getXpForNextLevel(level)) {
    remaining -= getXpForNextLevel(level);
    level++;
  }
  return { level, xp: remaining };
}

export type XpSource = 'TASK' | 'HOMEWORK' | 'STREAK' | 'FOCUS' | 'QUIZ' | 'AI' | 'LEGACY';

/**
 * Record an XP grant, at most once.
 *
 * `sourceKey` is the identity of the thing being rewarded - "task:<id>",
 * "streak:<classId>:<date>" - and is unique per user. Calling this twice for
 * the same key is a no-op, which is what fixes the old double-grant:
 * toggleTaskDone paid +100 every time it ran, so unticking and reticking a
 * task paid twice.
 *
 * Returns null when the grant was already recorded, so callers can tell the
 * difference between "earned" and "already had it".
 */
export async function grantXp(
  userId: string,
  amount: number,
  source: XpSource,
  sourceKey: string
) {
  if (!Number.isFinite(amount) || amount === 0) return null;

  try {
    await prisma.xpEvent.create({
      data: { userId, amount: Math.round(amount), source, sourceKey },
    });
  } catch (err: unknown) {
    // P2002 - this grant already exists. That is the point of the key.
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
      return null;
    }
    throw err;
  }

  const totals = await recomputeXp(userId);
  // `granted` saves callers repeating the amount they just passed in - the UI
  // needs it for the "+20 XP" bubble.
  return { ...totals, granted: Math.round(amount) };
}

/**
 * Rebuild UserProgress.xp/.level from the ledger.
 *
 * Those columns are a cache: every page reads them, so they stay, but the
 * ledger is the source of truth. After a sync merges two devices' XpEvent rows
 * this is what makes the total correct - a SUM over the union, rather than one
 * device's total winning and the other's being lost.
 */
export async function recomputeXp(userId: string) {
  const [{ _sum }, progress] = await Promise.all([
    prisma.xpEvent.aggregate({
      where: { userId, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.userProgress.findUnique({ where: { userId }, select: { level: true } }),
  ]);

  const lifetime = _sum.amount ?? 0;
  const { level, xp } = levelFromLifetimeXp(lifetime);

  await prisma.userProgress.updateMany({
    where: { userId },
    data: { xp, level },
  });

  return {
    xp,
    level,
    lifetime,
    leveledUp: progress ? level > progress.level : false,
  };
}

/**
 * @deprecated Use grantXp(), which cannot double-pay. This remains only so an
 * un-migrated caller still works; it mints a one-off key, so the grant is
 * recorded but nothing stops the same action paying twice.
 */
export async function addXp(userId: string, amount: number) {
  const result = await grantXp(
    userId,
    amount,
    'LEGACY',
    `legacy:${Date.now()}:${Math.random().toString(36).slice(2)}`
  );
  if (!result) return;
  return {
    xpGained: amount,
    newLevel: result.level,
    leavedUp: result.leveledUp,
    xp: result.xp,
  };
}
