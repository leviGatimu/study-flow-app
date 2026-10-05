/**
 * Finding the next time the study routine comes back to a subject.
 *
 * Pure and dependency-free (date keys and minutes, no Date in a timezone) so
 * `node --test` can import it directly.
 */

export type RoutineTemplate = {
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  type: string;
};

export type RoutineSlot = RoutineTemplate & {
  /** "YYYY-MM-DD" in the student's timezone. */
  date: string;
  /** 0 = today, 1 = tomorrow, ... */
  daysAway: number;
};

/** "Physics (Revision)" and "physics" are the same subject. */
export function sameSubject(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').trim().toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The next routine block for `subject` within two weeks: later today if one
 * has not started yet, otherwise the soonest day after. Holidays are skipped
 * because the routine does not run on them.
 */
export function nextRoutineSlot(
  templates: RoutineTemplate[],
  subject: string,
  today: string,
  nowMinutes: number,
  isHoliday: (dateKey: string) => boolean = () => false
): RoutineSlot | null {
  const matching = templates
    .filter((t) => sameSubject(t.subject, subject))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  if (matching.length === 0) return null;

  const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
  for (let daysAway = 0; daysAway < 14; daysAway++) {
    const date = addDaysToKey(today, daysAway);
    if (isHoliday(date)) continue;
    const dow = (todayDow + daysAway) % 7;
    const slot = matching.find(
      (t) => t.dayOfWeek === dow && (daysAway > 0 || toMinutes(t.startTime) > nowMinutes)
    );
    if (slot) return { ...slot, date, daysAway };
  }
  return null;
}
