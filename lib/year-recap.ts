/**
 * A finished year, told as highlights: the Year home page and the recap story
 * both read this. Pure (no database, no timezone maths): the loader hands it
 * each block's day already as "yyyy-MM-dd" in the student's timezone, so the
 * rules are tested on their own in test/year-recap.test.mjs.
 *
 * "Time studied" is the length of every block ticked off, the measure the rest
 * of the app (reports, Year & terms) already uses. Focus time is reported
 * separately, from real focus sessions, because not every block is run through
 * the focus timer.
 */

export type RecapTask = {
  /** "yyyy-MM-dd" in the student's timezone. */
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  type: string;
  isDone: boolean;
  isMissed: boolean;
};

export type RecapExam = {
  title: string;
  subject: string | null;
  category: string | null;
  score: number | null;
  maxScore: number | null;
};

export type RecapInput = {
  label: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  tasks: RecapTask[];
  /** Seconds of each finished focus session. */
  focusSessions: number[];
  homework: { isCompleted: boolean; onTime: boolean }[];
  exams: RecapExam[];
  /** Practice attempt scores, 0-100. */
  practiceScores: number[];
  xp: number;
  terms: { name: string; grade: string | null; minutes: number }[];
  /** Overall grade letter for the year, when a summary exists. */
  grade: string | null;
};

export type SubjectShare = { subject: string; minutes: number; share: number };

export type YearRecap = {
  label: string;
  startedAt: string;
  completedAt: string | null;
  grade: string | null;

  minutes: number;
  focusMinutes: number;
  focusSessions: number;
  longestSessionMinutes: number;

  blocksDone: number;
  blocksMissed: number;
  blocksPlanned: number;
  /** Done out of planned, 0-100. */
  completion: number;
  homeworkBlocks: number;
  revisionBlocks: number;

  activeDays: number;
  longestRun: number;

  /** One entry per calendar month the year covers, in order. */
  months: { key: string; minutes: number }[];
  busiestMonth: { key: string; minutes: number } | null;
  bestDay: { day: string; minutes: number } | null;
  /** 0 Sunday to 6 Saturday. */
  busiestWeekday: { weekday: number; minutes: number } | null;
  /** Hour of day (0-23) most study started in. */
  favouriteHour: number | null;

  subjects: SubjectShare[];

  homeworkDone: number;
  homeworkOnTime: number;

  examsTaken: number;
  examsMarked: number;
  examAverage: number | null;
  bestExam: { title: string; subject: string | null; percent: number } | null;

  practiceAttempts: number;
  practiceAverage: number | null;
  practiceBest: number | null;

  xp: number;
  terms: { name: string; grade: string | null; minutes: number }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function blockMinutes(startTime: string, endTime: string): number {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if ([sH, sM, eH, eM].some((n) => Number.isNaN(n))) return 0;
  let mins = eH * 60 + eM - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // crosses midnight
  return Math.max(0, mins);
}

/** "Math (revision)" and "Math" are one subject. */
function cleanSubject(subject: string): string {
  return subject.replace(/\s*\(revision\)\s*/gi, '').replace(/\s+/g, ' ').trim() || subject;
}

const monthKey = (day: string) => day.slice(0, 7);

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Every "yyyy-MM" from the first to the last, so empty months show as gaps. */
function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length > 36) break; // a "year" never spans three; guard bad dates
  }
  return out;
}

function maxBy<T>(items: T[], value: (t: T) => number): T | null {
  let best: T | null = null;
  for (const item of items) if (best === null || value(item) > value(best)) best = item;
  return best;
}

/** Longest run of consecutive days in a sorted list of distinct day keys. */
export function longestRun(days: string[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && nextDay(prev) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

function percent(score: number | null, max: number | null): number | null {
  if (score === null || max === null || !(max > 0)) return null;
  return round1((score / max) * 100);
}

const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function buildYearRecap(input: RecapInput): YearRecap {
  const done = input.tasks.filter((t) => t.isDone);
  const minutesOf = (t: RecapTask) => blockMinutes(t.startTime, t.endTime);

  const bySubject = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byWeekday = new Map<number, number>();
  const byHour = new Map<number, number>();
  let minutes = 0;
  for (const t of done) {
    const m = minutesOf(t);
    minutes += m;
    const subject = cleanSubject(t.subject);
    bySubject.set(subject, (bySubject.get(subject) ?? 0) + m);
    byDay.set(t.day, (byDay.get(t.day) ?? 0) + m);
    const weekday = new Date(`${t.day}T00:00:00Z`).getUTCDay();
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + m);
    const hour = Number(t.startTime.split(':')[0]);
    if (!Number.isNaN(hour)) byHour.set(hour, (byHour.get(hour) ?? 0) + m);
  }

  const days = [...byDay.keys()].sort();
  const allDays = input.tasks.map((t) => t.day).sort();
  const months = allDays.length
    ? monthRange(monthKey(allDays[0]), monthKey(allDays[allDays.length - 1])).map((key) => ({
        key,
        minutes: done.filter((t) => monthKey(t.day) === key).reduce((s, t) => s + minutesOf(t), 0),
      }))
    : [];

  const subjects = [...bySubject.entries()]
    .map(([subject, m]) => ({ subject, minutes: m, share: minutes ? Math.round((m / minutes) * 100) : 0 }))
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));

  const bestDayEntry = maxBy([...byDay.entries()], ([, m]) => m);
  const weekdayEntry = maxBy([...byWeekday.entries()], ([, m]) => m);
  const hourEntry = maxBy([...byHour.entries()], ([, m]) => m);
  const busiestMonth = maxBy(months.filter((m) => m.minutes > 0), (m) => m.minutes);

  const marked = input.exams
    .map((e) => ({ e, p: percent(e.score, e.maxScore) }))
    .filter((x): x is { e: RecapExam; p: number } => x.p !== null);
  const best = maxBy(marked, (x) => x.p);

  const focusSeconds = input.focusSessions.reduce((a, b) => a + b, 0);
  const planned = input.tasks.length;

  return {
    label: input.label,
    startedAt: new Date(input.startedAt).toISOString(),
    completedAt: input.completedAt ? new Date(input.completedAt).toISOString() : null,
    grade: input.grade,

    minutes,
    focusMinutes: Math.round(focusSeconds / 60),
    focusSessions: input.focusSessions.length,
    longestSessionMinutes: Math.round(Math.max(0, ...input.focusSessions) / 60),

    blocksDone: done.length,
    blocksMissed: input.tasks.filter((t) => t.isMissed && !t.isDone).length,
    blocksPlanned: planned,
    completion: planned ? Math.round((done.length / planned) * 100) : 0,
    homeworkBlocks: done.filter((t) => t.type === 'HOMEWORK').length,
    revisionBlocks: done.filter((t) => t.type === 'REVISION').length,

    activeDays: days.length,
    longestRun: longestRun(days),

    months,
    busiestMonth,
    bestDay: bestDayEntry ? { day: bestDayEntry[0], minutes: bestDayEntry[1] } : null,
    busiestWeekday: weekdayEntry ? { weekday: weekdayEntry[0], minutes: weekdayEntry[1] } : null,
    favouriteHour: hourEntry ? hourEntry[0] : null,

    subjects,

    homeworkDone: input.homework.filter((h) => h.isCompleted).length,
    homeworkOnTime: input.homework.filter((h) => h.isCompleted && h.onTime).length,

    examsTaken: input.exams.length,
    examsMarked: marked.length,
    examAverage: mean(marked.map((x) => x.p)),
    bestExam: best ? { title: best.e.title, subject: best.e.subject, percent: best.p } : null,

    practiceAttempts: input.practiceScores.length,
    practiceAverage: mean(input.practiceScores),
    practiceBest: input.practiceScores.length ? Math.max(...input.practiceScores) : null,

    xp: input.xp,
    terms: input.terms,
  };
}

/** Whole hours, rounded; "0" only when nothing was studied. */
export function hours(minutes: number): number {
  return Math.round(minutes / 60);
}

/** A plain description of when someone studies, from their favourite hour. */
export function studyTimeLabel(hour: number | null): string | null {
  if (hour === null) return null;
  if (hour < 5) return 'You studied deep into the night.';
  if (hour < 9) return 'An early riser: you got to work before most people were up.';
  if (hour < 12) return 'Mornings were your time.';
  if (hour < 17) return 'Afternoons were your time.';
  if (hour < 21) return 'Evenings were your time.';
  return 'A night owl: most of your work started after 9 pm.';
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-03" -> "March 2026". */
export function monthName(key: string, withYear = true): string {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}
