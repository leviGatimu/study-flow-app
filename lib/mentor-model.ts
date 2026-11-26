/**
 * The numbers on a mentor's pages, worked out from plain rows.
 *
 * Pure and free of `@/` imports so `node --test` can load it. Days are
 * "yyyy-MM-dd" keys in the student's own time zone, worked out by the caller;
 * nothing here looks at a clock or a time zone.
 *
 * "Study time" is the length of the blocks the student finished, the same
 * measure the daily and weekly reports use, so the two never disagree.
 */

export type MentorTask = {
  id: string;
  subject: string;
  type: string;
  startTime: string;
  endTime: string;
  /** The block's day, "yyyy-MM-dd", in the student's time zone. */
  day: string;
  isDone: boolean;
  isMissed: boolean;
  /** Minutes spent in focus mode on this block. */
  focusMinutes: number;
};

export type MentorExam = {
  id: string;
  title: string;
  subject: string | null;
  kind: string;
  category: string | null;
  day: string;
  startTime: string | null;
  score: number | null;
  maxScore: number | null;
};

export type MentorHomework = {
  id: string;
  title: string;
  subject: string;
  /** Due day, "yyyy-MM-dd". */
  due: string;
  isCompleted: boolean;
  /** Day it was finished, "yyyy-MM-dd". */
  completed: string | null;
};

export type BlockStatus = 'done' | 'missed' | 'today' | 'upcoming';

const DAY_MS = 86_400_000;

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** The Monday of the week a day falls in. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Length of a block in minutes; one that ends after midnight wraps. */
export function blockMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 1440;
  return Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
}

/** "Math (revision)" and "Math" are the same subject on a mentor's pages. */
export const cleanSubject = (subject: string) => subject.replace(/\s*\(revision\)\s*/gi, '').trim() || 'General';

/**
 * Where a block stands. A past block that was neither ticked nor marked
 * counts as missed: from the outside, it did not happen.
 */
export function blockStatus(t: Pick<MentorTask, 'day' | 'isDone' | 'isMissed'>, today: string): BlockStatus {
  if (t.isDone) return 'done';
  if (t.isMissed || t.day < today) return 'missed';
  return t.day === today ? 'today' : 'upcoming';
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

// ---------------------------------------------------------------------------
// Periods

export type PeriodSummary = {
  plannedMinutes: number;
  doneMinutes: number;
  focusMinutes: number;
  blocksDone: number;
  blocksMissed: number;
  /** Blocks due by today in the period: done + missed. */
  blocksDue: number;
  /** Done / due, whole percent; null with nothing due. */
  completion: number | null;
  /** Days in the period with at least one finished block. */
  activeDays: number;
};

/** A summary of the blocks from `from` to `to`, counting only days up to today. */
export function periodSummary(tasks: MentorTask[], from: string, to: string, today: string): PeriodSummary {
  const last = to < today ? to : today;
  const rows = tasks.filter((t) => t.day >= from && t.day <= last);
  let plannedMinutes = 0;
  let doneMinutes = 0;
  let focusMinutes = 0;
  let blocksDone = 0;
  let blocksMissed = 0;
  const active = new Set<string>();
  for (const t of rows) {
    const minutes = blockMinutes(t.startTime, t.endTime);
    const status = blockStatus(t, today);
    plannedMinutes += minutes;
    focusMinutes += t.focusMinutes;
    if (status === 'done') {
      doneMinutes += minutes;
      blocksDone++;
      active.add(t.day);
    } else if (status === 'missed') {
      blocksMissed++;
    }
  }
  const blocksDue = blocksDone + blocksMissed;
  return {
    plannedMinutes,
    doneMinutes,
    focusMinutes,
    blocksDone,
    blocksMissed,
    blocksDue,
    completion: pct(blocksDone, blocksDue),
    activeDays: active.size,
  };
}

export type DayPoint = { day: string; planned: number; done: number; missed: number; focus: number };

/** Minutes per day from `from` to `to`: planned, done, missed and in focus. */
export function dailySeries(tasks: MentorTask[], from: string, to: string, today: string): DayPoint[] {
  const byDay = new Map<string, DayPoint>();
  for (let day = from; day <= to; day = addDays(day, 1)) byDay.set(day, { day, planned: 0, done: 0, missed: 0, focus: 0 });
  for (const t of tasks) {
    const point = byDay.get(t.day);
    if (!point) continue;
    const minutes = blockMinutes(t.startTime, t.endTime);
    const status = blockStatus(t, today);
    point.planned += minutes;
    point.focus += t.focusMinutes;
    if (status === 'done') point.done += minutes;
    else if (status === 'missed') point.missed += minutes;
  }
  return [...byDay.values()];
}

export type HeatCell = { day: string; minutes: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

/**
 * Study time per day for the last `weeks` whole weeks, Monday first, as
 * columns of seven. Levels are fixed steps (not relative to the best day), so
 * a light week looks light.
 */
export function heatmap(tasks: MentorTask[], today: string, weeks: number): HeatCell[][] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  const series = new Map(dailySeries(tasks, start, addDays(mondayOf(today), 6), today).map((p) => [p.day, p.done]));
  const level = (m: number): HeatCell['level'] => (m <= 0 ? 0 : m < 60 ? 1 : m < 120 ? 2 : m < 180 ? 3 : 4);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      const minutes = series.get(day) ?? 0;
      return { day, minutes, level: level(minutes), future: day > today };
    })
  );
}

// ---------------------------------------------------------------------------
// Subjects

export type SubjectRow = {
  subject: string;
  doneMinutes: number;
  plannedMinutes: number;
  focusMinutes: number;
  blocksDone: number;
  blocksMissed: number;
  completion: number | null;
  /** Last day a block of it was finished. */
  lastStudied: string | null;
  /** Average mark as a percent, from marked exams. */
  average: number | null;
  marks: number;
  /** The next exam in it, if one is set. */
  nextExam: { title: string; day: string } | null;
  /** Done minutes per week, the last 6 weeks, oldest first. */
  weekly: number[];
};

export function subjectRows(tasks: MentorTask[], exams: MentorExam[], from: string, today: string): SubjectRow[] {
  const rows = new Map<string, SubjectRow>();
  const row = (name: string) => {
    let r = rows.get(name);
    if (!r) {
      r = {
        subject: name,
        doneMinutes: 0,
        plannedMinutes: 0,
        focusMinutes: 0,
        blocksDone: 0,
        blocksMissed: 0,
        completion: null,
        lastStudied: null,
        average: null,
        marks: 0,
        nextExam: null,
        weekly: [0, 0, 0, 0, 0, 0],
      };
      rows.set(name, r);
    }
    return r;
  };

  const firstWeek = addDays(mondayOf(today), -35);
  for (const t of tasks) {
    if (t.day > today) continue;
    const r = row(cleanSubject(t.subject));
    const minutes = blockMinutes(t.startTime, t.endTime);
    const status = blockStatus(t, today);
    if (status === 'done' && t.day >= firstWeek) {
      r.weekly[Math.floor(daysBetween(firstWeek, t.day) / 7)] += minutes;
    }
    if (t.day < from) continue;
    r.plannedMinutes += minutes;
    r.focusMinutes += t.focusMinutes;
    if (status === 'done') {
      r.doneMinutes += minutes;
      r.blocksDone++;
      if (!r.lastStudied || t.day > r.lastStudied) r.lastStudied = t.day;
    } else if (status === 'missed') {
      r.blocksMissed++;
    }
  }

  const percents = new Map<string, number[]>();
  for (const e of exams) {
    if (!e.subject) continue;
    const name = cleanSubject(e.subject);
    const p = examPercent(e);
    if (p !== null && e.day <= today) percents.set(name, [...(percents.get(name) ?? []), p]);
    if (e.day >= today && p === null) {
      const r = row(name);
      if (!r.nextExam || e.day < r.nextExam.day) r.nextExam = { title: e.title, day: e.day };
    }
  }
  for (const [name, list] of percents) {
    const r = row(name);
    r.marks = list.length;
    r.average = Math.round(list.reduce((s, p) => s + p, 0) / list.length);
  }

  return [...rows.values()]
    .map((r) => ({ ...r, completion: pct(r.blocksDone, r.blocksDone + r.blocksMissed) }))
    .filter((r) => r.plannedMinutes > 0 || r.marks > 0 || r.nextExam || r.weekly.some((m) => m > 0))
    .sort((a, b) => b.doneMinutes - a.doneMinutes || b.plannedMinutes - a.plannedMinutes || a.subject.localeCompare(b.subject));
}

// ---------------------------------------------------------------------------
// Marks

export function examPercent(e: Pick<MentorExam, 'score' | 'maxScore'>): number | null {
  if (e.score === null || e.maxScore === null || !(e.maxScore > 0)) return null;
  return Math.round((e.score / e.maxScore) * 100);
}

export type MarkRow = MentorExam & { percent: number };

export type MarksSummary = {
  /** Marked exams, newest first. */
  marked: MarkRow[];
  average: number | null;
  /** Average of the latest 3 against the 3 before them; null with fewer than 4. */
  trend: number | null;
  best: MarkRow | null;
  lowest: MarkRow | null;
  /** Exams still to come, soonest first. */
  upcoming: MentorExam[];
  /** Exams sat but not marked yet. */
  awaiting: MentorExam[];
};

export function marksSummary(exams: MentorExam[], today: string): MarksSummary {
  const marked: MarkRow[] = exams
    .map((e) => ({ ...e, percent: examPercent(e) }))
    .filter((e): e is MarkRow => e.percent !== null && e.day <= today)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const avg = (rows: MarkRow[]) => (rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : null);
  const trend = marked.length >= 4 ? (avg(marked.slice(0, 3)) as number) - (avg(marked.slice(3, 6)) as number) : null;
  const byPercent = [...marked].sort((a, b) => b.percent - a.percent);
  return {
    marked,
    average: avg(marked),
    trend,
    best: byPercent[0] ?? null,
    lowest: byPercent.length > 1 ? byPercent[byPercent.length - 1] : null,
    upcoming: exams.filter((e) => e.day >= today && examPercent(e) === null).sort((a, b) => a.day.localeCompare(b.day)),
    awaiting: exams.filter((e) => e.day < today && examPercent(e) === null).sort((a, b) => b.day.localeCompare(a.day)),
  };
}

/** A mark as a letter band, matching the colour the pages give it. */
export function markBand(percent: number): 'great' | 'good' | 'fair' | 'low' {
  if (percent >= 80) return 'great';
  if (percent >= 65) return 'good';
  if (percent >= 50) return 'fair';
  return 'low';
}

// ---------------------------------------------------------------------------
// Homework

export type HomeworkBuckets = {
  late: MentorHomework[];
  /** Due today or in the next 3 days. */
  soon: MentorHomework[];
  later: MentorHomework[];
  /** Finished in the last 30 days, newest first. */
  done: MentorHomework[];
  /** Finished on or before the due day, of those finished in the last 30 days. */
  onTime: number | null;
};

export function homeworkBuckets(rows: MentorHomework[], today: string): HomeworkBuckets {
  const open = rows.filter((h) => !h.isCompleted).sort((a, b) => a.due.localeCompare(b.due));
  const soonEnd = addDays(today, 3);
  const since = addDays(today, -30);
  const done = rows
    .filter((h) => h.isCompleted && (h.completed ?? h.due) >= since)
    .sort((a, b) => (b.completed ?? b.due).localeCompare(a.completed ?? a.due));
  const onTime = done.filter((h) => (h.completed ?? h.due) <= h.due).length;
  return {
    late: open.filter((h) => h.due < today),
    soon: open.filter((h) => h.due >= today && h.due <= soonEnd),
    later: open.filter((h) => h.due > soonEnd),
    done,
    onTime: pct(onTime, done.length),
  };
}

// ---------------------------------------------------------------------------
// Words

/** "9h 40m", "45m", "0m". */
export function hoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** "+2h 10m" / "−45m" / "same" against an earlier amount; null without one. */
export function changeLabel(now: number, before: number | null): { text: string; up: boolean | null } | null {
  if (before === null) return null;
  const diff = now - before;
  if (diff === 0) return { text: 'same', up: null };
  return { text: `${diff > 0 ? '+' : '−'}${hoursMinutes(Math.abs(diff))}`, up: diff > 0 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu 26 Nov". */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** "Today", "Tomorrow", "in 5 days", "yesterday", "3 days ago". */
export function relativeDay(day: string, today: string): string {
  const n = daysBetween(today, day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
