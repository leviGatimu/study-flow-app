/**
 * Birthdays. Stored on UserProgress.birthday as "MM-DD", or "YYYY-MM-DD" when
 * the student gave a year (only used to say which birthday it is). Pure and
 * free of `@/` imports so `node --test` can load it (test/birthday.test.mjs).
 *
 * A 29 February birthday is celebrated on 28 February in years without one.
 */

export type Birthday = { month: number; day: number; year: number | null };

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** "MM-DD" or "YYYY-MM-DD" into parts, or null for anything that is not a real date. */
export function parseBirthday(value: string | null | undefined): Birthday | null {
  if (!value) return null;
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = m[1] ? Number(m[1]) : null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  if (year !== null) {
    if (year < 1900 || year > 2100) return null;
    if (month === 2 && day === 29 && !isLeap(year)) return null;
  }
  return { month, day, year };
}

/** The stored form for a chosen month, day and optional year, or an error to show. */
export function formatBirthday(month: number, day: number, year?: number | null): { value: string } | { error: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const value = year ? `${year}-${pad(month)}-${pad(day)}` : `${pad(month)}-${pad(day)}`;
  return parseBirthday(value) ? { value } : { error: 'That is not a real date. Check the day and month.' };
}

/** The "YYYY-MM-DD" key of the birthday in a given year (29 Feb moves to the 28th when needed). */
export function birthdayKeyIn(b: Birthday, year: number): string {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return `${year}-${String(b.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whether a "YYYY-MM-DD" day is the birthday. */
export function isBirthdayOn(b: Birthday | null, dayKey: string): boolean {
  if (!b) return false;
  const year = Number(dayKey.slice(0, 4));
  return Number.isFinite(year) && birthdayKeyIn(b, year) === dayKey;
}

/** Which birthday a day is (18 for an 18th), or null without a year or before birth. */
export function ageOn(b: Birthday | null, dayKey: string): number | null {
  if (!b || b.year === null) return null;
  const age = Number(dayKey.slice(0, 4)) - b.year;
  return age > 0 ? age : null;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd... */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Every birthday date key between two "YYYY-MM-DD" keys, inclusive (for a calendar view). */
export function birthdayKeysBetween(b: Birthday | null, fromKey: string, toKey: string): string[] {
  if (!b) return [];
  const out: string[] = [];
  for (let y = Number(fromKey.slice(0, 4)); y <= Number(toKey.slice(0, 4)); y++) {
    const key = birthdayKeyIn(b, y);
    if (key >= fromKey && key <= toKey) out.push(key);
  }
  return out;
}

/** "14 March" (and the year when known), for labels. */
export function birthdayLabel(b: Birthday): string {
  return `${b.day} ${MONTH_NAMES[b.month - 1]}${b.year ? ` ${b.year}` : ''}`;
}
