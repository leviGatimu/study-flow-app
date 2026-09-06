/**
 * Seed the XP ledger from the totals users already have.
 *
 * UserProgress.xp/.level become a cache recomputed from XpEvent, so without
 * this every existing user would drop to level 1 with 0 XP the first time
 * anything recomputed them. One LEGACY row per user carries their existing
 * lifetime total forward.
 *
 *   npx tsx prisma/backfill-xp.ts --dry     preview
 *   npx tsx prisma/backfill-xp.ts           apply
 *
 * Idempotent: the row is keyed "legacy:import", which is unique per user, so
 * re-running skips anyone who already has it.
 */

import { PrismaClient } from '../node_modules/.prisma/client-custom-v8';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

/** Reaching level L costs 1000 * (1 + 2 + ... + (L-1)); xp is the remainder. */
function lifetimeXpFor(level: number, xp: number): number {
  return (1000 * ((level - 1) * level)) / 2 + xp;
}

async function main() {
  const users = await prisma.userProgress.findMany({
    select: { userId: true, xp: true, level: true, name: true },
  });

  console.log(`${users.length} progress rows found${DRY ? ' (dry run)' : ''}\n`);

  let seeded = 0;
  let skipped = 0;

  for (const u of users) {
    const lifetime = lifetimeXpFor(u.level, u.xp);

    const existing = await prisma.xpEvent.findUnique({
      where: { userId_sourceKey: { userId: u.userId, sourceKey: 'legacy:import' } },
      select: { id: true, amount: true },
    });

    if (existing) {
      console.log(
        `  skip  ${(u.name ?? u.userId).padEnd(18)} already has a legacy row (${existing.amount} XP)`
      );
      skipped++;
      continue;
    }

    console.log(
      `  seed  ${(u.name ?? u.userId).padEnd(18)} level ${String(u.level).padStart(3)} + ${String(u.xp).padStart(5)} xp  ->  ${lifetime} lifetime`
    );

    if (lifetime <= 0) {
      // Nothing to carry forward; a zero-amount row would just be noise.
      skipped++;
      continue;
    }

    if (!DRY) {
      await prisma.xpEvent.create({
        data: {
          userId: u.userId,
          amount: lifetime,
          source: 'LEGACY',
          sourceKey: 'legacy:import',
        },
      });
    }
    seeded++;
  }

  console.log(`\n${DRY ? 'would seed' : 'seeded'} ${seeded}, skipped ${skipped}`);

  if (!DRY) {
    // Prove the round trip: recomputing from the ledger must reproduce exactly
    // the level and remainder each user already had.
    let mismatches = 0;
    for (const u of users) {
      const { _sum } = await prisma.xpEvent.aggregate({
        where: { userId: u.userId, deletedAt: null },
        _sum: { amount: true },
      });
      const total = _sum.amount ?? 0;

      let level = 1;
      let remaining = total;
      while (remaining >= level * 1000) {
        remaining -= level * 1000;
        level++;
      }

      if (level !== u.level || remaining !== u.xp) {
        console.log(
          `  MISMATCH ${u.name ?? u.userId}: was level ${u.level}/${u.xp}, ledger gives ${level}/${remaining}`
        );
        mismatches++;
      }
    }
    console.log(
      mismatches === 0
        ? 'verified: every user round-trips to the same level and xp'
        : `WARNING: ${mismatches} users do not round-trip`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
