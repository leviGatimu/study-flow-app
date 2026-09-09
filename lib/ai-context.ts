/**
 * What the AI knows about you.
 *
 * THE PROBLEM THIS EXISTS TO FIX
 * ------------------------------
 * The system instruction was, in full: "You are a helpful study buddy... Today's
 * date is X." That is all the model was ever told. So it could not answer the
 * only question a study assistant is actually for - "what should I do right
 * now?" - because it did not know what the student takes, when their exams are,
 * what they have already written, or what they keep getting wrong. Every
 * conversation started by asking the student to describe their own situation,
 * which is precisely the work they wanted help with.
 *
 * This module assembles that situation once, from the data the app already has,
 * and renders it into the prompt. It is the difference between a chatbot that
 * happens to be inside a study app and a study app that can think.
 *
 * TWO RULES IT KEEPS
 * ------------------
 * SCOPED TO ONE USER AND ONE YEAR. Every query filters on the caller's own
 * userId and their current class/term through the same helpers the rest of the
 * app uses. Two students on one deployment must never see a trace of each
 * other, and last year's Physics has no bearing on this year's revision.
 *
 * TITLES, NOT BODIES. The notes index carries subjects and titles, never the
 * text. A student's notes can be tens of thousands of words; pasting them into
 * every prompt would blow the context window, cost real money on a metered key,
 * and mostly bury the parts that matter. The model is told what exists and asks
 * for a specific note when it needs one.
 */

import { cache } from 'react';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getViewScope, byClass, byTerm } from '@/lib/scope';
import { getScheduleState } from '@/lib/term';
import { getZonedNow, DEFAULT_TIMEZONE } from '@/lib/utils';
import { getInsightsData } from '@/lib/insights-actions';

export type ContextBlock = {
  subject: string;
  startTime: string;
  endTime: string;
  type: string;
  isDone: boolean;
};

export type ContextExam = {
  title: string;
  subject: string | null;
  date: string;
  daysAway: number;
  kind: string;
};

export type ContextWeakness = {
  subject: string;
  /** Why the app thinks this needs attention, in the app's own words. */
  reason: string;
  attentionScore: number;
  quizAvg: number | null;
  completionRate: number;
};

export type StudyContext = {
  name: string;
  timezone: string;
  /** "Tuesday, 9 September 2026, 19:40" in the student's own zone. */
  localNow: string;
  partOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  yearLabel: string | null;
  termName: string | null;
  termEndsIn: number | null;
  scheduleRunning: boolean;

  subjects: string[];
  todayBlocks: ContextBlock[];
  tomorrowBlocks: ContextBlock[];
  lessonsToday: { subject: string; startTime: string; endTime: string }[];
  upcomingExams: ContextExam[];
  homeworkDue: { subject: string; title: string; dueDate: string; daysAway: number }[];

  /** Subjects the app judges are slipping, worst first. */
  weakAreas: ContextWeakness[];
  strongAreas: string[];
  /** Minutes of finished study in the last seven days, per subject. */
  recentMinutesBySubject: { subject: string; minutes: number }[];

  /** What the student has written, by subject and title. Never the body. */
  notesIndex: { subject: string; title: string }[];

  currentStreak: number;
  level: number;
};

function partOfDay(hour: number): StudyContext['partOfDay'] {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function minutesBetween(startTime: string, endTime: string): number {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let mins = eH * 60 + eM - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // a block that crosses midnight
  return Math.max(0, mins);
}

/** "Math (revision)" and "Math" are one subject to a student, so they are here too. */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/\s*\(revision\)\s*/gi, '')
    .replace(/'/g, '')
    .trim();
}

/**
 * Everything the AI is told, in one round trip.
 *
 * Request-cached: a single page render can ask for this from the server
 * component AND from the action that answers a question, and one assembly is
 * enough. It is a dozen queries; doing them twice on every message would be
 * felt on a pooled connection from Kigali to Frankfurt.
 */
export const buildStudyContext = cache(async function buildStudyContext(): Promise<StudyContext | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const progress = await prisma.userProgress.findUnique({
    where: { userId },
    select: { name: true, timezone: true, currentStreak: true, level: true },
  });

  const timezone = progress?.timezone || DEFAULT_TIMEZONE;
  const now = getZonedNow(timezone);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const scope = await getViewScope(userId);
  const schedule = await getScheduleState(userId);

  const [
    subjectRows,
    todayTaskRows,
    tomorrowTaskRows,
    lessonRows,
    examRows,
    homeworkRows,
    recentDoneRows,
    noteRows,
  ] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, ...byClass(scope) },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.task.findMany({
      where: { userId, ...byTerm(scope), date: { gte: today, lt: tomorrow }, isDeleted: false },
      select: { subject: true, startTime: true, endTime: true, type: true, isDone: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        userId,
        ...byTerm(scope),
        date: { gte: tomorrow, lt: addDays(tomorrow, 1) },
        isDeleted: false,
      },
      select: { subject: true, startTime: true, endTime: true, type: true, isDone: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.schoolLesson.findMany({
      where: { userId, ...byClass(scope), dayOfWeek: now.getDay(), isBreak: false },
      select: { subject: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.examEvent.findMany({
      where: { userId, ...byTerm(scope), date: { gte: today } },
      select: { title: true, date: true, kind: true, subject: { select: { name: true } } },
      orderBy: { date: 'asc' },
      take: 8,
    }),
    prisma.homework.findMany({
      where: { userId, ...byTerm(scope), isCompleted: false, dueDate: { gte: today } },
      select: { subject: true, title: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 12,
    }),
    prisma.task.findMany({
      where: {
        userId,
        ...byTerm(scope),
        isDone: true,
        date: { gte: addDays(today, -7), lte: today },
        isDeleted: false,
      },
      select: { subject: true, startTime: true, endTime: true },
    }),
    // Titles only. See the header: bodies do not belong in a system prompt.
    prisma.studioNote.findMany({
      where: { userId, ...byClass(scope) },
      select: { subject: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }),
  ]);

  // Weak areas come from the same engine the Insights page uses. Deriving a
  // second answer here would let the AI and the app disagree about which
  // subject you are behind on, and the student would have no way to tell which
  // one was lying.
  let weakAreas: ContextWeakness[] = [];
  let strongAreas: string[] = [];
  try {
    const insights = await getInsightsData('class');
    if (insights) {
      const ranked = [...insights.subjects].sort((a, b) => b.attentionScore - a.attentionScore);
      weakAreas = ranked
        .filter((s) => s.attentionScore >= 50)
        .slice(0, 4)
        .map((s) => ({
          subject: s.subject,
          reason: s.reason,
          attentionScore: Math.round(s.attentionScore),
          quizAvg: s.quizAvg,
          completionRate: Math.round(s.completionRate),
        }));
      strongAreas = ranked
        .filter((s) => s.attentionScore < 35)
        .slice(-3)
        .map((s) => s.subject);
    }
  } catch {
    // Insights is a large read and not worth failing an answer over. Without it
    // the AI simply has no opinion about weak areas, which is honest.
  }

  const minutesBySubject = new Map<string, number>();
  for (const task of recentDoneRows) {
    const key = normalizeSubject(task.subject);
    minutesBySubject.set(
      key,
      (minutesBySubject.get(key) ?? 0) + minutesBetween(task.startTime, task.endTime)
    );
  }

  const toBlock = (t: {
    subject: string;
    startTime: string;
    endTime: string;
    type: string;
    isDone: boolean;
  }): ContextBlock => ({
    subject: t.subject,
    startTime: t.startTime,
    endTime: t.endTime,
    type: t.type,
    isDone: t.isDone,
  });

  return {
    name: progress?.name || 'Student',
    timezone,
    localNow: format(now, "EEEE, d MMMM yyyy, HH:mm"),
    partOfDay: partOfDay(now.getHours()),
    yearLabel: schedule.classLabel,
    termName: schedule.termName,
    termEndsIn: schedule.termEndDate
      ? differenceInCalendarDays(startOfDay(schedule.termEndDate), today)
      : null,
    scheduleRunning: schedule.isRunning,

    subjects: subjectRows.map((s) => s.name),
    todayBlocks: todayTaskRows.map(toBlock),
    tomorrowBlocks: tomorrowTaskRows.map(toBlock),
    lessonsToday: lessonRows,
    upcomingExams: examRows.map((e) => ({
      title: e.title,
      subject: e.subject?.name ?? null,
      date: format(e.date, 'EEEE d MMMM'),
      daysAway: differenceInCalendarDays(startOfDay(e.date), today),
      kind: e.kind,
    })),
    homeworkDue: homeworkRows.map((h) => ({
      subject: h.subject,
      title: h.title,
      dueDate: format(h.dueDate, 'EEEE d MMMM'),
      daysAway: differenceInCalendarDays(startOfDay(h.dueDate), today),
    })),

    weakAreas,
    strongAreas,
    recentMinutesBySubject: [...minutesBySubject.entries()]
      .map(([subject, minutes]) => ({ subject, minutes }))
      .sort((a, b) => b.minutes - a.minutes),

    notesIndex: noteRows
      .filter((n) => n.content.trim().length > 0)
      .map((n) => ({ subject: n.subject, title: firstHeading(n.content, n.subject) })),

    currentStreak: progress?.currentStreak ?? 0,
    level: progress?.level ?? 1,
  };
});

/**
 * A note's own title, or the subject as a fallback.
 *
 * StudioNote has no title column - it is one free-text document per subject -
 * so the first markdown heading or first non-empty line is the closest thing to
 * a name the student actually chose.
 */
function firstHeading(content: string, fallback: string): string {
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed) return trimmed.slice(0, 80);
  }
  return fallback;
}

/**
 * Render the context as the block of text the model actually reads.
 *
 * Terse on purpose, and empty sections are dropped entirely. Every line here is
 * paid for on a metered key and competes for the model's attention with the
 * student's actual question - "SUBJECTS: none" teaches it nothing and costs the
 * same as a line that does.
 */
export function renderStudyContext(ctx: StudyContext): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value}`);
  };

  lines.push(`STUDENT: ${ctx.name}`);
  lines.push(`NOW: ${ctx.localNow} (${ctx.timezone})`);
  if (ctx.yearLabel) {
    push(
      'YEAR',
      `${ctx.yearLabel}${ctx.termName ? `, ${ctx.termName}` : ''}` +
        (ctx.termEndsIn !== null && ctx.termEndsIn >= 0 ? ` (ends in ${ctx.termEndsIn} days)` : '')
    );
  }
  if (!ctx.scheduleRunning) {
    lines.push('NOTE: their schedule is currently paused or between terms, so today may be empty.');
  }

  push('SUBJECTS', ctx.subjects.join(', '));

  const block = (b: ContextBlock) =>
    `${b.startTime}-${b.endTime} ${b.subject} (${b.type.toLowerCase()}${b.isDone ? ', done' : ''})`;
  push('TODAY', ctx.todayBlocks.map(block).join(' | '));
  push('TOMORROW', ctx.tomorrowBlocks.map(block).join(' | '));
  push(
    'CLASSES TODAY',
    ctx.lessonsToday.map((l) => `${l.startTime}-${l.endTime} ${l.subject}`).join(' | ')
  );

  push(
    'UPCOMING EXAMS',
    ctx.upcomingExams
      .map(
        (e) =>
          `${e.title}${e.subject ? ` [${e.subject}]` : ''} on ${e.date} (${
            e.daysAway === 0 ? 'today' : `in ${e.daysAway} days`
          })`
      )
      .join(' | ')
  );

  push(
    'HOMEWORK DUE',
    ctx.homeworkDue
      .map((h) => `${h.subject}: ${h.title}, due ${h.dueDate} (${h.daysAway} days)`)
      .join(' | ')
  );

  push(
    'WEAKEST SUBJECTS',
    ctx.weakAreas.map((w) => `${w.subject} - ${w.reason}`).join(' | ')
  );
  push('DOING WELL IN', ctx.strongAreas.join(', '));

  push(
    'STUDIED IN THE LAST 7 DAYS',
    ctx.recentMinutesBySubject.map((r) => `${r.subject} ${r.minutes}min`).join(', ')
  );

  push(
    'THEIR NOTES (titles only - ask for one by name if you need its contents)',
    ctx.notesIndex.map((n) => `${n.subject}: ${n.title}`).join(' | ')
  );

  push('STREAK', `${ctx.currentStreak} days, level ${ctx.level}`);

  return lines.join('\n');
}
