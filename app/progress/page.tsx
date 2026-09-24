import { redirect } from 'next/navigation';
import { addDays, endOfDay, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { syncStreak } from '@/lib/actions';
import { getReportCards } from '@/lib/marks-actions';
import { getGoals } from '@/lib/goal-actions';
import { getRankInfo, getXpForNextLevel } from '@/lib/gamification';
import { DEFAULT_TIMEZONE, getZonedNow } from '@/lib/utils';
import { ProgressHub, type ProgressHubData } from './ProgressHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function taskMinutes(startTime: string, endTime: string): number {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let mins = eH * 60 + eM - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // crosses midnight
  return Number.isFinite(mins) ? Math.max(0, mins) : 0;
}

/** Same normalisation the Goals page uses to match a goal to a graded subject. */
function subjectKey(s: string): string {
  return s.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').trim().toLowerCase();
}

function parseGrade(grade: string): number | null {
  const n = parseFloat(grade.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Progress hub: one screen that links every Progress page and says, for each,
 * the one thing worth knowing before you open it.
 *
 * Reads only - no summary generation here (Summaries and Daily Summary run
 * their own sync when opened). syncStreak is already memoised per request and
 * run by the layout, so calling it adds no round trips.
 */
export default async function ProgressPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [progress, scope] = await Promise.all([syncStreak(), getViewScope(userId)]);
  if (!progress) redirect('/welcome');

  const tz = progress.timezone || DEFAULT_TIMEZONE;
  const today = startOfDay(getZonedNow(tz));
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfDay(addDays(weekStart, 6));

  const [weekTasks, reportCards, goals, latestWeekly, latestDaily] = await Promise.all([
    prisma.task.findMany({
      where: { userId, ...byTerm(scope), isDeleted: false, date: { gte: weekStart, lte: weekEnd } },
      select: { date: true, startTime: true, endTime: true, isDone: true },
    }),
    getReportCards(),
    getGoals(),
    prisma.weeklySummary.findFirst({
      where: { userId, ...byTerm(scope) },
      orderBy: { startDate: 'desc' },
      select: { startDate: true, grade: true },
    }),
    prisma.dailySummary.findFirst({
      where: { userId, ...byTerm(scope) },
      orderBy: { date: 'desc' },
      select: { date: true, grade: true },
    }),
  ]);

  const doneThisWeek = weekTasks.filter((t) => t.isDone);
  const todayTasks = weekTasks.filter((t) => isSameDay(t.date, today));

  // Latest grade per subject, oldest card first so newer grades overwrite.
  // getReportCards returns newest first.
  const latestGrade = new Map<string, number>();
  for (const card of [...reportCards].reverse()) {
    for (const g of card.grades) {
      const n = parseGrade(g.grade);
      if (n !== null) latestGrade.set(subjectKey(g.subject), n);
    }
  }

  const latestCard = reportCards[0] ?? null;
  let average: number | null = latestCard?.overallAverage ?? null;
  if (average === null && latestCard) {
    const nums = latestCard.grades.map((g) => parseGrade(g.grade)).filter((n): n is number => n !== null);
    average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }

  const onTarget = goals.filter((goal) => {
    const current = latestGrade.get(subjectKey(goal.subject));
    return current !== undefined && current >= goal.targetGrade;
  }).length;

  const level = progress.level ?? 1;
  const xp = progress.xp ?? 0;

  const data: ProgressHubData = {
    streak: {
      current: progress.currentStreak ?? 0,
      best: progress.longestStreak ?? 0,
      paused: 'streakPaused' in progress ? Boolean(progress.streakPaused) : false,
    },
    rank: {
      name: getRankInfo(level).name,
      level,
      xp,
      xpToNext: Math.max(0, getXpForNextLevel(level) - xp),
    },
    week: {
      done: doneThisWeek.length,
      scheduled: weekTasks.length,
      minutesDone: doneThisWeek.reduce((acc, t) => acc + taskMinutes(t.startTime, t.endTime), 0),
    },
    today: {
      done: todayTasks.filter((t) => t.isDone).length,
      scheduled: todayTasks.length,
      summaryGrade: latestDaily && isSameDay(latestDaily.date, today) ? latestDaily.grade : null,
      summaryTime: progress.dailySummaryTime || '21:00',
    },
    marks: { average, term: latestCard?.term ?? null },
    goals: { total: goals.length, onTarget },
    latestSummary: latestWeekly
      ? { label: `Week of ${format(latestWeekly.startDate, 'd MMM')}`, grade: latestWeekly.grade }
      : null,
  };

  return <ProgressHub data={data} />;
}
