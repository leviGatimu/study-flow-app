import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getCurrentUserTimezone } from '@/lib/actions';
import { taskDayKey } from '@/lib/schedule-placement';
import { buildClassSummary, readStoredSummary } from '@/lib/summary';
import { blockMinutes, buildYearRecap, type YearRecap } from '@/lib/year-recap';

export type YearHome = {
  classId: string;
  status: string;
  recap: YearRecap;
};

/**
 * One of the student's own years, read for the Year home page and the recap
 * story. Server-side only; the numbers are worked out in lib/year-recap.ts.
 * Null when the year is not theirs or no longer exists.
 */
export async function loadYearHome(classId: string): Promise<YearHome | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const cls = await prisma.class.findFirst({
    where: { id: classId, userId, deletedAt: null },
    include: { terms: { where: { deletedAt: null }, orderBy: { index: 'asc' } } },
  });
  if (!cls) return null;

  const termIds = cls.terms.map((t) => t.id);
  // Focus sessions and XP carry no year of their own: they count when they
  // happened while this year ran.
  const span = { gte: cls.startedAt, ...(cls.completedAt ? { lte: cls.completedAt } : {}) };

  const [timezone, tasks, focus, xp, homework, exams, attempts] = await Promise.all([
    getCurrentUserTimezone(),
    prisma.task.findMany({
      where: { userId, termId: { in: termIds }, isDeleted: false, deletedAt: null },
      select: { date: true, startTime: true, endTime: true, subject: true, type: true, isDone: true, isMissed: true, termId: true },
    }),
    prisma.xpEvent.findMany({
      where: { userId, deletedAt: null, source: 'FOCUS', focusSeconds: { gt: 0 }, createdAt: span },
      select: { focusSeconds: true },
    }),
    prisma.xpEvent.aggregate({ where: { userId, deletedAt: null, createdAt: span }, _sum: { amount: true } }),
    prisma.homework.findMany({
      where: { userId, termId: { in: termIds }, deletedAt: null },
      select: { isCompleted: true, completedAt: true, dueDate: true },
    }),
    prisma.examEvent.findMany({
      where: { userId, termId: { in: termIds }, deletedAt: null },
      select: { title: true, category: true, score: true, maxScore: true, subject: { select: { name: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { classId: cls.id, deletedAt: null, markingStatus: { notIn: ['PENDING'] } },
      select: { score: true },
    }),
  ]);

  const yearSummary = readStoredSummary(cls.summary) ?? (await buildClassSummary(userId, cls.id));

  const termMinutes = new Map<string, number>();
  for (const t of tasks) {
    if (t.isDone && t.termId) termMinutes.set(t.termId, (termMinutes.get(t.termId) ?? 0) + blockMinutes(t.startTime, t.endTime));
  }

  const recap = buildYearRecap({
    label: cls.label,
    startedAt: cls.startedAt,
    completedAt: cls.completedAt,
    grade: yearSummary?.grade ?? null,
    tasks: tasks.map((t) => ({
      day: taskDayKey(t.date, timezone),
      startTime: t.startTime,
      endTime: t.endTime,
      subject: t.subject,
      type: t.type,
      isDone: t.isDone,
      isMissed: t.isMissed,
    })),
    focusSessions: focus.map((f) => f.focusSeconds ?? 0),
    xp: xp._sum.amount ?? 0,
    homework: homework.map((h) => ({
      isCompleted: h.isCompleted,
      onTime: !!h.completedAt && taskDayKey(h.completedAt, timezone) <= taskDayKey(h.dueDate, timezone),
    })),
    exams: exams.map((e) => ({ title: e.title, subject: e.subject?.name ?? null, category: e.category, score: e.score, maxScore: e.maxScore })),
    practiceScores: attempts.map((a) => a.score),
    terms: cls.terms.map((t) => ({
      name: t.name,
      grade: readStoredSummary(t.summary)?.grade ?? null,
      minutes: termMinutes.get(t.id) ?? 0,
    })),
  });

  return { classId: cls.id, status: cls.status, recap };
}
