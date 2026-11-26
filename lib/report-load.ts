import { addDays, format } from 'date-fns';

import { getCurrentUserTimezone, getDailySummaries, getWeeklySummaries } from '@/lib/actions';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { getTimeZoneOffsetMinutes } from '@/lib/utils';
import { dailyReports, weeklyReports, type ReportData } from '@/lib/report-model';

/**
 * Every daily and weekly report for the signed-in account, newest first, as
 * the Reports page and the mentor's Reports page both show them.
 *
 * Not a 'use server' file: it takes a userId, so it must never be callable
 * from the browser. Reading the summaries writes any report that is due.
 */

const DAY = 'yyyy-MM-dd';
/** Report dates are stored as the start of the user's calendar day. */
const keyOf = (d: Date) => format(d, DAY);

export async function loadReports(userId: string): Promise<{
  daily: ReportData[];
  weekly: ReportData[];
  scope: Awaited<ReturnType<typeof getViewScope>>;
}> {
  const [dailyList, weeklyList, timeZone, scope] = await Promise.all([
    getDailySummaries(),
    getWeeklySummaries(),
    getCurrentUserTimezone(),
    getViewScope(userId),
  ]);

  // Homework finished in the span the reports cover, by the user's day.
  const dates = [...dailyList.map((d) => d.date), ...weeklyList.map((w) => w.startDate)];
  const since = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
  const finished = await prisma.homework.findMany({
    where: { userId, ...byTerm(scope), isCompleted: true, completedAt: { gte: addDays(since, -1) } },
    select: { title: true, subject: true, completedAt: true },
    orderBy: { completedAt: 'asc' },
  });
  const byDay = new Map<string, { title: string; subject: string }[]>();
  for (const h of finished) {
    const at = h.completedAt!;
    const local = new Date(at.getTime() + getTimeZoneOffsetMinutes(timeZone, at) * 60_000);
    const key = local.toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), { title: h.title, subject: h.subject }]);
  }
  const byWeek = new Map<string, { title: string; subject: string }[]>();
  const weeks = weeklyList.map((w) => ({ ...w, startKey: keyOf(w.startDate), endKey: keyOf(w.endDate) }));
  for (const [key, items] of byDay) {
    const week = weeks.find((w) => w.startKey <= key && key <= w.endKey);
    if (week) byWeek.set(week.startKey, [...(byWeek.get(week.startKey) ?? []), ...items]);
  }

  return {
    daily: dailyReports(dailyList.map((d) => ({ ...d, key: keyOf(d.date) })), byDay),
    weekly: weeklyReports(weeks, byWeek),
    scope,
  };
}
