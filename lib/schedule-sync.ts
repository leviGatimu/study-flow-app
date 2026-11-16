/**
 * Keeping blocks that were already made in step with the plan they came from.
 *
 * Routine blocks are made ahead of time (the Week and Month views make weeks
 * of them). Two things then changed the plan without touching those blocks:
 *   - setting the term's end date: days after it kept their study blocks;
 *   - editing a block in Study routine: the blocks already made from it kept
 *     the old day and times, so Week showed clashes Study routine did not.
 *
 * These rules decide which made blocks follow such a change. Pure, so they are
 * tested on their own (test/schedule-sync.test.mjs); lib/actions.ts applies
 * them.
 *
 * Never touched: anything done, written up, with proof, or with homework
 * planned into it. Those are the student's own record and stay as they are.
 */

export type MadeBlock = {
  id: string;
  /** "yyyy-MM-dd" in the student's timezone. */
  day: string;
  templateId: string | null;
  examId: string | null;
  isDone: boolean;
  isMissed: boolean;
  hasWork: boolean;
  hasHomework: boolean;
};

const untouched = (b: MadeBlock) => !b.isDone && !b.hasWork && !b.hasHomework;
/** Made by the app (from the routine or a revision plan), not added by hand. */
const appMade = (b: MadeBlock) => b.templateId !== null || b.examId !== null;

/**
 * Blocks to withdraw because their day is after the term's last day. Missed
 * ones go too: a day after the term should have no plan at all, and leaving
 * them would count as missed study. Hand-added blocks stay; the student put
 * them there on purpose.
 */
export function blocksAfterTermEnd(blocks: MadeBlock[], lastDay: string): string[] {
  return blocks.filter((b) => b.day > lastDay && appMade(b) && untouched(b)).map((b) => b.id);
}

export type TimedBlock = MadeBlock & { startTime: string; endTime: string };

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * After a routine block is edited: its blocks from today on that still sit on
 * its old weekday and times either take the new times (same weekday) or are
 * withdrawn (it moved to another weekday; the new day's blocks are made as
 * usual). A block the student moved or retimed by itself no longer matches
 * the old slot, so it is left where they put it. Past and missed blocks are
 * history and are left alone too.
 */
export function followTemplateEdit(
  blocks: TimedBlock[],
  edit: {
    templateId: string;
    previous: { dayOfWeek: number; startTime: string; endTime: string };
    dayOfWeek: number;
    today: string;
  }
): { update: string[]; withdraw: string[] } {
  const update: string[] = [];
  const withdraw: string[] = [];
  const { previous } = edit;
  for (const b of blocks) {
    if (b.templateId !== edit.templateId || b.day < edit.today || b.isMissed || b.isDone || b.hasWork) continue;
    const onOldSlot = weekdayOf(b.day) === previous.dayOfWeek && b.startTime === previous.startTime && b.endTime === previous.endTime;
    if (!onOldSlot) continue;
    // Homework planned into a block keeps it on its day, at the new times.
    if (edit.dayOfWeek === previous.dayOfWeek || b.hasHomework) update.push(b.id);
    else withdraw.push(b.id);
  }
  return { update, withdraw };
}

/**
 * How a withdrawn block is written. Marked deleted like a block the student
 * removed, and detached from its routine slot and exam, so:
 *   - sync matches routine blocks by template and day, and a deleted copy
 *     always wins a match; detached, it can never swallow a block made for
 *     that slot later (when the term is extended, or the block moved back);
 *   - generation skips a template and day only while a block is attached to
 *     it, so the slot can be made again if the plan comes back to it.
 */
export const WITHDRAWN = { isDeleted: true, templateId: null, examId: null } as const;

