/**
 * Backfill Class scope onto the four models that never had a scope column.
 *
 * 17 models already carried classId or termId. These four carried nothing, so
 * 20260908000000_scope_remaining_models_to_class added a NULLABLE classId to
 * each and this script fills it in. Nullable-then-backfill is deliberate: the
 * migration can be applied to production before this has run without breaking a
 * single query.
 *
 *   node scripts/backfill-class-scope.mjs --dry-run   preview the counts
 *   node scripts/backfill-class-scope.mjs             apply
 *
 * IDEMPOTENT. Every read is filtered to `classId: null` and every write repeats
 * that filter, so re-running is a no-op and a row an admin has since corrected
 * by hand is never overwritten.
 *
 * HOW A ROW'S CLASS IS DERIVED, in order of preference:
 *
 *   SubjectGrade  reportCard.termRef.classId - the authoritative answer, since
 *                 a report card already belongs to a term and a term to a class.
 *                 Falls back to the date rule (on the report card's owner) only
 *                 if the report card is itself unscoped.
 *   QuizAttempt   module.classId - inherited from the TutorModule it belongs to.
 *   ChatSession   the date rule. ChatMessage needs NO column of its own: it
 *                 hangs off ChatSession and is scoped through it.
 *   StickyNote    the date rule.
 *
 * THE DATE RULE: the user's class whose [startedAt, completedAt ?? infinity)
 * window contains the row's createdAt. A row older than the user's earliest
 * class goes to that earliest class - which is the common case here, not an
 * edge case: the Class rows were created in August 2026 by Phase 2's backfill
 * while the data they describe goes back to May, so most rows legitimately
 * belong to the user's FIRST class.
 */

import { PrismaClient } from '../node_modules/.prisma/client-custom-v8/index.js';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run') || process.argv.includes('--dry');

/** Rows per updateMany. Keeps the round trips down without a giant IN list. */
const CHUNK = 200;

/**
 * Pick the class a date falls in.
 *
 * `classes` must be the user's classes sorted by startedAt ascending.
 * Windows are half-open, [startedAt, completedAt), so a class completed at the
 * instant the next one started does not claim that instant twice. Two fallbacks
 * cover what the windows do not: a date before the user ever had a class (goes
 * to the first one), and a date in a gap between two classes (goes to the one
 * that was most recently started, i.e. the year the user was in at the time).
 */
function classForDate(classes, date) {
  const t = date.getTime();

  let inWindow = null;
  for (const c of classes) {
    const from = c.startedAt.getTime();
    const to = c.completedAt ? c.completedAt.getTime() : Infinity;
    // Later-starting classes win an overlap: the newest year the row could
    // belong to is the one the user was actually in.
    if (t >= from && t < to) inWindow = c;
  }
  if (inWindow) return { cls: inWindow, how: 'window' };

  let started = null;
  for (const c of classes) if (c.startedAt.getTime() <= t) started = c;
  if (started) return { cls: started, how: 'gap-after-completed' };

  return { cls: classes[0], how: 'before-first-class' };
}

/** Group rows into { [classId]: string[] } of row ids, counting the unresolved. */
function plan(rows) {
  const byClass = new Map();
  const unresolved = [];

  for (const row of rows) {
    if (!row.classId) {
      unresolved.push(row);
      continue;
    }
    const ids = byClass.get(row.classId) ?? [];
    ids.push(row.id);
    byClass.set(row.classId, ids);
  }
  return { byClass, unresolved };
}

async function apply(delegate, byClass) {
  let written = 0;
  for (const [classId, ids] of byClass) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const res = await delegate.updateMany({
        // `classId: null` is repeated here on purpose: it makes the write itself
        // idempotent, not just the read that produced this list.
        where: { id: { in: slice }, classId: null },
        data: { classId },
      });
      written += res.count;
    }
  }
  return written;
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const allClasses = await prisma.class.findMany({
    select: { id: true, userId: true, label: true, startedAt: true, completedAt: true },
    orderBy: { startedAt: 'asc' },
  });

  /** userId -> classes, oldest first. */
  const classesByUser = new Map();
  for (const c of allClasses) {
    const list = classesByUser.get(c.userId) ?? [];
    list.push(c);
    classesByUser.set(c.userId, list);
  }

  const labelOf = new Map(allClasses.map((c) => [c.id, c.label]));
  const nameOf = new Map(users.map((u) => [u.id, u.username]));

  /** Resolve by date, or null if the user has no class to put the row in. */
  const byDate = (userId, createdAt, tally) => {
    const classes = classesByUser.get(userId);
    if (!classes || classes.length === 0) return null;
    const { cls, how } = classForDate(classes, createdAt);
    tally[how] = (tally[how] ?? 0) + 1;
    return cls.id;
  };

  const tally = {};

  // --- SubjectGrade: through ReportCard -> Term -> Class. -------------------
  const grades = await prisma.subjectGrade.findMany({
    where: { classId: null },
    select: {
      id: true,
      createdAt: true,
      reportCard: { select: { userId: true, termRef: { select: { classId: true } } } },
    },
  });
  const gradeRows = grades.map((g) => ({
    id: g.id,
    userId: g.reportCard.userId,
    classId:
      g.reportCard.termRef?.classId ?? byDate(g.reportCard.userId, g.createdAt, tally),
    via: g.reportCard.termRef?.classId ? 'reportCard.term' : 'date',
  }));

  // --- QuizAttempt: inherited from its TutorModule. -------------------------
  const attempts = await prisma.quizAttempt.findMany({
    where: { classId: null },
    select: {
      id: true,
      createdAt: true,
      module: { select: { userId: true, classId: true } },
    },
  });
  const attemptRows = attempts.map((a) => ({
    id: a.id,
    userId: a.module.userId,
    classId: a.module.classId ?? byDate(a.module.userId, a.createdAt, tally),
    via: a.module.classId ? 'module' : 'date',
  }));

  // --- ChatSession and StickyNote: the date rule. ---------------------------
  const sessions = await prisma.chatSession.findMany({
    where: { classId: null },
    select: { id: true, userId: true, createdAt: true },
  });
  const sessionRows = sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    classId: byDate(s.userId, s.createdAt, tally),
    via: 'date',
  }));

  const notes = await prisma.stickyNote.findMany({
    where: { classId: null },
    select: { id: true, userId: true, createdAt: true },
  });
  const noteRows = notes.map((n) => ({
    id: n.id,
    userId: n.userId,
    classId: byDate(n.userId, n.createdAt, tally),
    via: 'date',
  }));

  const models = [
    ['SubjectGrade', prisma.subjectGrade, gradeRows],
    ['QuizAttempt', prisma.quizAttempt, attemptRows],
    ['ChatSession', prisma.chatSession, sessionRows],
    ['StickyNote', prisma.stickyNote, noteRows],
  ];

  console.log(DRY ? '\nDRY RUN - nothing will be written.\n' : '\nApplying.\n');

  let totalPlanned = 0;
  let totalWritten = 0;
  let totalUnresolved = 0;

  for (const [name, delegate, rows] of models) {
    const { byClass, unresolved } = plan(rows);
    const planned = rows.length - unresolved.length;
    totalPlanned += planned;
    totalUnresolved += unresolved.length;

    console.log(`${name}: ${rows.length} row(s) with classId = NULL`);
    if (rows.length === 0) {
      console.log('  nothing to do');
    }
    for (const [classId, ids] of byClass) {
      const owner = nameOf.get(rows.find((r) => r.classId === classId)?.userId) ?? '?';
      console.log(`  -> ${owner} / ${labelOf.get(classId)} (${classId}): ${ids.length}`);
    }
    if (unresolved.length > 0) {
      const owners = [...new Set(unresolved.map((r) => nameOf.get(r.userId) ?? r.userId))];
      console.log(
        `  !! ${unresolved.length} row(s) left NULL - no Class exists for: ${owners.join(', ')}`
      );
    }

    if (!DRY) {
      const written = await apply(delegate, byClass);
      totalWritten += written;
      console.log(`  wrote ${written}`);
    }
    console.log('');
  }

  console.log('How each row was resolved by the date rule:', JSON.stringify(tally));
  console.log(
    DRY
      ? `\nWould set classId on ${totalPlanned} row(s); ${totalUnresolved} unresolvable.`
      : `\nSet classId on ${totalWritten} of ${totalPlanned} planned row(s); ${totalUnresolved} unresolvable.`
  );

  // Always verify, dry run included - it costs four counts and it is the only
  // statement here that speaks about the database rather than about the plan.
  const remaining = {
    SubjectGrade: await prisma.subjectGrade.count({ where: { classId: null } }),
    QuizAttempt: await prisma.quizAttempt.count({ where: { classId: null } }),
    ChatSession: await prisma.chatSession.count({ where: { classId: null } }),
    StickyNote: await prisma.stickyNote.count({ where: { classId: null } }),
  };
  console.log('Rows still NULL:', JSON.stringify(remaining));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
