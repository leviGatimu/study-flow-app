/**
 * Reading a calendar day's open blocks, for clash checks, and keeping blocks
 * already made in step with the term's end date and routine edits.
 *
 * Not a 'use server' file: these take a userId, so they must never be callable
 * from the browser. Server actions call them after resolving the signed-in user.
 */

import { prisma } from '@/lib/prisma';
import { storedDayKey, type BusyBlock, type DayBlocks } from './schedule-clash';
import { getTimeZoneOffsetMinutes, getZonedNow } from './utils';
import { blocksAfterTermEnd, blocksOfRemovedRoutine, followTemplateEdit, outOfStepBlocks, WITHDRAWN, type TimedBlock } from './schedule-sync';
import { softDelete } from './soft-delete';

export const taskDayKey = (date: Date, timeZone: string) => storedDayKey(date, getTimeZoneOffsetMinutes(timeZone, date));

const shiftKey = (dateKey: string, days: number) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** A "YYYY-MM-DD" as the date a new task is stored under. */
export function taskDateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = (timeZone: string) => {
  const now = getZonedNow(timeZone);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * What is still to happen on this day and either side of it.
 *
 * Routine blocks are only created as days come into view, so a day further
 * ahead is generated first. Otherwise a block added next month would pass this
 * check and the routine would land on top of it later.
 */
export async function openBlocksAround(userId: string, dateKey: string, timeZone: string, exceptId?: string): Promise<DayBlocks> {
  if (dateKey >= todayKey(timeZone)) {
    const { ensureTasksGenerated } = await import('./actions');
    const day = taskDateFromKey(dateKey);
    await ensureTasksGenerated(day, day);
  }

  const [from, to] = [new Date(`${shiftKey(dateKey, -2)}T00:00:00Z`), new Date(`${shiftKey(dateKey, 3)}T00:00:00Z`)];
  const tasks = await prisma.task.findMany({
    where: { userId, isDeleted: false, isDone: false, isMissed: false, date: { gte: from, lt: to }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, subject: true, startTime: true, endTime: true, date: true },
  });

  const on = (key: string): BusyBlock[] => tasks.filter((task) => taskDayKey(task.date, timeZone) === key);
  return { today: on(dateKey), yesterday: on(shiftKey(dateKey, -1)), tomorrow: on(shiftKey(dateKey, 1)) };
}

/**
 * Remove blocks the student chose to replace, the same way deleting one does.
 * Homework that was planned into one of them goes back to being unplanned.
 */
export async function clearBlocks(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.task.updateMany({ where: { id: { in: ids }, userId }, data: { isDeleted: true } });
  await prisma.homework.updateMany({ where: { taskId: { in: ids }, userId }, data: { taskId: null, plannedDate: null } });
}

/* ---------- made blocks following the plan (rules in lib/schedule-sync.ts) ---------- */

async function madeBlocks(where: Record<string, unknown>, timeZone: string): Promise<TimedBlock[]> {
  const rows = await prisma.task.findMany({
    where: { ...where, isDeleted: false },
    select: {
      id: true, date: true, startTime: true, endTime: true, templateId: true, examId: true, isDone: true, isMissed: true,
      workDescription: true, proofPdfUrl: true, homeworks: { select: { id: true }, take: 1 },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    day: taskDayKey(r.date, timeZone),
    startTime: r.startTime,
    endTime: r.endTime,
    templateId: r.templateId,
    examId: r.examId,
    isDone: r.isDone,
    isMissed: r.isMissed,
    hasWork: !!r.workDescription || !!r.proofPdfUrl,
    hasHomework: r.homeworks.length > 0,
  }));
}

/**
 * Withdraw the term's study blocks dated after its last day. Runs whenever
 * blocks are made, and straight after the end date is set, so a calendar
 * that made weeks ahead loses the days past the new end at once.
 */
export async function withdrawAfterTermEnd(userId: string, termId: string, endDate: Date, timeZone: string): Promise<number> {
  const lastDay = taskDayKey(endDate, timeZone);
  // A day of slack either side of the stored date covers any timezone.
  const from = new Date(new Date(`${lastDay}T00:00:00Z`).getTime() - 86_400_000);
  const ids = blocksAfterTermEnd(await madeBlocks({ userId, termId, date: { gte: from } }, timeZone), lastDay);
  if (ids.length > 0) await prisma.task.updateMany({ where: { id: { in: ids }, userId }, data: WITHDRAWN });
  return ids.length;
}

/**
 * Bring a routine block's made blocks, from today on, in line with its new
 * day, times, subject and type. `previous` is the slot before the edit: only
 * blocks still on it follow, so one the student moved by itself stays put.
 */
export async function followRoutineEdit(
  userId: string,
  template: { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string; type: string },
  previous: { dayOfWeek: number; startTime: string; endTime: string },
  timeZone: string
): Promise<void> {
  const today = todayKey(timeZone);
  const from = new Date(new Date(`${today}T00:00:00Z`).getTime() - 86_400_000);
  const blocks = await madeBlocks({ userId, templateId: template.id, date: { gte: from } }, timeZone);
  const { update, withdraw } = followTemplateEdit(blocks, { templateId: template.id, previous, dayOfWeek: template.dayOfWeek, today });
  if (update.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: update }, userId },
      data: { startTime: template.startTime, endTime: template.endTime, subject: template.subject, type: template.type },
    });
  }
  if (withdraw.length > 0) await prisma.task.updateMany({ where: { id: { in: withdraw }, userId }, data: WITHDRAWN });
}

/**
 * Bring routine blocks made before their routine block's last edit back in
 * line with it (rules: outOfStepBlocks), and remove the ones still waiting
 * from a routine block that was removed (blocksOfRemovedRoutine). Called whenever blocks are made, so
 * blocks left behind by older versions are fixed on the next visit.
 */
export async function repairOutOfStep(
  userId: string,
  routine: { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string; type: string; updatedAt: Date }[],
  timeZone: string
): Promise<void> {
  const today = todayKey(timeZone);
  const from = new Date(new Date(`${today}T00:00:00Z`).getTime() - 86_400_000);

  const gone = await prisma.scheduleTemplate.findMany({ where: { userId, deletedAt: { not: null } }, select: { id: true } });
  if (gone.length > 0) {
    const leftover = await madeBlocks({ userId, templateId: { in: gone.map((t) => t.id) }, date: { gte: from } }, timeZone);
    const ids = blocksOfRemovedRoutine(leftover, new Set(gone.map((t) => t.id)), today);
    if (ids.length > 0) await softDelete(prisma, 'task', { id: { in: ids }, userId });
  }

  if (routine.length === 0) return;
  const templateId = { in: routine.map((slot) => slot.id) };
  const [rows, removed] = await Promise.all([
    prisma.task.findMany({
      where: { userId, templateId, isDeleted: false, date: { gte: from } },
      select: {
        id: true, date: true, startTime: true, endTime: true, subject: true, type: true, templateId: true, examId: true,
        isDone: true, isMissed: true, workDescription: true, proofPdfUrl: true, updatedAt: true,
        homeworks: { select: { id: true }, take: 1 },
      },
    }),
    // Originals left behind by moving a block to another day (deleted by the
    // student, still on the slot), a week either side.
    prisma.task.findMany({
      where: { userId, templateId, isDeleted: true, deletedAt: null, date: { gte: new Date(from.getTime() - 7 * 86_400_000) } },
      select: { templateId: true, date: true },
    }),
  ]);
  const { update, withdraw } = outOfStepBlocks(
    rows.map((r) => ({
      id: r.id,
      day: taskDayKey(r.date, timeZone),
      startTime: r.startTime,
      endTime: r.endTime,
      subject: r.subject,
      type: r.type,
      templateId: r.templateId,
      examId: r.examId,
      isDone: r.isDone,
      isMissed: r.isMissed,
      hasWork: !!r.workDescription || !!r.proofPdfUrl,
      hasHomework: r.homeworks.length > 0,
      changedAt: r.updatedAt.getTime(),
    })),
    routine.map((slot) => ({ ...slot, changedAt: slot.updatedAt.getTime() })),
    new Set(removed.map((r) => `${r.templateId}|${taskDayKey(r.date, timeZone)}`)),
    today
  );
  for (const slot of routine) {
    const ids = update.filter((u) => u.templateId === slot.id).map((u) => u.id);
    if (ids.length === 0) continue;
    await prisma.task.updateMany({
      where: { id: { in: ids }, userId },
      data: { startTime: slot.startTime, endTime: slot.endTime, subject: slot.subject, type: slot.type },
    });
  }
  if (withdraw.length > 0) await prisma.task.updateMany({ where: { id: { in: withdraw }, userId }, data: WITHDRAWN });
}
