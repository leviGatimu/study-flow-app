/**
 * Validating a one-off study block before it is saved (audit D09).
 *
 * Quick Add used to add a hidden 3-minute "prep buffer" to the start time -
 * 20:00 was saved as 20:03, 23:57 as "24:00", 23:59 as "24:02" - and the
 * server trusted whatever arrived. Times are now stored exactly as entered,
 * and everything is checked at the action boundary, because a server action
 * is an endpoint anyone can call with anything.
 *
 * Pure so `node --test` can import it directly.
 */

export const TASK_TYPES = ['HOMEWORK', 'REVISION', 'EXAM'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type QuickTaskInput = {
  subject: unknown;
  startTime: unknown;
  endTime: unknown;
  type: unknown;
  /** "YYYY-MM-DD"; absent means today in the user's timezone. */
  date?: unknown;
};

export type ValidQuickTask = {
  subject: string;
  startTime: string;
  endTime: string;
  type: TaskType;
  /** null when the caller should use today. */
  dateKey: string | null;
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = value.match(DATE);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * The rule for times: an end EARLIER than the start is a block that runs past
 * midnight (22:00-01:00), which the schedule already supports. An end EQUAL to
 * the start is a zero-length block and is refused.
 */
export function validateQuickTask(input: QuickTaskInput): { ok: true; value: ValidQuickTask } | { ok: false; error: string } {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!subject) return { ok: false, error: 'Choose a subject.' };
  if (subject.length > 120) return { ok: false, error: 'That subject name is too long.' };

  if (!isTime(input.startTime)) return { ok: false, error: 'Enter a start time like 19:30.' };
  if (!isTime(input.endTime)) return { ok: false, error: 'Enter an end time like 21:00.' };
  if (input.startTime === input.endTime) return { ok: false, error: 'The block needs to end at a different time from when it starts.' };

  const type = typeof input.type === 'string' ? input.type.toUpperCase() : '';
  if (!(TASK_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Choose homework, revision or exam prep.' };

  let dateKey: string | null = null;
  if (input.date !== undefined && input.date !== null && input.date !== '') {
    if (!isDateKey(input.date)) return { ok: false, error: 'Pick a valid date.' };
    dateKey = input.date;
  }

  return { ok: true, value: { subject, startTime: input.startTime, endTime: input.endTime, type: type as TaskType, dateKey } };
}
