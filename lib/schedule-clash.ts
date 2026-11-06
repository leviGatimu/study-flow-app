/**
 * Two study blocks can never run at once.
 *
 * The rules live here, with no browser or database, so every way of adding or
 * moving a block gives the same answer and `node --test` can prove it. Finished
 * and missed blocks are not passed in: their time is over, so they free it.
 */

import { entryRange } from './schedule-layout.ts';

export type TimeSlot = { startTime: string; endTime: string };
export type BusyBlock = TimeSlot & { id: string; subject: string };

/** What the student chose after being told about a clash. */
export type ClashResolution = 'next-free' | 'replace';

export type ClashInfo = {
  blocks: { subject: string; startTime: string; endTime: string }[];
  /** The next free time that day with the same length, when there is one. */
  suggestion: TimeSlot | null;
};

/** A block running past midnight also takes the start of the next day. */
export type DayBlocks = { today: BusyBlock[]; yesterday?: BusyBlock[]; tomorrow?: BusyBlock[] };

const DAY_MINUTES = 1440;

/**
 * The calendar day a task's stored date means.
 *
 * Task dates are stored at midnight, either UTC (a server on UTC) or the
 * student's own (the desktop app). Shifting by a positive offset lands both on
 * the right day. Behind UTC the shift would fall into the day before, while the
 * UTC date is already right for both.
 */
export function storedDayKey(date: Date, offsetMinutes: number): string {
  const shifted = offsetMinutes > 0 ? new Date(date.getTime() + offsetMinutes * 60_000) : date;
  return shifted.toISOString().slice(0, 10);
}

const hhmm = (minutes: number) => {
  const wrapped = minutes % DAY_MINUTES;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

function occupied(day: DayBlocks) {
  const place = (block: BusyBlock, shift: number) => {
    const { start, end } = entryRange(block);
    return { block, start: start + shift, end: end + shift };
  };
  return [
    ...day.today.map((b) => place(b, 0)),
    ...(day.yesterday ?? []).map((b) => place(b, -DAY_MINUTES)),
    ...(day.tomorrow ?? []).map((b) => place(b, DAY_MINUTES)),
  ];
}

const overlapping = (start: number, end: number, day: DayBlocks) =>
  occupied(day).filter((other) => start < other.end && end > other.start);

export function findClashes(slot: TimeSlot, day: DayBlocks): BusyBlock[] {
  const { start, end } = entryRange(slot);
  return overlapping(start, end, day)
    .sort((a, b) => a.start - b.start)
    .map((other) => other.block);
}

/** The earliest free stretch of this length from `from`, finishing by midnight. */
export function firstFreeSlot(minutes: number, from: number, day: DayBlocks): TimeSlot | null {
  let start = from;
  while (start + minutes <= DAY_MINUTES) {
    const clashes = overlapping(start, start + minutes, day);
    if (clashes.length === 0) return { startTime: hhmm(start), endTime: hhmm(start + minutes) };
    start = Math.max(...clashes.map((other) => other.end));
  }
  return null;
}

/** Where this block could go instead: same length, later the same day. */
export function nextFreeSlot(slot: TimeSlot, day: DayBlocks): TimeSlot | null {
  const { start, end } = entryRange(slot);
  return firstFreeSlot(end - start, start, day);
}

export type SlotDecision =
  | { slot: TimeSlot; clear: BusyBlock[] }
  | { clash: ClashInfo }
  | { error: string };

/** Nothing saves over another block until the student has chosen what happens. */
export function decideSlot(slot: TimeSlot, day: DayBlocks, onClash?: ClashResolution): SlotDecision {
  const clashes = findClashes(slot, day);
  if (clashes.length === 0) return { slot, clear: [] };

  const suggestion = nextFreeSlot(slot, day);
  if (onClash === 'replace') return { slot, clear: clashes };
  if (onClash === 'next-free') {
    return suggestion ? { slot: suggestion, clear: [] } : { error: 'There is no free time left that day. Pick another day.' };
  }
  return {
    clash: {
      blocks: clashes.map(({ subject, startTime, endTime }) => ({ subject, startTime, endTime })),
      suggestion,
    },
  };
}

/** For places with no room to ask, such as the AI chat or a short message. */
export function clashMessage(clash: ClashInfo): string {
  const blocks = clash.blocks.map((b) => `${b.subject} (${b.startTime}–${b.endTime})`).join(' and ');
  const next = clash.suggestion ? ` The next free time is ${clash.suggestion.startTime}–${clash.suggestion.endTime}.` : '';
  return `${blocks} ${clash.blocks.length > 1 ? 'are' : 'is'} already at that time.${next}`;
}

/** Blocks already on the schedule that overlap, keyed by id, so they can be shown. */
export function clashesWithin<T extends TimeSlot & { id: string }>(blocks: T[]): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const block of blocks) {
    const { start, end } = entryRange(block);
    const others = blocks.filter((other) => {
      if (other.id === block.id) return false;
      const range = entryRange(other);
      return start < range.end && end > range.start;
    });
    if (others.length > 0) found.set(block.id, others);
  }
  return found;
}
