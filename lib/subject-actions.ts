'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { normalizeSubject } from '@/lib/utils';

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

  return prisma.subject.findMany({
    where: { userId },
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
      data: missing.map((name) => ({ userId, name })),
    });
  } catch {
    // Someone else seeded between the read and the write. Settle it row by row.
    for (const name of missing) {
      await prisma.subject.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name },
      });
    }
  }
}

/**
 * Fetch all subjects for the user.
 * If the user's Subject table is empty, scan all existing tables containing
 * subject-specific data and automatically populate the Subject table to prevent data loss.
 */
export async function getSubjects() {
  const userId = await getUserId();
  if (!userId) return [];

  // 1. Database Self-Healing: Clean up any duplicate subjects or subjects containing "(revision)"
  await prisma.subject.deleteMany({
    where: {
      userId,
      OR: [
        { name: { contains: '(revision)' } },
        { name: { contains: '(Revision)' } },
        { name: { contains: 'revision' } },
        { name: { contains: 'Revision' } }
      ]
    }
  });

  // 2. Remove duplicate normalized subjects if any exist
  const existingSubjects = await prisma.subject.findMany({ where: { userId } });
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
    await prisma.subject.deleteMany({
      where: {
        id: { in: duplicateIds }
      }
    });
  }

  // Check if we already have subjects in the Subject table
  const count = await prisma.subject.count({ where: { userId } });
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
        prisma.scheduleTemplate.findMany({ where: { userId }, select: { subject: true } }),
        prisma.subjectGrade.findMany({ where: { reportCard: { userId } }, select: { subject: true } }),
        prisma.resource.findMany({ where: { userId }, select: { subject: true } }),
        prisma.masteryItem.findMany({ where: { userId }, select: { subject: true } }),
        prisma.homework.findMany({ where: { userId }, select: { subject: true } }),
        prisma.tutorModule.findMany({ where: { userId }, select: { subject: true } }),
        prisma.subjectGoal.findMany({ where: { userId }, select: { subject: true } }),
        prisma.task.findMany({ where: { userId }, select: { subject: true } }),
        prisma.studioNote.findMany({ where: { userId }, select: { subject: true } }),
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

  return prisma.subject.findMany({
    where: { userId },
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

  // Case-insensitive check using javascript on the existing user subjects
  const subjects = await prisma.subject.findMany({ where: { userId } });
  if (subjects.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error(`Subject "${trimmedName}" already exists`);
  }

  const subject = await prisma.subject.create({
    data: {
      userId,
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

  // Find the subject first to get the old name
  const subject = await prisma.subject.findFirst({
    where: { id, userId }
  });

  if (!subject) throw new Error('Subject not found');
  const oldName = subject.name;

  if (oldName.toLowerCase() !== trimmedNewName.toLowerCase()) {
    // Check if new name already exists elsewhere
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

  // Update all dependent tables
  await Promise.all([
    prisma.scheduleTemplate.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.task.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.subjectGrade.updateMany({
      where: { reportCard: { userId }, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.resource.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.masteryItem.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.homework.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.tutorModule.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.subjectGoal.updateMany({
      where: { userId, subject: oldName },
      data: { subject: trimmedNewName }
    }),
    prisma.studioNote.updateMany({
      where: { userId, subject: oldName },
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

  const subject = await prisma.subject.findFirst({
    where: { id, userId }
  });

  if (!subject) throw new Error('Subject not found');
  const subjectName = subject.name;

  // Delete the master entry
  await prisma.subject.delete({
    where: { id }
  });

  if (cleanRelatedData) {
    // Clean up all related items in other tables
    await Promise.all([
      prisma.scheduleTemplate.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.task.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.subjectGrade.deleteMany({
        where: { reportCard: { userId }, subject: subjectName }
      }),
      prisma.resource.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.masteryItem.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.homework.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.tutorModule.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.subjectGoal.deleteMany({
        where: { userId, subject: subjectName }
      }),
      prisma.studioNote.deleteMany({
        where: { userId, subject: subjectName }
      })
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
