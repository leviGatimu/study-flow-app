/**
 * The study streak: days in a row you actually finished a block.
 *
 * Worked out from the record every time, never counted up. It used to add one
 * whenever the app was opened on a new day, so a streak could grow through days
 * with no study at all, and nothing could ever correct it.
 *
 * A day either counts, breaks the run, or does not matter:
 *   finished a block             the run grows
 *   today, nothing finished yet  does not matter: today is not over
 *   nothing was planned          does not matter: a holiday, between terms, a free day
 *   planned and nothing finished the run is over
 */

const DAY = 86_400_000;

const toTime = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const toKey = (time: number) => new Date(time).toISOString().slice(0, 10);

export type StudyRecord = {
  /** Days with a finished block, "yyyy-MM-dd". */
  studied: Iterable<string>;
  /** Whether anything was expected of this day. */
  planned: (day: string) => boolean;
  today: string;
};

export function computeStreak({ studied, planned, today }: StudyRecord): { current: number; longest: number } {
  const days = new Set(studied);
  if (days.size === 0) return { current: 0, longest: 0 };

  const end = toTime(today);
  let run = 0;
  let longest = 0;
  for (let time = toTime([...days].sort()[0]); time <= end; time += DAY) {
    const day = toKey(time);
    if (days.has(day)) {
      run++;
      longest = Math.max(longest, run);
    } else if (day !== today && planned(day)) {
      run = 0;
    }
  }
  return { current: run, longest };
}

export type PlannedDays = {
  /** Days holding a block that was not deleted. */
  taskDays: Iterable<string>;
  /** Weekdays with a routine block, 0 for Sunday. */
  routineWeekdays: Iterable<number>;
  /** When a term was running, inclusive, "yyyy-MM-dd". */
  termWindows: { from: string; to: string }[];
  holidays: Set<string>;
};

/**
 * Blocks only exist for days the app was opened, so skipping the app must not
 * make a day look free. A routine day during a term counts as planned even when
 * its block was never created, but not before the first block on record, since
 * today's routine says nothing about the time before it existed.
 */
export function plannedDays({ taskDays, routineWeekdays, termWindows, holidays }: PlannedDays): (day: string) => boolean {
  const withTasks = new Set(taskDays);
  const weekdays = new Set(routineWeekdays);
  const first = [...withTasks].sort()[0];
  return (day) => {
    if (holidays.has(day)) return false;
    if (withTasks.has(day)) return true;
    if (!first || day < first) return false;
    if (!weekdays.has(new Date(toTime(day)).getUTCDay())) return false;
    return termWindows.some((term) => day >= term.from && day <= term.to);
  };
}
