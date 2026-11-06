/**
 * Reading a calendar day's open blocks, for clash checks.
 *
 * Not a 'use server' file: these take a userId, so they must never be callable
 * from the browser. Server actions call them after resolving the signed-in user.
 */

import { prisma } from '@/lib/prisma';
import { storedDayKey, type BusyBlock, type DayBlocks } from './schedule-clash';
import { getTimeZoneOffsetMinutes, getZonedNow } from './utils';

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
