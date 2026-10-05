/**
 * Recompute every report card's stored overallAverage with the shared grade
 * parser (audit D02). The old code stripped non-digits, so "A-" counted as 0
 * and "18/20" as 1820 - stored averages may be impossible values.
 *
 *   node scripts/repair-report-averages.mjs            report only (default)
 *   node scripts/repair-report-averages.mjs --apply    write the corrections
 *
 * Runs against whatever DATABASE_URL points at. Review the report first; never
 * run --apply against production without the owner's say-so. Cards whose
 * grades are all unreadable get null (no average), not 0. Deleted cards are
 * left alone.
 */

import { PrismaClient } from '../node_modules/.prisma/client-custom-v8/index.js';
import { averageGrades } from '../lib/grades.ts';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

try {
  const cards = await prisma.reportCard.findMany({
    where: { deletedAt: null },
    select: { id: true, term: true, overallAverage: true, grades: { where: { deletedAt: null }, select: { grade: true } } },
  });

  const changes = cards
    .map((card) => ({ card, next: averageGrades(card.grades.map((g) => g.grade)) }))
    .filter(({ card, next }) => card.overallAverage !== next);

  console.log(`${cards.length} report cards; ${changes.length} stored averages differ from the shared parser.`);
  for (const { card, next } of changes) {
    console.log(`  ${card.id}  ${card.term.padEnd(12)} ${String(card.overallAverage).padStart(8)} -> ${next}`);
  }

  if (APPLY && changes.length > 0) {
    // Explicit updatedAt so the sync engine sees a real change and the rows travel.
    await prisma.$transaction(
      changes.map(({ card, next }) =>
        prisma.reportCard.update({ where: { id: card.id }, data: { overallAverage: next, updatedAt: new Date() } })
      )
    );
    console.log('Applied.');
  } else if (changes.length > 0) {
    console.log('Report only. Re-run with --apply to write these.');
  }
} finally {
  await prisma.$disconnect();
}
