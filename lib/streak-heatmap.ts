/**
 * The Streak page's year grid, its week strip and milestones.
 *
 * Pure and keyed by calendar date ("yyyy-MM-dd") so it can be tested and so
 * the browser never re-buckets a timestamp into a different day: the server
 * formats each day key in the frame the task dates were written in.
 */

export type HeatCell = {
  key: string;
  minutes: number;
  /** 0 nothing, 1 under 1 h, 2 under 2 h, 3 under 3 h, 4 three hours or more. */
  level: 0 | 1 | 2 | 3 | 4;
  /** After today: drawn empty and not counted. */
  future: boolean;
};

export type HeatWeek = { cells: HeatCell[]; /** Month name when this week starts a new month. */ month: string | null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

const toTime = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const toKey = (time: number) => new Date(time).toISOString().slice(0, 10);
/** Monday = 0 ... Sunday = 6. */
const weekday = (time: number) => (new Date(time).getUTCDay() + 6) % 7;

export function levelOf(minutes: number): HeatCell['level'] {
  if (minutes <= 0) return 0;
  if (minutes < 60) return 1;
  if (minutes < 120) return 2;
  if (minutes < 180) return 3;
  return 4;
}

/**
 * `weeks` columns ending with the week that holds `today`, Monday first.
 * A day studied with no measured minutes still counts as level 1.
 */
export function buildHeatmap(
  minutesByDay: Record<string, number>,
  studied: Iterable<string>,
  today: string,
  weeks = 53
): HeatWeek[] {
  const active = new Set(studied);
  const now = toTime(today);
  const start = now - weekday(now) * DAY - (weeks - 1) * 7 * DAY;
  const out: HeatWeek[] = [];
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    const cells: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const time = start + (w * 7 + d) * DAY;
      const key = toKey(time);
      const minutes = Math.max(0, Math.round(minutesByDay[key] ?? 0));
      const future = time > now;
      const level = future ? 0 : minutes > 0 ? levelOf(minutes) : active.has(key) ? 1 : 0;
      cells.push({ key, minutes: future ? 0 : minutes, level, future });
    }
    const month = new Date(start + w * 7 * DAY).getUTCMonth();
    out.push({ cells, month: month !== lastMonth ? MONTHS[month] : null });
    lastMonth = month;
  }
  // A label on the very first column is usually a cut-off month; drop it
  // when the next label is too close to read.
  if (out[0]?.month && out.slice(1, 3).some((w) => w.month)) out[0].month = null;
  return out;
}

/** Monday to Sunday of the current week, each studied or not. */
export function thisWeek(studied: Iterable<string>, today: string) {
  const active = new Set(studied);
  const now = toTime(today);
  const monday = now - weekday(now) * DAY;
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
    const time = monday + i * DAY;
    const key = toKey(time);
    return { label, key, studied: active.has(key), isToday: time === now, future: time > now };
  });
}

export const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365] as const;

/** Each milestone, reached when the best streak got there. */
export function milestones(best: number) {
  return MILESTONES.map((days) => ({ days, reached: best >= days }));
}

/** The next milestone after the current streak, or null past the last one. */
export function nextMilestone(current: number) {
  const next = MILESTONES.find((days) => days > current);
  return next ? { days: next, left: next - current } : null;
}
