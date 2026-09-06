import { startOfDay, differenceInDays } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { normalizeSubject } from '@/lib/utils';
import { computeWeeklyPerformance, type GradeKey, type WeeklyPerformance } from '@/lib/grading';

/**
 * End-of-term and end-of-year summaries.
 *
 * Deliberately a VIEW over the existing grading engine rather than a second one:
 * the same computeWeeklyPerformance that grades a week grades a term, fed
 * per-week averages so a 12-week term is not scored as though it were one
 * enormous week. If the grading curve is ever retuned, these move with it.
 *
 * Summaries are computed live while a period is running and SNAPSHOTTED into
 * Term.summary / Class.summary when it is completed - a finished term's grade
 * should not drift afterwards because a task was edited.
 */
export type PeriodSummary = {
  grade: GradeKey;
  score: number;
  performance: WeeklyPerformance;

  totalSessions: number;
  completedSessions: number;
  scheduledMinutes: number;
  completedMinutes: number;

  activeDays: number;
  daysSpanned: number;
  longestStreak: number;

  topSubjects: { subject: string; minutes: number }[];
  examCount: number;

  /** ISO timestamp; set when the summary was snapshotted at completion. */
  generatedAt: string;
};

function taskMinutes(t: { startTime: string; endTime: string }): number {
  const [sH, sM] = t.startTime.split(':').map(Number);
  const [eH, eM] = t.endTime.split(':').map(Number);
  let mins = (eH * 60 + eM) - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // crosses midnight
  return Math.max(0, mins);
}

type SummaryTask = {
  date: Date;
  startTime: string;
  endTime: string;
  subject: string;
  isDone: boolean;
};

/**
 * The shared core. Both a term and a year are just "a set of tasks over a span
 * of days", so they differ only in which tasks they are given.
 */
function summarise(
  tasks: SummaryTask[],
  opts: { longestStreak: number; examCount: number }
): PeriodSummary | null {
  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.isDone);
  const scheduledMinutes = tasks.reduce((acc, t) => acc + taskMinutes(t), 0);
  const completedMinutes = completed.reduce((acc, t) => acc + taskMinutes(t), 0);

  const bySubject: Record<string, number> = {};
  const activeDays = new Set<string>();
  let first = tasks[0].date;
  let last = tasks[0].date;

  for (const t of tasks) {
    const subject = normalizeSubject(t.subject) || t.subject;
    bySubject[subject] = (bySubject[subject] || 0) + taskMinutes(t);

    const d = new Date(t.date);
    if (t.isDone) activeDays.add(startOfDay(d).toISOString());
    if (d < new Date(first)) first = d;
    if (d > new Date(last)) last = d;
  }

  const daysSpanned = Math.max(
    1,
    differenceInDays(startOfDay(new Date(last)), startOfDay(new Date(first))) + 1
  );
  const weeks = Math.max(1, daysSpanned / 7);

  // Per-week averages: the grading curve is calibrated for one week, so a term
  // must be handed its weekly rate, not its lifetime total.
  const performance = computeWeeklyPerformance({
    studiedMinutes: completedMinutes / weeks,
    scheduledMinutes: scheduledMinutes / weeks,
    completedSessions: completed.length,
    totalSessions: tasks.length,
    activeDays: Math.min(7, Math.round(activeDays.size / weeks)),
    weekStreak: Math.min(7, opts.longestStreak),
    prevStudiedMinutes: null,
  });

  const topSubjects = Object.entries(bySubject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([subject, minutes]) => ({ subject, minutes }));

  return {
    grade: performance.grade,
    score: performance.score,
    performance,
    totalSessions: tasks.length,
    completedSessions: completed.length,
    scheduledMinutes,
    completedMinutes,
    activeDays: activeDays.size,
    daysSpanned,
    longestStreak: opts.longestStreak,
    topSubjects,
    examCount: opts.examCount,
    generatedAt: new Date().toISOString(),
  };
}

const TASK_FIELDS = {
  date: true,
  startTime: true,
  endTime: true,
  subject: true,
  isDone: true,
} as const;

/** Summary for one term, computed from its tasks. */
export async function buildTermSummary(
  userId: string,
  termId: string
): Promise<PeriodSummary | null> {
  const term = await prisma.term.findFirst({
    where: { id: termId, userId, deletedAt: null },
    include: { class: { select: { longestStreak: true } } },
  });
  if (!term) return null;

  const [tasks, examCount] = await Promise.all([
    prisma.task.findMany({
      where: { termId, isDeleted: false },
      select: TASK_FIELDS,
      orderBy: { date: 'asc' },
    }),
    prisma.examEvent.count({ where: { termId } }),
  ]);

  return summarise(tasks, {
    longestStreak: term.class?.longestStreak ?? 0,
    examCount,
  });
}

/** Summary for a whole academic year, across every term in it. */
export async function buildClassSummary(
  userId: string,
  classId: string
): Promise<PeriodSummary | null> {
  const cls = await prisma.class.findFirst({
    where: { id: classId, userId, deletedAt: null },
    include: { terms: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!cls) return null;

  const termIds = cls.terms.map((t) => t.id);
  if (termIds.length === 0) return null;

  const [tasks, examCount] = await Promise.all([
    prisma.task.findMany({
      where: { termId: { in: termIds }, isDeleted: false },
      select: TASK_FIELDS,
      orderBy: { date: 'asc' },
    }),
    prisma.examEvent.count({ where: { termId: { in: termIds } } }),
  ]);

  return summarise(tasks, { longestStreak: cls.longestStreak, examCount });
}

/** Parse a stored snapshot, tolerating anything that is not valid JSON. */
export function readStoredSummary(raw: string | null): PeriodSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PeriodSummary;
  } catch {
    return null;
  }
}
