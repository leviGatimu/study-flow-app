/**
 * Where a study block sits against the clock, for the Focus page ("Now",
 * "in 25 min", "started 10 min ago"). Pure and tested in
 * test/focus-plan.test.mjs. Times are "HH:MM"; an end at or before the start
 * ("23:00–00:00") runs past midnight.
 */

export type BlockTiming =
  | { state: 'now'; minutesLeft: number }
  | { state: 'soon'; minutesUntil: number }
  | { state: 'later'; minutesUntil: number }
  | { state: 'past'; minutesSinceEnd: number };

/** "HH:MM" to minutes after midnight; null for anything malformed. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** Length of a block in minutes, wrapping past midnight. */
export function blockLength(start: string, end: string): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return 0;
  return e > s ? e - s : e + 1440 - s;
}

/** A block starting within this many minutes counts as "soon". */
export const SOON_MINUTES = 60;

export function blockTiming(start: string, end: string, nowMinutes: number): BlockTiming | null {
  const s = toMinutes(start);
  if (s === null) return null;
  const e = s + blockLength(start, end);
  if (nowMinutes >= s && nowMinutes < e) return { state: 'now', minutesLeft: e - nowMinutes };
  if (nowMinutes < s) {
    const until = s - nowMinutes;
    return until <= SOON_MINUTES ? { state: 'soon', minutesUntil: until } : { state: 'later', minutesUntil: until };
  }
  return { state: 'past', minutesSinceEnd: nowMinutes - e };
}

/** "45 min", "1 h", "1 h 20 min". */
export function formatMinutes(total: number): string {
  const value = Math.max(0, Math.round(total));
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
