/**
 * Phase 2 backfill: wrap every existing user's data in a Class + Term.
 *
 * This is deliberately separate from the migration. The migration adds nullable
 * columns; this script fills them. Keeping them apart means the schema change
 * and the data change can be reviewed, run and reverted independently.
 *
 * Guarantees:
 *   - Purely additive. It creates Class/Term rows and sets the new classId /
 *     termId columns. It never deletes, and never edits any pre-existing field.
 *   - Idempotent, and self-repairing: a user who already has a Class keeps it,
 *     and the link pass runs every time, so rows created while the schedule
 *     gate was not yet in place get adopted on the next run.
 *   - Reports what it did, per user, and verifies nothing was left unlinked.
 *
 * Run:  npm run backfill          (add --dry to preview without writing)
 */

import { PrismaClient } from "../node_modules/.prisma/client-custom-v8";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry");

/** Tables scoped to an academic year. */
const CLASS_SCOPED = [
  "scheduleTemplate", "subject", "subjectGoal", "resource", "masteryItem",
  "tutorModule", "studioNote", "aiNote", "project",
] as const;

/** Tables scoped to a term within that year. */
const TERM_SCOPED = [
  "task", "examEvent", "homework", "dailySummary", "weeklySummary",
  "markedDay", "reportCard",
] as const;

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      currentTerm: true,
      progress: {
        select: {
          currentStreak: true,
          longestStreak: true,
          lastActiveDate: true,
          schoolEndDate: true,
        },
      },
      classes: {
        where: { deletedAt: null },
        select: { id: true, status: true, terms: { where: { deletedAt: null }, select: { id: true, status: true } } },
      },
    },
  });

  console.log(`${users.length} user(s) found.${DRY_RUN ? "  [DRY RUN - no writes]" : ""}\n`);

  for (const user of users) {
    const progress = user.progress;
    const termName = user.currentTerm?.trim() || "Term 1";
    const existing = user.classes.find((c) => c.status === "ACTIVE") ?? user.classes[0];

    if (DRY_RUN) {
      const counts: string[] = [];
      for (const model of [...CLASS_SCOPED, ...TERM_SCOPED]) {
        const key = (CLASS_SCOPED as readonly string[]).includes(model) ? "classId" : "termId";
        const n = await (prisma as any)[model].count({ where: { userId: user.id, [key]: null } });
        if (n > 0) counts.push(`${model}=${n}`);
      }
      console.log(
        `- ${user.username}: ${existing ? "has a class" : `would create Class "Year 1" + Term "${termName}"`}` +
          `, would link ${counts.join(", ") || "nothing"}`
      );
      continue;
    }

    // One transaction per user: either that user is fully wrapped, or untouched.
    //
    // The generous timeout is not optional. This runs ~16 sequential statements
    // against a Postgres instance in fra1; from Kigali that is ~180ms per round
    // trip, so Prisma's 5s default expires part-way through and rolls the whole
    // user back (P2028). The rollback is correct behaviour - it is why no user
    // is ever left half-linked - but the job legitimately needs longer.
    const summary = await prisma.$transaction(async (tx) => {
      let classId = existing?.id ?? null;
      let termId = existing?.terms.find((t) => t.status === "ACTIVE")?.id ?? null;
      let created = false;

      if (!classId) {
        const cls = await tx.class.create({
          data: {
            userId: user.id,
            label: "Year 1",
            status: "ACTIVE",
            // Carry the streak across, and - critically - carry the old
            // schoolEndDate freeze across as a pause. Without this the new
            // Class-backed syncStreak sees a running schedule, compares today
            // against a months-old lastActiveDate, and resets a streak that was
            // legitimately frozen for a school break.
            currentStreak: progress?.currentStreak ?? 0,
            longestStreak: progress?.longestStreak ?? 0,
            lastActiveDate: progress?.lastActiveDate ?? null,
            pausedAt: progress?.schoolEndDate ?? null,
          },
        });
        classId = cls.id;
        created = true;

        const term = await tx.term.create({
          data: { classId: cls.id, userId: user.id, name: termName, index: 1, status: "ACTIVE" },
        });
        termId = term.id;
      }

      // Always run the link pass, not only for newly created classes, so rows
      // that appeared later with no scope get adopted rather than stranded.
      const linked: Record<string, number> = {};
      for (const model of CLASS_SCOPED) {
        const { count } = await (tx as any)[model].updateMany({
          where: { userId: user.id, classId: null },
          data: { classId },
        });
        if (count > 0) linked[model] = count;
      }
      if (termId) {
        for (const model of TERM_SCOPED) {
          const { count } = await (tx as any)[model].updateMany({
            where: { userId: user.id, termId: null },
            data: { termId },
          });
          if (count > 0) linked[model] = count;
        }
      }
      return { created, linked };
    }, { timeout: 120_000, maxWait: 30_000 });

    const detail = Object.entries(summary.linked).map(([k, v]) => `${k}=${v}`).join(", ");
    console.log(
      `- ${user.username}: ${summary.created ? 'created Class "Year 1"' : "class already present"}` +
        `, linked ${detail || "nothing"}`
    );
  }

  // Verify: after a real run nothing owned by a user should still be unscoped.
  if (!DRY_RUN) {
    const orphans: string[] = [];
    for (const model of CLASS_SCOPED) {
      const n = await (prisma as any)[model].count({ where: { classId: null } });
      if (n > 0) orphans.push(`${model}=${n}`);
    }
    for (const model of TERM_SCOPED) {
      const n = await (prisma as any)[model].count({ where: { termId: null } });
      if (n > 0) orphans.push(`${model}=${n}`);
    }
    console.log(
      orphans.length
        ? `\nWARNING: rows still unscoped: ${orphans.join(", ")}`
        : "\nVerified: every row is scoped to a class or term."
    );
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed, no partial user was committed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
