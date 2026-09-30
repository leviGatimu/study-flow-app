import { toMinutes } from '@/lib/school';

/** Monday first, as the schema's 0=Sunday dayOfWeek values. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0];

export type RoutineBlock = {
  id: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

export const isRevision = (block: { type: string }) => block.type === 'REVISION';

export function blockMinutes(start: string, end: string) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e < s) e += 24 * 60; // a block that runs past midnight
  return e - s;
}

export function formatMinutes(mins: number) {
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h${rem > 0 ? ` ${rem}m` : ''}`;
  return `${rem}m`;
}

export function totalMinutes(blocks: RoutineBlock[]) {
  return blocks.reduce((sum, b) => sum + blockMinutes(b.startTime, b.endTime), 0);
}

/**
 * "Physics (Revision)" and "Physics" are the same subject studied two ways, so
 * hours per subject counts them together.
 */
export function subjectKey(subject: string) {
  return subject
    .replace(/\s*\((revision|rev)\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

export function subjectLabel(subject: string) {
  return subject.replace(/\s*\((revision|rev)\)\s*$/i, '').trim() || subject;
}
