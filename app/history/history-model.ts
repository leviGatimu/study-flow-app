/** What the completed-work page works out from study blocks. No browser or database needed. */

export type LogTask = {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  date: Date | string;
  isDone: boolean;
  isMissed: boolean;
};

export function taskMinutes(task: Pick<LogTask, 'startTime' | 'endTime'>): number {
  const [startHour, startMinute] = task.startTime.split(':').map(Number);
  const [endHour, endMinute] = task.endTime.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 1440; // crosses midnight
  return Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
}

export const cleanSubject = (subject: string) => subject.replace(/\s*\(revision\)\s*/gi, '').trim();

export type SubjectScore = { subject: string; done: number; missed: number; minutes: number; completion: number };

/** Each subject's record, most time first. "Math" and "Math (revision)" are one subject. */
export function subjectScores(tasks: LogTask[]): SubjectScore[] {
  const scores = new Map<string, SubjectScore>();
  for (const task of tasks) {
    if (!task.isDone && !task.isMissed) continue;
    const subject = cleanSubject(task.subject) || 'General';
    const score = scores.get(subject) ?? { subject, done: 0, missed: 0, minutes: 0, completion: 0 };
    if (task.isDone) {
      score.done++;
      score.minutes += taskMinutes(task);
    } else {
      score.missed++;
    }
    scores.set(subject, score);
  }
  return [...scores.values()]
    .map((score) => ({ ...score, completion: Math.round((score.done / (score.done + score.missed)) * 100) }))
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));
}

export type LogDay<T> = { key: string; date: Date; tasks: T[]; minutes: number };

/** Consecutive tasks on one calendar day, keeping the order they were given in. */
export function groupByDay<T extends LogTask>(tasks: T[], dayKey: (date: Date) => string): LogDay<T>[] {
  const days: LogDay<T>[] = [];
  for (const task of tasks) {
    const date = new Date(task.date);
    const key = dayKey(date);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, date, tasks: [], minutes: 0 };
      days.push(day);
    }
    day.tasks.push(task);
    if (task.isDone) day.minutes += taskMinutes(task);
  }
  return days;
}

/** The change against the period before, as words. Null when there is nothing to compare with. */
export function changeLabel(current: number, previous: number, unit = ''): string | null {
  if (previous === 0 && current === 0) return null;
  const difference = current - previous;
  if (difference === 0) return 'Same as the period before';
  return `${difference > 0 ? '+' : ''}${difference}${unit} on the period before`;
}

/** The day with the most finished study time. Null when nothing was finished. */
export function bestDay(tasks: LogTask[], dayKey: (date: Date) => string): { date: Date; minutes: number } | null {
  const totals = new Map<string, { date: Date; minutes: number }>();
  for (const task of tasks) {
    if (!task.isDone) continue;
    const date = new Date(task.date);
    const key = dayKey(date);
    const total = totals.get(key) ?? { date, minutes: 0 };
    total.minutes += taskMinutes(task);
    totals.set(key, total);
  }
  return [...totals.values()].reduce<{ date: Date; minutes: number } | null>((best, day) => (!best || day.minutes > best.minutes ? day : best), null);
}
