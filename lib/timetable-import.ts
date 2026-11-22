import { softDelete, type Db } from './soft-delete.ts';
import { canonicalSubject } from './subject-match.ts';
import {
  lessonKey,
  planReplace,
  routineKey,
  subjectsOf,
  type SharedBlock,
  type SharedLesson,
  type TimetableData,
} from './timetable-share.ts';

/**
 * Write an already-checked timetable file into one year, in one transaction.
 *
 * Takes the Prisma client as an argument and has no `@/` imports, so
 * test/timetable-import.test.mjs can run it on the SQLite harness. The server
 * action (lib/timetable-share-actions.ts) does the session and archive checks
 * and then calls this.
 *
 * Every read says `deletedAt: null` itself: the app's client adds that filter
 * automatically, the bare test client does not, and either way it is meant.
 */
export async function applyTimetableImport(
  db: Db,
  userId: string,
  stamp: { classId?: string },
  data: TimetableData
): Promise<{ lessons: number | null; blocks: number | null; newSubjects: string[] }> {
  return db.$transaction(async (tx: Db) => {
    // Subject names: an existing "physics" absorbs the file's "Physics".
    const yearSubjects: { name: string }[] = await tx.subject.findMany({
      where: { userId, deletedAt: null, ...stamp },
      select: { name: true },
    });
    const known = yearSubjects.map((s) => s.name);
    const canonical = (name: string) => canonicalSubject(name, known);
    const lessons: SharedLesson[] | null =
      data.schoolLessons?.map((l) => (l.isBreak ? l : { ...l, subject: canonical(l.subject) })) ?? null;
    const blocks: SharedBlock[] | null = data.studyRoutine?.map((b) => ({ ...b, subject: canonical(b.subject) })) ?? null;
    const knownLower = new Set(known.map((k) => k.toLowerCase()));
    const newSubjects = subjectsOf({ schoolLessons: lessons, studyRoutine: blocks }).filter((s) => !knownLower.has(s.toLowerCase()));

    await addSubjects(tx, userId, stamp, newSubjects);

    if (lessons) {
      const existing: { id: string; dayOfWeek: number; startTime: string }[] = await tx.schoolLesson.findMany({
        where: { userId, deletedAt: null, ...stamp },
        select: { id: true, dayOfWeek: true, startTime: true },
      });
      const plan = planReplace(existing, lessons, lessonKey, lessonKey);
      if (plan.remove.length) await softDelete(tx, 'schoolLesson', { userId, id: { in: plan.remove } });
      for (const { id, row } of plan.update) {
        await tx.schoolLesson.update({ where: { id }, data: { endTime: row.endTime, subject: row.subject, isBreak: row.isBreak } });
      }
      if (plan.create.length) {
        await tx.schoolLesson.createMany({ data: plan.create.map((l) => ({ ...l, userId, ...stamp })) });
      }
    }

    if (blocks) {
      const existing: { id: string; dayOfWeek: number; subject: string; startTime: string }[] = await tx.scheduleTemplate.findMany({
        where: { userId, deletedAt: null, ...stamp },
        select: { id: true, dayOfWeek: true, subject: true, startTime: true },
      });
      const plan = planReplace(existing, blocks, routineKey, routineKey);
      if (plan.remove.length) {
        // As deleteTemplate (lib/actions.ts): finished work is detached and
        // kept as history; only the undone blocks of a removed routine block
        // go with it, through the soft-delete cascade.
        await tx.task.updateMany({
          where: {
            userId,
            templateId: { in: plan.remove },
            OR: [{ isDone: true }, { proofPdfUrl: { not: null } }, { workDescription: { not: null } }],
          },
          data: { templateId: null },
        });
        await softDelete(tx, 'scheduleTemplate', { userId, id: { in: plan.remove } });
      }
      for (const { id, row } of plan.update) {
        // The subject is part of the match, but its spelling may differ in case.
        await tx.scheduleTemplate.update({
          where: { id },
          data: { subject: row.subject, endTime: row.endTime, deadlineDay: row.deadlineDay, type: row.type },
        });
      }
      if (plan.create.length) {
        await tx.scheduleTemplate.createMany({ data: plan.create.map((b) => ({ ...b, userId, ...stamp })) });
      }
    }

    return { lessons: lessons?.length ?? null, blocks: blocks?.length ?? null, newSubjects };
  });
}

/**
 * Create the subjects a timetable needs, the way addSubject does: Subject is
 * unique on (userId, name) across every year, so a same-name row from another
 * year (or one deleted earlier) is brought into this year rather than
 * duplicated, which the constraint would refuse anyway.
 */
async function addSubjects(tx: Db, userId: string, stamp: { classId?: string }, names: string[]) {
  if (names.length === 0) return;
  // Mentioning deletedAt opts out of the app client's soft-delete read filter.
  const all: { id: string; name: string }[] = await tx.subject.findMany({
    where: { userId, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] },
    select: { id: true, name: true },
  });
  for (const name of names) {
    const match = all.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (match) {
      await tx.subject.update({ where: { id: match.id }, data: { name, deletedAt: null, ...stamp } });
    } else {
      await tx.subject.create({ data: { userId, name, ...stamp } });
    }
  }
}
