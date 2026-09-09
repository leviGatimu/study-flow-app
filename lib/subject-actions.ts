'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { normalizeSubject } from '@/lib/utils';
import {
  getViewScope,
  getActiveScope,
  byClass,
  byTerm,
  requireClassStamp,
  requireWritableScope,
  type ClassScope,
} from '@/lib/scope';

/**
 * Read-only list of the user's subjects: id and name, one indexed query, no
 * writes.
 *
 * Use this anywhere that just needs to render subject names - notably the app
 * layout, which feeds the quick-add form on every page.
 *
 * getSubjects() below is NOT a safe substitute there. Despite the name it
 * mutates: it runs two deleteMany calls and can re-seed the table, so calling
 * it from the layout meant every page view in the app issued deletes and four
 * or more round trips. Reserve it for pages that actually want the repair pass.
 */
export async function listSubjects(): Promise<{ id: string; name: string }[]> {
  const userId = await getUserId();
  if (!userId) return [];

  // Scoped to the year you are in: a new academic year starts with no
  // subjects, the same way it starts with no timetable.
  return prisma.subject.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Create subjects that do not exist yet, portably.
 *
 * `createMany({ skipDuplicates })` is NOT supported by SQLite, and the desktop
 * build runs on SQLite - so this filters against what is already there, then
 * falls back to per-row upserts if a concurrent seed wins the race and trips
 * the (userId, name) unique constraint.
 *
 * Only runs on the seeding path (an empty Subject table), so the extra read is
 * not on any hot path.
 */
async function createSubjectsIfMissing(userId: string, names: string[]) {
  const stamp = await requireClassStamp(userId);
  const wanted = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (wanted.length === 0) return;

  const existing = await prisma.subject.findMany({
    where: { userId, name: { in: wanted } },
    select: { name: true },
  });
  const have = new Set(existing.map((s) => s.name));
  const missing = wanted.filter((n) => !have.has(n));
  if (missing.length === 0) return;

  try {
    await prisma.subject.createMany({
      data: missing.map((name) => ({ userId, name, ...stamp })),
    });
  } catch {
    // Someone else seeded between the read and the write. Settle it row by row.
    for (const name of missing) {
      await prisma.subject.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name, ...stamp },
      });
    }
  }
}

/**
 * The two where-fragments a subject cascade needs.
 *
 * Renaming or deleting a subject touches nine tables, five of them scoped by
 * class and four by term, so the pair is resolved once and spread rather than
 * repeated eighteen times.
 */
function cascadeScopes(scope: ClassScope | null) {
  return { inClass: byClass(scope), inTerm: byTerm(scope) };
}

/**
 * Repair the subject list: remove "(revision)" pseudo-subjects and collapse
 * entries that are duplicates once normalised.
 *
 * This logic used to live inside getSubjects(), which meant every page that
 * merely LISTED subjects issued two deleteMany calls. A read that deletes is
 * hazardous on its own, and becomes much worse once devices sync, where a
 * delete-on-read propagates to every other device. It is now something the
 * user runs deliberately from /subjects.
 */
export async function repairSubjects() {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  // The repair pass only ever touches the year you are in.
  const scoped = byClass(await requireWritableScope(userId));

  // Four spellings rather than one case-insensitive match because `contains`
  // is case-SENSITIVE on Postgres. Behaviour is unchanged from when this ran
  // on every read.
  const removedRevision = await softDelete(prisma, 'subject', {
    userId,
    ...scoped,
    OR: [
      { name: { contains: '(revision)' } },
      { name: { contains: '(Revision)' } },
      { name: { contains: 'revision' } },
      { name: { contains: 'Revision' } }
    ]
  });

  const existingSubjects = await prisma.subject.findMany({ where: { userId, ...scoped } });
  const seenNames = new Set<string>();
  const duplicateIds: string[] = [];

  for (const s of existingSubjects) {
    const normalized = normalizeSubject(s.name);
    if (seenNames.has(normalized)) {
      duplicateIds.push(s.id);
    } else {
      seenNames.add(normalized);
    }
  }

  if (duplicateIds.length > 0) {
    await softDelete(prisma, 'subject', { id: { in: duplicateIds } });
  }

  revalidatePath('/subjects');
  return {
    success: true,
    removedRevision,
    removedDuplicates: duplicateIds.length,
  };
}

/**
 * Populate the Subject table the first time it is found empty, by scanning the
 * tables that carry a subject name, so an existing user does not land on an
 * empty subject list.
 *
 * Only ever writes when the table is empty, and only ever creates - it is a
 * bootstrap, not the repair pass above.
 */
async function seedSubjectsIfEmpty(userId: string) {
  // Everything here is scoped to the year you are in. Unscoped, a brand-new
  // academic year would look "empty" and immediately reseed itself from the
  // PREVIOUS year's templates, tasks and grades - which is exactly the
  // carry-over a fresh year is supposed to avoid. Scoped, a new year finds
  // nothing to seed from and correctly stays blank.
  const scope = await getActiveScope(userId);
  const scoped = byClass(scope);
  // Task and Homework are term-scoped, so they reach their year via the term.
  const scopedByTerm = byTerm(scope);

  // A NEW ACADEMIC YEAR MUST NEVER AUTO-SEED.
  //
  // This function exists for one situation: a legacy account whose Subject
  // table was never populated. It is not a repair pass for an empty year - an
  // empty year is the correct state of a year you have not set up yet.
  //
  // Scoping the count alone was not enough, and this bit for real: the
  // report-card branch below reads SubjectGrade through ReportCard, which has
  // no classId, so it stayed user-wide. The moment a new year's subject count
  // hit zero, the next page load refilled that year with 16 subjects from the
  // PREVIOUS year's report card - the exact carry-over the class scoping
  // removes, leaking through the one query that could not be scoped.
  //
  // So the guard is ownership, not emptiness: if this user has ANY subject in
  // ANY year, they are not a legacy account and nothing is seeded.
  const everHadSubjects = await prisma.subject.count({ where: { userId } });
  if (everHadSubjects > 0) return;

  const count = await prisma.subject.count({ where: { userId, ...scoped } });
  if (count === 0) {
    // 1. Try to seed ONLY from official report card grades first
    const grades = await prisma.subjectGrade.findMany({
      where: { reportCard: { userId } },
      select: { subject: true }
    });

    const officialSubjects = new Set<string>();
    for (const g of grades) {
      if (g.subject) {
        const trimmed = g.subject.trim();
        if (trimmed) officialSubjects.add(trimmed);
      }
    }

    if (officialSubjects.size > 0) {
      // Seed ONLY the official 15 subjects. The helper handles the race where
      // two concurrent dashboard loads both see count === 0.
      await createSubjectsIfMissing(userId, Array.from(officialSubjects));
    } else {
      // 2. Fallback to scanning all tables if no report cards exist yet
      const [
        templates,
        gradesList,
        resources,
        mastery,
        homeworks,
        tutors,
        goals,
        tasks,
        notes
      ] = await Promise.all([
        prisma.scheduleTemplate.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
        prisma.subjectGrade.findMany({ where: { reportCard: { userId } }, select: { subject: true } }),
        prisma.resource.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
        prisma.masteryItem.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
        prisma.homework.findMany({ where: { userId, ...scopedByTerm }, select: { subject: true } }),
        prisma.tutorModule.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
        prisma.subjectGoal.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
        prisma.task.findMany({ where: { userId, ...scopedByTerm }, select: { subject: true } }),
        prisma.studioNote.findMany({ where: { userId, ...scoped }, select: { subject: true } }),
      ]);

      const subjectNames = new Set<string>();
      const allItems = [
        ...templates,
        ...gradesList,
        ...resources,
        ...mastery,
        ...homeworks,
        ...tutors,
        ...goals,
        ...tasks,
        ...notes
      ];

      for (const item of allItems) {
        if (item.subject && typeof item.subject === 'string') {
          const normalized = normalizeSubject(item.subject);
          if (normalized) {
            subjectNames.add(normalized);
          }
        }
      }

      if (subjectNames.size > 0) {
        await createSubjectsIfMissing(userId, Array.from(subjectNames));
      }
    }
  }
}

/**
 * Fetch all subjects for the user, seeding the table the first time it is
 * empty. Unlike its previous incarnation this deletes nothing - the clean-up
 * pass is repairSubjects(), run from /subjects.
 */
export async function getSubjects() {
  const userId = await getUserId();
  if (!userId) return [];

  const scope = await getViewScope(userId);

  // Never seed into a year you are only reading. Archives are records, and
  // seedSubjectsIfEmpty writes.
  if (!scope?.isArchive) await seedSubjectsIfEmpty(userId);

  return prisma.subject.findMany({
    where: { userId, ...byClass(scope) },
    orderBy: { name: 'asc' },
  });
}

/**
 * Add a new subject to the master list.
 */
export async function addSubject(name: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Subject name cannot be empty');

  const stamp = await requireClassStamp(userId);

  // Subject is unique on (userId, name), a constraint that predates academic
  // years: the schema permits exactly one "Physics" per user, ever. So the
  // duplicate check is per YEAR - otherwise adding Physics in Year 2 fails
  // with "already exists" while the subject list in front of you is empty -
  // and a row found in another year is ADOPTED into this one rather than
  // duplicated, which is the only thing the unique key leaves available.
  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true, classId: true },
  });
  const match = subjects.find(
    (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (match) {
    if (!stamp.classId || match.classId === stamp.classId) {
      throw new Error(`Subject "${trimmedName}" already exists`);
    }
    const subject = await prisma.subject.update({
      where: { id: match.id },
      data: { name: trimmedName, ...stamp },
    });
    revalidatePath('/subjects');
    return { success: true, subject };
  }

  const subject = await prisma.subject.create({
    data: {
      userId,
      ...stamp,
      name: trimmedName,
    }
  });

  revalidatePath('/subjects');
  return { success: true, subject };
}

/**
 * Rename a subject and cascade update all tables referencing the subject name.
 */
export async function renameSubject(id: string, newName: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const trimmedNewName = newName.trim();
  if (!trimmedNewName) throw new Error('Subject name cannot be empty');

  // Renaming edits the year you are in; an archive is a record.
  const scope = await requireWritableScope(userId);

  // Find the subject first to get the old name
  const subject = await prisma.subject.findFirst({
    where: { id, userId, ...byClass(scope) }
  });

  if (!subject) throw new Error('Subject not found');
  const oldName = subject.name;

  if (oldName.toLowerCase() !== trimmedNewName.toLowerCase()) {
    // Still user-wide, because the unique key it protects is user-wide.
    const subjects = await prisma.subject.findMany({ where: { userId } });
    if (subjects.some(s => s.id !== id && s.name.toLowerCase() === trimmedNewName.toLowerCase())) {
      throw new Error(`Another subject named "${trimmedNewName}" already exists`);
    }
  }

  // Update the master entry
  await prisma.subject.update({
    where: { id },
    data: { name: trimmedNewName }
  });

  // Update all dependent tables, within this year only. A subject name is not
  // a global fact: renaming Physics now must not rewrite the history of a
  // finished year that also studied a subject called Physics.
  const { inClass, inTerm } = cascadeScopes(scope);
  await Promise.all([
    prisma.scheduleTemplate.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.task.updateMany({
      where: { userId, ...inTerm, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.subjectGrade.updateMany({
      where: { reportCard: { userId, ...inTerm }, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.resource.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.masteryItem.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.homework.updateMany({
      where: { userId, ...inTerm, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.tutorModule.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.subjectGoal.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.studioNote.updateMany({
      where: { userId, ...inClass, subject: oldName },
      data: { subject: trimmedNewName }
    })
  ]);

  revalidatePath('/subjects');
  revalidatePath('/goals');
  revalidatePath('/marks');
  revalidatePath('/timetable');
  revalidatePath('/homeworks');
  revalidatePath('/tutor');
  revalidatePath('/resources');
  revalidatePath('/');

  return { success: true };
}

/**
 * Delete a subject from the master list.
 * Optionally deletes all matching items from all other tables (cleanRelatedData).
 */
export async function deleteSubject(id: string, cleanRelatedData: boolean = false) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const scope = await requireWritableScope(userId);

  const subject = await prisma.subject.findFirst({
    where: { id, userId, ...byClass(scope) }
  });

  if (!subject) throw new Error('Subject not found');
  const subjectName = subject.name;

  // Delete the master entry
  await softDelete(prisma, 'subject', { id });

  if (cleanRelatedData) {
    // Clean up all related items, THIS YEAR ONLY. Unscoped, dropping a subject
    // from the current year would delete the tasks, marks and proof-of-work of
    // every previous year that ever studied a subject by the same name.
    const { inClass, inTerm } = cascadeScopes(scope);
    await Promise.all([
      softDelete(prisma, 'scheduleTemplate', { userId, ...inClass, subject: subjectName }),
      softDelete(prisma, 'task', { userId, ...inTerm, subject: subjectName }),
      softDelete(prisma, 'subjectGrade', { reportCard: { userId, ...inTerm }, subject: subjectName }),
      softDelete(prisma, 'resource', { userId, ...inClass, subject: subjectName }),
      softDelete(prisma, 'masteryItem', { userId, ...inClass, subject: subjectName }),
      softDelete(prisma, 'homework', { userId, ...inTerm, subject: subjectName }),
      softDelete(prisma, 'tutorModule', { userId, ...inClass, subject: subjectName }),
      softDelete(prisma, 'subjectGoal', { userId, ...inClass, subject: subjectName }),
      softDelete(prisma, 'studioNote', { userId, ...inClass, subject: subjectName })
    ]);
  }

  revalidatePath('/subjects');
  revalidatePath('/goals');
  revalidatePath('/marks');
  revalidatePath('/timetable');
  revalidatePath('/homeworks');
  revalidatePath('/tutor');
  revalidatePath('/resources');
  revalidatePath('/');

  return { success: true };
}
