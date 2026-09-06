import { startOfDay } from 'date-fns';

/**
 * Pure date rules for terms.
 *
 * Deliberately free of imports from the rest of the app - no Prisma, no auth,
 * no path aliases - so it can be unit tested directly. lib/term.ts holds the
 * database work and re-exports these.
 */

/**
 * Has a term's start date arrived?
 *
 * A term dated to begin tomorrow must not run today. getScheduleState computed
 * isRunning as `!isPaused` alone and never looked at the start date, so setting
 * a start date in the future and then resuming generated tasks and advanced the
 * streak immediately - the schedule started clocking before the term it
 * belonged to had begun.
 *
 * This is a gate, not a transition: nothing changes status on its own, the
 * schedule simply stays quiet until the date it was told to begin. A term with
 * no start date has always been running - absence of a date is not a delay.
 *
 * The comparison is day-level on purpose: a term starting today starts at
 * 00:00, not at whatever time of day the date happened to be saved with.
 */
export function termHasStarted(startDate: Date | null, today: Date): boolean {
  if (!startDate) return true;
  return startOfDay(startDate) <= startOfDay(today);
}

/**
 * Has a term reached its end date?
 *
 * Unlike the start gate this only ever produces a PROMPT - the app never ends
 * a term on its own, because stopping the schedule on a day the user was not
 * expecting is worse than running one day long.
 */
export function termHasEnded(endDate: Date | null, today: Date): boolean {
  if (!endDate) return false;
  return startOfDay(endDate) <= startOfDay(today);
}
