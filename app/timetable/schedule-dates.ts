import { format, isValid } from 'date-fns';

/**
 * URL date keys for the Schedule section. Week and Month keep the period they
 * show in the URL (?week=2026-09-21, ?month=2026-09) so it survives a refresh,
 * can be linked to from another page, and the server only reads that period.
 */

/** "yyyy-MM-dd" as a local calendar date, or null when absent or malformed. */
export function parseDayKey(value: string | string[] | undefined): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects 2026-02-31, which Date would silently roll into March.
  return isValid(date) && date.getMonth() === m - 1 ? date : null;
}

/** "yyyy-MM" as the first day of that month, or null. */
export function parseMonthKey(value: string | string[] | undefined): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');
export const monthKey = (date: Date) => format(date, 'yyyy-MM');

export const weekHref = (weekStart: Date) => `/timetable?week=${dayKey(weekStart)}`;
export const monthHref = (month: Date) => `/calendar?month=${monthKey(month)}`;
