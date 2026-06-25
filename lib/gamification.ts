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

export async function addXp(userId: string, amount: number) {
  const progress = await prisma.userProgress.findUnique({
    where: { userId }
  });

  if (!progress) return;

  let newXp = progress.xp + amount;
  let newLevel = progress.level;

  while (newXp >= getXpForNextLevel(newLevel)) {
    newXp -= getXpForNextLevel(newLevel);
    newLevel++;
  }

  await prisma.userProgress.update({
    where: { userId },
    data: {
      xp: newXp,
      level: newLevel
    }
  });

  return { xpGained: amount, newLevel, leavedUp: newLevel > progress.level, xp: newXp };
}
