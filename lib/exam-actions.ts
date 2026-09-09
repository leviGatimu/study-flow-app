'use server';

import { addDays, startOfDay, endOfDay } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import {
  getViewScope,
  byClass,
  requireTermStamp,
  isViewingArchive,
  ARCHIVE_WRITE_ERROR,
} from '@/lib/scope';
import { revalidatePath } from 'next/cache';

/**
 * Exams as assessments rather than countdowns.
 *
 * The old model was {title, date, priority}, and `title` was used as the
 * subject key - so "Physics Paper 1" returned zero preparation stats. Exams now
 * link to a real Subject, carry a kind and a result, and can generate their own
 * revision blocks.
 */

function refresh() {
  revalidatePath('/exams');
  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/marks');
  revalidatePath('/insights');
}

/** Minutes since midnight, for overlap checks. */
const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return Number.isNaN(h) ? 0 : h * 60 + (m || 0);
};

const pad = (n: number) => n.toString().padStart(2, '0');
const hhmm = (total: number) => `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;

export async function getExamWithPrep(examId: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const exam = await prisma.examEvent.findFirst({
    where: { id: examId, userId, deletedAt: null },
    include: {
      subject: { select: { id: true, name: true } },
      revisionTasks: {
        where: { isDeleted: false },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        select: { id: true, date: true, startTime: true, endTime: true, isDone: true },
      },
    },
  });
  if (!exam) return null;

  // The picker offers this year's subjects: linking an exam to a subject the
  // year no longer teaches is how the title-as-subject-key bug looked.
  const subjects = await prisma.subject.findMany({
    where: { userId, ...byClass(await getViewScope(userId)), deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return { exam, subjects };
}

/** Assign (or correct) the subject an exam assesses. */
export async function setExamSubject(examId: string, subjectId: string | null) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const exam = await prisma.examEvent.findFirst({ where: { id: examId, userId } });
  if (!exam) return { error: 'Exam not found.' };

  // A finished year is a record, not a workspace. This action reports failure
  // by returning it, so the refusal is returned rather than thrown.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  await prisma.examEvent.update({ where: { id: examId }, data: { subjectId } });
  refresh();
  return { success: true };
}

export async function updateExamDetails(
  examId: string,
  data: {
    title?: string;
    date?: Date;
    startTime?: string | null;
    endTime?: string | null;
    room?: string | null;
    kind?: string;
    weight?: number | null;
    notes?: string | null;
  }
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const exam = await prisma.examEvent.findFirst({ where: { id: examId, userId } });
  if (!exam) return { error: 'Exam not found.' };

  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  await prisma.examEvent.update({ where: { id: examId }, data });
  refresh();
  return { success: true };
}

/**
 * Record the result. This is what closes the loop between "an exam is coming"
 * and "here is how you actually did", which the countdown never did.
 */
export async function recordExamResult(
  examId: string,
  score: number | null,
  maxScore: number | null
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const exam = await prisma.examEvent.findFirst({ where: { id: examId, userId } });
  if (!exam) return { error: 'Exam not found.' };

  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  if (score !== null && maxScore !== null && maxScore <= 0) {
    return { error: 'Total marks must be greater than zero.' };
  }
  if (score !== null && maxScore !== null && score > maxScore) {
    return { error: 'Score cannot be higher than the total marks.' };
  }

  await prisma.examEvent.update({
    where: { id: examId },
    data: { score, maxScore },
  });
  refresh();
  return { success: true };
}

/**
 * Plan revision backwards from the exam date.
 *
 * Sessions are spread over the days before the exam and weighted towards the
 * end, because revision closest to the exam is what actually sticks. Each
 * session is a normal REVISION task, so it appears on the dashboard, counts
 * towards the streak and can be ticked off like anything else - it is simply
 * tagged with examId so progress can be reported against the exam.
 *
 * Re-running replaces any blocks that have not been done yet, and never
 * touches ones already completed.
 */
export async function planRevision(
  examId: string,
  options?: {
    sessions?: number;
    daysBefore?: number;
    startTime?: string;
    durationMinutes?: number;
  }
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const exam = await prisma.examEvent.findFirst({
    where: { id: examId, userId, deletedAt: null },
    include: { subject: { select: { name: true } } },
  });
  if (!exam) return { error: 'Exam not found.' };

  const sessions = Math.min(20, Math.max(1, options?.sessions ?? 6));
  const daysBefore = Math.min(60, Math.max(1, options?.daysBefore ?? 14));
  const duration = Math.min(240, Math.max(15, options?.durationMinutes ?? 60));
  const preferredStart = options?.startTime ?? '19:00';

  const examDay = startOfDay(new Date(exam.date));
  const today = startOfDay(new Date());

  // Only plan into days that are still ahead of us.
  const firstDay = examDay > addDays(today, -1) ? addDays(examDay, -daysBefore) : null;
  if (!firstDay) return { error: 'That exam has already passed.' };
  const windowStart = firstDay < today ? today : firstDay;

  const availableDays = Math.max(
    1,
    Math.round((examDay.getTime() - windowStart.getTime()) / 86_400_000)
  );
  if (availableDays < 1) return { error: 'There are no days left before this exam.' };

  // Weighted towards the exam: place session i at a fraction of the window that
  // grows quadratically, so the last few land in the final days.
  const dayOffsets: number[] = [];
  for (let i = 0; i < sessions; i++) {
    const t = sessions === 1 ? 1 : (i + 1) / sessions;
    const fromStart = Math.round(availableDays * Math.pow(t, 1.6));
    dayOffsets.push(Math.min(availableDays - 1, Math.max(0, fromStart - 1)));
  }

  const stamp = await requireTermStamp(userId);

  // Replace only the blocks that have not been done.
  const existing = await prisma.task.findMany({
    where: { userId, examId, isDeleted: false },
    select: { id: true, isDone: true },
  });
  const keep = existing.filter((t) => t.isDone).length;
  const removable = existing.filter((t) => !t.isDone).map((t) => t.id);
  if (removable.length > 0) {
    await softDelete(prisma, 'task', { id: { in: removable } });
  }

  const subjectName = exam.subject?.name ?? exam.title;
  const created: { date: Date; startTime: string; endTime: string }[] = [];
  const usedPerDay = new Map<string, number[]>();

  // Pre-load what is already scheduled on those days so revision does not land
  // on top of an existing block. Deliberately NOT year-scoped: this is clash
  // detection, and a block the query cannot see is a block revision lands on
  // top of.
  const planDays = [...new Set(dayOffsets)].map((o) => addDays(windowStart, o));
  const dayTasks = await prisma.task.findMany({
    where: {
      userId,
      isDeleted: false,
      date: {
        gte: startOfDay(planDays.reduce((a, b) => (a < b ? a : b))),
        lte: endOfDay(planDays.reduce((a, b) => (a > b ? a : b))),
      },
    },
    select: { date: true, startTime: true, endTime: true },
  });
  for (const t of dayTasks) {
    const key = startOfDay(new Date(t.date)).toISOString();
    const list = usedPerDay.get(key) ?? [];
    list.push(mins(t.startTime), mins(t.endTime));
    usedPerDay.set(key, list);
  }

  for (const offset of dayOffsets) {
    const date = startOfDay(addDays(windowStart, offset));
    const key = date.toISOString();
    const busy = usedPerDay.get(key) ?? [];

    // Walk forward from the preferred time until the slot is free.
    let start = mins(preferredStart);
    for (let attempt = 0; attempt < 8; attempt++) {
      const end = start + duration;
      const clashes = busy.some((_, i) =>
        i % 2 === 0 ? start < busy[i + 1] && end > busy[i] : false
      );
      if (!clashes) break;
      start += duration;
    }
    if (start + duration > 24 * 60) start = mins(preferredStart); // give up, stack it

    const startTime = hhmm(start);
    const endTime = hhmm(start + duration);
    busy.push(start, start + duration);
    usedPerDay.set(key, busy);

    created.push({ date, startTime, endTime });
  }

  await prisma.task.createMany({
    data: created.map((c) => ({
      userId,
      templateId: null,
      ...stamp,
      examId,
      date: c.date,
      startTime: c.startTime,
      endTime: c.endTime,
      subject: subjectName,
      type: 'REVISION',
      isMissed: false,
      isDeleted: false,
    })),
  });

  refresh();
  return { success: true, created: created.length, kept: keep };
}

/** Remove the revision blocks for an exam that have not been done yet. */
export async function clearRevisionPlan(examId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const count = await softDelete(prisma, 'task', {
    userId, examId, isDone: false, isDeleted: false,
  });
  refresh();
  return { success: true, removed: count };
}
