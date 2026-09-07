'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getScheduleState } from '@/lib/term';

/** Strip "(revision)" / apostrophes so "Math (revision)" and "Math" collapse together. */
function normalizeSubject(subject: string) {
  if (!subject) return '';
  return subject
    .replace(/\s*\(revision\)\s*/gi, '')
    .replace(/'/g, '')
    .trim();
}

function taskMinutes(startTime: string, endTime: string): number {
  try {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    let mins = (eH * 60 + eM) - (sH * 60 + sM);
    if (mins < 0) mins += 1440; // cross-midnight
    return Math.max(0, mins);
  } catch {
    return 0;
  }
}

/** Best-effort conversion of a grade string ("85", "85%", "A-") into a 0-100 number. */
function gradeToNumber(grade?: string | null): number | null {
  if (!grade) return null;
  const g = grade.trim();
  const num = parseFloat(g.replace('%', ''));
  if (!isNaN(num) && /\d/.test(g)) return Math.min(100, Math.max(0, num));
  const map: Record<string, number> = {
    'A+': 97, A: 92, 'A-': 88,
    'B+': 85, B: 82, 'B-': 78,
    'C+': 75, C: 72, 'C-': 68,
    'D+': 65, D: 62, 'D-': 58,
    E: 50, F: 40,
  };
  const v = map[g.toUpperCase()];
  return v != null ? v : null;
}

export interface SubjectInsight {
  subject: string;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;       // 0-100
  minutes: number;              // scheduled study minutes from completed tasks
  masteryTotal: number;
  masteryDone: number;
  masteryPct: number | null;    // 0-100, null if no topics tracked
  quizCount: number;
  quizAvg: number | null;       // 0-100, null if no attempts
  grade: number | null;         // latest numeric grade, null if none/unparseable
  gradeLabel: string | null;    // raw grade string for display
  target: number | null;        // goal target grade
  nextExamDays: number | null;  // days until next exam matching this subject
  attentionScore: number;       // 0-100, higher = needs more attention
  reason: string;               // why it needs attention
}

export interface InsightsData {
  headline: {
    subjectsTracked: number;
    avgCompletion: number | null;
    avgMastery: number | null;
    avgQuiz: number | null;
    scheduledHours: number;     // hours from completed tasks
    focusMinutes: number;       // deep-focus minutes from Focus Mode
    focusSessions: number;
    currentStreak: number;
    longestStreak: number;
    level: number;
    xp: number;
  };
  subjects: SubjectInsight[];
  gradeTrajectory: { term: string; average: number }[];
  quizTrend: { label: string; score: number; subject: string }[];
}

/**
 * Which academic years an insights view covers.
 *
 *   'class'    the year you are in now. The default, and what you almost
 *              always mean by "how am I doing" - last year's Physics has no
 *              bearing on this year's.
 *   'lifetime' every year you have ever studied. This is where a running
 *              total belongs: hours studied, blocks completed, all of it.
 *
 * These used to be the same thing: every query filtered on userId alone, so
 * finishing Year 1 and starting Year 2 left the new year's insights diluted by
 * a completed year's data, with no way to look at either on its own.
 */
export type InsightsScope = 'class' | 'lifetime';

export async function getInsightsData(
  scope: InsightsScope = 'class'
): Promise<InsightsData | null> {
  const userId = await getUserId();
  if (!userId) return null;

  // Task is TERM-scoped, not class-scoped, so it reaches its year through the
  // term it belongs to.
  const { classId } = await getScheduleState(userId);
  const lifetime = scope === 'lifetime';

  // A class filter that is simply absent for the lifetime view, rather than
  // two parallel sets of queries that could drift apart.
  const inClass = lifetime || !classId ? {} : { classId };
  const taskInClass = lifetime || !classId ? {} : { termRef: { classId } };

  const [tasks, attempts, mastery, reportCards, goals, progress, exams, subjectRecords] =
    await Promise.all([
      prisma.task.findMany({ where: { userId, isDeleted: false, ...taskInClass } }),
      prisma.quizAttempt.findMany({
        where: { module: { userId, ...inClass } },
        include: { module: { select: { subject: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.masteryItem.findMany({ where: { userId, ...inClass } }),
      prisma.reportCard.findMany({
        where: { userId },
        include: { grades: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.subjectGoal.findMany({ where: { userId, ...inClass } }),
      prisma.userProgress.findUnique({ where: { userId } }),
      prisma.examEvent.findMany({ where: { userId } }),
      prisma.subject.findMany({ where: { userId, ...inClass } }),
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Latest report card holds the "current" grades.
  const latestCard = reportCards[reportCards.length - 1];

  type Acc = {
    totalTasks: number;
    doneTasks: number;
    minutes: number;
    masteryTotal: number;
    masteryDone: number;
    quizScores: number[];
  };
  const map = new Map<string, Acc>();
  const ensure = (name: string): Acc => {
    const key = normalizeSubject(name);
    if (!key) return { totalTasks: 0, doneTasks: 0, minutes: 0, masteryTotal: 0, masteryDone: 0, quizScores: [] };
    if (!map.has(key)) {
      map.set(key, { totalTasks: 0, doneTasks: 0, minutes: 0, masteryTotal: 0, masteryDone: 0, quizScores: [] });
    }
    return map.get(key)!;
  };

  // Seed subject universe so subjects with grades/goals but no tasks still appear.
  subjectRecords.forEach((s) => ensure(s.name));
  goals.forEach((g) => ensure(g.subject));
  latestCard?.grades.forEach((g) => ensure(g.subject));

  tasks.forEach((t) => {
    const acc = ensure(t.subject);
    acc.totalTasks += 1;
    if (t.isDone) {
      acc.doneTasks += 1;
      acc.minutes += taskMinutes(t.startTime, t.endTime);
    }
  });

  mastery.forEach((m) => {
    const acc = ensure(m.subject);
    acc.masteryTotal += 1;
    if (m.isCompleted) acc.masteryDone += 1;
  });

  attempts.forEach((a) => {
    const acc = ensure(a.module.subject);
    acc.quizScores.push(a.score);
  });

  const goalMap = new Map<string, number>();
  goals.forEach((g) => goalMap.set(normalizeSubject(g.subject), g.targetGrade));

  const gradeMap = new Map<string, { num: number | null; label: string }>();
  latestCard?.grades.forEach((g) => {
    gradeMap.set(normalizeSubject(g.subject), { num: gradeToNumber(g.grade), label: g.grade });
  });

  const subjects: SubjectInsight[] = [];
  for (const [subject, acc] of map.entries()) {
    if (!subject) continue;

    const completionRate = acc.totalTasks > 0 ? Math.round((acc.doneTasks / acc.totalTasks) * 100) : 0;
    const masteryPct = acc.masteryTotal > 0 ? Math.round((acc.masteryDone / acc.masteryTotal) * 100) : null;
    const quizAvg = acc.quizScores.length > 0
      ? Math.round(acc.quizScores.reduce((s, v) => s + v, 0) / acc.quizScores.length)
      : null;
    const gradeInfo = gradeMap.get(subject) ?? null;
    const target = goalMap.get(subject) ?? null;

    // Nearest upcoming exam whose title references this subject.
    let nextExamDays: number | null = null;
    exams.forEach((e) => {
      if (!e.title.toLowerCase().includes(subject.toLowerCase())) return;
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      const days = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (days >= 0 && (nextExamDays === null || days < nextExamDays)) nextExamDays = days;
    });

    // Attention = weighted average of available "gap" signals (higher gap => more attention).
    const signals: { gap: number; weight: number; label: string }[] = [];
    if (acc.totalTasks > 0) signals.push({ gap: 100 - completionRate, weight: 1, label: 'low completion' });
    if (masteryPct !== null) signals.push({ gap: 100 - masteryPct, weight: 1.2, label: 'weak topic mastery' });
    if (quizAvg !== null) signals.push({ gap: 100 - quizAvg, weight: 1.5, label: 'low quiz scores' });
    if (gradeInfo?.num != null && target != null) {
      signals.push({ gap: Math.max(0, target - gradeInfo.num), weight: 2, label: 'below grade target' });
    }

    let attentionScore = 0;
    let reason = 'On track';
    if (signals.length > 0) {
      const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
      attentionScore = Math.round(signals.reduce((s, x) => s + x.gap * x.weight, 0) / totalWeight);
      const worst = signals.reduce((a, b) => (b.gap * b.weight > a.gap * a.weight ? b : a));
      reason = attentionScore < 20 ? 'On track' : `Mostly ${worst.label}`;
    }
    // Imminent exam amplifies urgency.
    if (nextExamDays !== null && nextExamDays <= 14) {
      attentionScore = Math.min(100, Math.round(attentionScore * (nextExamDays <= 3 ? 1.4 : 1.2)));
      reason = nextExamDays <= 3 ? `Exam in ${nextExamDays}d — ${reason.toLowerCase()}` : reason;
    }

    subjects.push({
      subject,
      totalTasks: acc.totalTasks,
      doneTasks: acc.doneTasks,
      completionRate,
      minutes: acc.minutes,
      masteryTotal: acc.masteryTotal,
      masteryDone: acc.masteryDone,
      masteryPct,
      quizCount: acc.quizScores.length,
      quizAvg,
      grade: gradeInfo?.num ?? null,
      gradeLabel: gradeInfo?.label ?? null,
      target,
      nextExamDays,
      attentionScore,
      reason,
    });
  }

  subjects.sort((a, b) => b.attentionScore - a.attentionScore);

  // Headline aggregates.
  const withTasks = subjects.filter((s) => s.totalTasks > 0);
  const withMastery = subjects.filter((s) => s.masteryPct !== null);
  const withQuiz = subjects.filter((s) => s.quizAvg !== null);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null);
  const totalMinutes = subjects.reduce((s, x) => s + x.minutes, 0);

  const gradeTrajectory = reportCards
    .filter((c) => c.overallAverage != null)
    .map((c) => ({ term: c.term, average: Math.round((c.overallAverage as number) * 10) / 10 }));

  const quizTrend = attempts.map((a, i) => ({
    label: `#${i + 1}`,
    score: a.score,
    subject: normalizeSubject(a.module.subject),
  }));

  return {
    headline: {
      subjectsTracked: subjects.length,
      avgCompletion: avg(withTasks.map((s) => s.completionRate)),
      avgMastery: avg(withMastery.map((s) => s.masteryPct as number)),
      avgQuiz: avg(withQuiz.map((s) => s.quizAvg as number)),
      scheduledHours: Math.round((totalMinutes / 60) * 10) / 10,
      focusMinutes: progress?.totalFocusMinutes ?? 0,
      focusSessions: progress?.focusSessions ?? 0,
      currentStreak: progress?.currentStreak ?? 0,
      longestStreak: progress?.longestStreak ?? 0,
      level: progress?.level ?? 1,
      xp: progress?.xp ?? 0,
    },
    subjects,
    gradeTrajectory,
    quizTrend,
  };
}
