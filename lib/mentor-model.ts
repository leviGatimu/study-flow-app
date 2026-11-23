/**
 * The numbers on a mentor's dashboard, worked out from plain rows.
 *
 * Pure and free of `@/` imports so `node --test` can load it. Days are
 * "yyyy-MM-dd" keys in the student's own time zone, computed by the caller;
 * nothing here looks at a clock or a time zone.
 *
 * "Study time" means the length of the blocks the student finished, the same
 * measure the daily and weekly reports use, so the two never disagree.
 */

export type MentorTask = {
  subject: string;
  startTime: string;
  endTime: string;
  /** The block's day, "yyyy-MM-dd", in the student's time zone. */
  day: string;
  isDone: boolean;
  isMissed: boolean;
};

export type MentorExam = {
  title: string;
  subject: string | null;
  day: string;
  score: number | null;
  maxScore: number | null;
};

export type MentorWeek = {
  doneMinutes: number;
  /** Change against the week before, in minutes; null when last week had nothing at all. */
  changeMinutes: number | null;
  blocksDone: number;
  /** Blocks that were due by today this week: today and earlier. */
  blocksDue: number;
  /** blocksDone / blocksDue as a whole percentage; null with nothing due. */
  completion: number | null;
};

export type MentorDay = { day: string; minutes: number };

export type MentorSubject = { subject: string; done: number; missed: number; minutes: number; completion: number };

export type MentorMark = { title: string; subject: string | null; day: string; percent: number };

export type MentorStats = {
  week: MentorWeek;
  last14: MentorDay[];
  subjects: MentorSubject[];
  marks: { average: number | null; recent: MentorMark[]; count: number };
};

const DAY_MS = 86_400_000;

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
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

const cleanSubject = (subject: string) => subject.replace(/\s*\(revision\)\s*/gi, '').trim() || 'General';

function doneMinutesBetween(tasks: MentorTask[], from: string, to: string): number {
  return tasks
    .filter((t) => t.isDone && t.day >= from && t.day <= to)
    .reduce((sum, t) => sum + blockMinutes(t.startTime, t.endTime), 0);
}

export function mentorStats(tasks: MentorTask[], exams: MentorExam[], today: string): MentorStats {
  // This week, Monday to today, against the whole of last week.
  const monday = mondayOf(today);
  const thisWeek = tasks.filter((t) => t.day >= monday && t.day <= today);
  const doneMinutes = doneMinutesBetween(tasks, monday, today);
  const lastWeekTasks = tasks.filter((t) => t.day >= addDays(monday, -7) && t.day <= addDays(monday, -1));
  const lastWeekMinutes = doneMinutesBetween(tasks, addDays(monday, -7), addDays(monday, -1));
  const blocksDone = thisWeek.filter((t) => t.isDone).length;
  const blocksDue = thisWeek.length;

  // Study time per day, the last 14 days ending today.
  const last14: MentorDay[] = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, minutes: doneMinutesBetween(tasks, day, day) };
  });

  // Each subject's record over the last 30 days, most time first.
  const since = addDays(today, -29);
  const bySubject = new Map<string, MentorSubject>();
  for (const t of tasks) {
    if (t.day < since || t.day > today || (!t.isDone && !t.isMissed)) continue;
    const name = cleanSubject(t.subject);
    const s = bySubject.get(name) ?? { subject: name, done: 0, missed: 0, minutes: 0, completion: 0 };
    if (t.isDone) {
      s.done++;
      s.minutes += blockMinutes(t.startTime, t.endTime);
    } else {
      s.missed++;
    }
    bySubject.set(name, s);
  }
  const subjects = [...bySubject.values()]
    .map((s) => ({ ...s, completion: Math.round((s.done / (s.done + s.missed)) * 100) }))
    .sort((a, b) => b.minutes - a.minutes || b.done - a.done || a.subject.localeCompare(b.subject));

  // Marked exams: a percentage each, so every subject counts the same.
  const marked: MentorMark[] = exams
    .filter((e) => e.score !== null && e.maxScore !== null && e.maxScore > 0 && e.day <= today)
    .map((e) => ({ title: e.title, subject: e.subject, day: e.day, percent: Math.round(((e.score as number) / (e.maxScore as number)) * 100) }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const average = marked.length ? Math.round(marked.reduce((sum, m) => sum + m.percent, 0) / marked.length) : null;

  return {
    week: {
      doneMinutes,
      changeMinutes: lastWeekTasks.length === 0 ? null : doneMinutes - lastWeekMinutes,
      blocksDone,
      blocksDue,
      completion: blocksDue ? Math.round((blocksDone / blocksDue) * 100) : null,
    },
    last14,
    subjects,
    marks: { average, recent: marked.slice(0, 6), count: marked.length },
  };
}

/** "9h 40m", "45m", "0m". */
export function hoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** "+2h 10m" / "−45m" / "same as last week". */
export function changeLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 0) return 'same as last week';
  return `${minutes > 0 ? '+' : '−'}${hoursMinutes(Math.abs(minutes))} vs last week`;
}

