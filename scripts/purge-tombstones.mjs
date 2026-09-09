/**
 * Sweep tombstones nobody needs any more, on the web database.
 *
 * A soft delete never frees a byte: lib/soft-delete.ts flags the row so the
 * deletion has something to travel with, and it then sits there forever. Once
 * every device has had a fair chance to hear about it - TOMBSTONE_RETENTION_DAYS,
 * 90 - the row is dead weight and can go for real.
 *
 *   node scripts/purge-tombstones.mjs --dry-run   count what would go
 *   node scripts/purge-tombstones.mjs             remove it
 *   node scripts/purge-tombstones.mjs --days 30   use a shorter retention
 *
 * The desktop app does this itself on launch (see instrumentation.ts) - it opens
 * often and owns its database alone. The web build cannot: that hook runs once
 * per serverless instance, so Vercel would sweep the shared database from a
 * dozen places at once for no benefit. Hence a script you run deliberately,
 * from a cron job or by hand.
 *
 * SAFE TO RE-RUN. It only ever touches rows whose deletedAt is already past the
 * cutoff, so a second run in the same minute removes nothing.
 *
 * WARNING: this is the real DELETE. A row purged here is gone, and a device
 * that has not synced since before the cutoff will never learn it was deleted -
 * it will push its own copy back. That is the trade every replicated system
 * makes; do not shorten --days below the longest a device might stay offline.
 */

import { PrismaClient, Prisma } from '../node_modules/.prisma/client-custom-v8/index.js';
import { purgeTombstones, TOMBSTONE_RETENTION_DAYS } from '../lib/soft-delete.ts';

const DRY = process.argv.includes('--dry-run') || process.argv.includes('--dry');

const daysFlag = process.argv.indexOf('--days');
const days =
  daysFlag === -1 ? TOMBSTONE_RETENTION_DAYS : Number(process.argv[daysFlag + 1]);

if (!Number.isFinite(days) || days < 0) {
  console.error(`--days needs a non-negative number, got "${process.argv[daysFlag + 1]}"`);
  process.exit(1);
}

const prisma = new PrismaClient();

// The raw client, deliberately - purging has to SEE tombstones, and the
// extension in lib/prisma.ts exists to hide them. Model names come off the
// client's own metadata so a new model is swept the day it is added.
const models = Prisma.dmmf.datamodel.models.map(
  (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)
);

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
console.log(`${DRY ? 'Would purge' : 'Purging'} tombstones deleted before ${cutoff.toISOString()}`);

try {
  let removed;
  if (DRY) {
    removed = {};
    for (const model of models) {
      const count = await prisma[model].count({ where: { deletedAt: { lt: cutoff } } });
      if (count > 0) removed[model] = count;
    }
  } else {
    removed = await purgeTombstones(prisma, models, days);
  }

  const entries = Object.entries(removed).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    console.log('Nothing to purge.');
  } else {
    for (const [model, count] of entries) console.log(`  ${model.padEnd(20)} ${count}`);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    console.log(`${DRY ? 'Would remove' : 'Removed'} ${total} rows.`);
  }
} finally {
  await prisma.$disconnect();
}
