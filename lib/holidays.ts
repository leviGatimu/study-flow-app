/**
 * Public holidays: days the study routine does not run.
 *
 * Computed, never stored. Holidays are facts about a country's calendar, not
 * the user's data, so there is nothing to sync and nothing to migrate - and a
 * rule fixed here reaches every install at once.
 *
 * The country comes from the user's timezone. Only Rwanda is known so far; any
 * other timezone gets no holidays rather than someone else's.
 *
 * Pure and dependency-free so `node --test` can import it directly.
 */

export type Holiday = {
  /** Calendar date in the user's timezone, "YYYY-MM-DD". */
  date: string;
  name: string;
  /** A weekday off standing in for a holiday that fell on a weekend. */
  inLieu?: boolean;
  /** Moon-sighted: announced a day or two before, so the date is a forecast. */
  approximate?: boolean;
};

type Country = 'RW';

const TIMEZONE_COUNTRY: Record<string, Country> = {
  'Africa/Kigali': 'RW',
};

export function countryForTimezone(timezone: string): Country | null {
  return TIMEZONE_COUNTRY[timezone] ?? null;
}

/**
 * Eid dates follow the moon, so they cannot be computed - these are the
 * forecasts. Years missing here simply have no Eid holiday: add the next
 * years before they arrive.
 */
const RW_EID: Record<number, { fitr: string; adha: string }> = {
  2026: { fitr: '2026-03-20', adha: '2026-05-27' },
  2027: { fitr: '2027-03-09', adha: '2027-05-16' },
  2028: { fitr: '2028-02-26', adha: '2028-05-05' },
  2029: { fitr: '2029-02-14', adha: '2029-04-24' },
  2030: { fitr: '2030-02-05', adha: '2030-04-13' },
};

/** Presidential Order N° 54/01 of 24/02/2017. */
function rwandaHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed: Holiday[] = [
    { date: key(year, 1, 1), name: "New Year's Day" },
    { date: key(year, 1, 2), name: 'New Year holiday' },
    { date: key(year, 2, 1), name: "National Heroes' Day" },
    { date: shift(easter, -2), name: 'Good Friday' },
    { date: shift(easter, 1), name: 'Easter Monday' },
    { date: key(year, 4, 7), name: 'Genocide against the Tutsi Memorial Day' },
    { date: key(year, 5, 1), name: 'Labour Day' },
    { date: key(year, 7, 1), name: 'Independence Day' },
    { date: key(year, 7, 4), name: 'Liberation Day' },
    { date: firstWeekday(year, 8, 5), name: 'Umuganura Day' },
    { date: key(year, 8, 15), name: 'Assumption Day' },
    { date: key(year, 12, 25), name: 'Christmas Day' },
    { date: key(year, 12, 26), name: 'Boxing Day' },
  ];
  const eid = RW_EID[year];
  if (eid) {
    fixed.push({ date: eid.fitr, name: 'Eid al-Fitr', approximate: true });
    fixed.push({ date: eid.adha, name: 'Eid al-Adha', approximate: true });
  }
  fixed.sort((a, b) => a.date.localeCompare(b.date));

  // A holiday on a Saturday or Sunday gives the next free weekday off instead
  // - except the Memorial Day, which the order exempts. "Free" matters:
  // Christmas on a Saturday and Boxing Day on a Sunday need two weekdays.
  const taken = new Set(fixed.map((h) => h.date));
  const inLieu: Holiday[] = [];
  for (const h of fixed) {
    if (h.name.startsWith('Genocide')) continue;
    if (!isWeekend(h.date)) continue;
    let d = shift(h.date, 1);
    while (isWeekend(d) || taken.has(d)) d = shift(d, 1);
    taken.add(d);
    inLieu.push({ date: d, name: `${h.name} (in lieu)`, inLieu: true, approximate: h.approximate });
  }

  return [...fixed, ...inLieu].sort((a, b) => a.date.localeCompare(b.date));
}

export function holidaysForYear(country: Country, year: number): Holiday[] {
  switch (country) {
    case 'RW':
      return rwandaHolidays(year);
  }
}

/**
 * Every holiday from `from` to `to` inclusive ("YYYY-MM-DD" keys), keyed by
 * date. Empty for a timezone with no known country.
 */
export function holidaysBetween(timezone: string, from: string, to: string): Map<string, Holiday> {
  const country = countryForTimezone(timezone);
  const result = new Map<string, Holiday>();
  if (!country || from > to) return result;
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    for (const h of holidaysForYear(country, year)) {
      // Two holidays on one date (Eid on Labour Day): keep the first.
      if (h.date >= from && h.date <= to && !result.has(h.date)) result.set(h.date, h);
    }
  }
  return result;
}

export function holidayOn(timezone: string, date: string): Holiday | null {
  return holidaysBetween(timezone, date, date).get(date) ?? null;
}

// --- calendar arithmetic, all on UTC so the host's timezone never leaks in ---

function key(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** First `weekday` (0 = Sunday) of the month. */
function firstWeekday(year: number, month: number, weekday: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return key(year, month, 1 + ((weekday - first + 7) % 7));
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}
