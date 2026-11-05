/**
 * The /time page's arithmetic: where "now" sits among today's blocks.
 * Pure (minutes since midnight in, plain values out) so it can be tested.
 */

export type DayBlock = {
  id: string;
  subject: string;
  type: string;
  startTime: string;
  endTime: string;
  isDone: boolean;
  isMissed?: boolean;
};

export type PlacedBlock = DayBlock & {
  start: number;
  end: number;
  state: 'done' | 'missed' | 'now' | 'later' | 'past';
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** [start, end) in minutes; an end at or before the start runs past midnight. */
export function span(block: Pick<DayBlock, 'startTime' | 'endTime'>): [number, number] {
  const start = toMinutes(block.startTime);
  let end = toMinutes(block.endTime);
  if (end <= start) end += 24 * 60;
  return [start, end];
}

export function placeBlocks(blocks: DayBlock[], now: number): PlacedBlock[] {
  return blocks
    .map((b) => {
      const [start, end] = span(b);
      const state: PlacedBlock['state'] = b.isDone
        ? 'done'
        : now >= start && now < end
          ? 'now'
          : now >= end
            ? b.isMissed ? 'missed' : 'past'
            : 'later';
      return { ...b, start, end, state };
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * The stretch of the day the timeline shows: from the hour before the first
 * block (or now, if earlier) to the hour after the last (or now, if later),
 * at least six hours wide.
 */
export function dayWindow(placed: PlacedBlock[], now: number): { from: number; to: number } {
  if (!placed.length) {
    const from = Math.max(0, Math.floor(now / 60) * 60 - 180);
    return { from, to: Math.min(24 * 60, from + 6 * 60) };
  }
  let from = Math.min(now, placed[0].start);
  let to = Math.max(now, ...placed.map((b) => b.end));
  from = Math.max(0, Math.floor(from / 60) * 60 - 60);
  to = Math.min(26 * 60, Math.ceil(to / 60) * 60 + 60);
  if (to - from < 6 * 60) to = from + 6 * 60;
  return { from, to };
}

/** "1h 20m", "45m", "under a minute". */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return 'under a minute';
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
}

export type TimeSnapshot = {
  placed: PlacedBlock[];
  current: PlacedBlock | null;
  /** 0-100 through the current block. */
  currentProgress: number;
  currentLeft: number;
  next: PlacedBlock | null;
  untilNext: number;
  done: number;
  total: number;
  plannedLeft: number;
};

/** Everything the page shows, for `now` minutes (seconds as a fraction) since midnight. */
export function timeSnapshot(blocks: DayBlock[], now: number): TimeSnapshot {
  const placed = placeBlocks(blocks, now);
  const current = placed.find((b) => b.state === 'now') ?? null;
  const next = placed.find((b) => b.state === 'later') ?? null;
  return {
    placed,
    current,
    currentProgress: current ? Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100)) : 0,
    currentLeft: current ? current.end - now : 0,
    next,
    untilNext: next ? next.start - now : 0,
    done: placed.filter((b) => b.state === 'done').length,
    total: placed.length,
    plannedLeft: placed
      .filter((b) => b.state === 'later' || b.state === 'now')
      .reduce((s, b) => s + (b.end - Math.max(b.start, now)), 0),
  };
}
