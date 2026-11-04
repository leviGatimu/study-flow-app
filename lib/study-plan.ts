/**
 * Checking an AI-proposed study week before anyone sees it.
 *
 * The model is asked for JSON, but nothing it returns is trusted: every block
 * must name one of the person's own subjects, sit inside the hours they said
 * they study, and not collide with a school lesson, an existing study block or
 * another proposed block. Anything that fails is dropped and counted, never
 * repaired by guessing. Pure, so it is tested directly.
 */

import { canonicalSubject, normalizeSubject } from './subject-match.ts';

export type PlanBlock = { dayOfWeek: number; subject: string; startTime: string; endTime: string; type: 'HOMEWORK' | 'REVISION' };
export type BusySlot = { dayOfWeek: number; startTime: string; endTime: string };

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const pad = (n: number) => String(n).padStart(2, '0');

function time(raw: unknown): string | null {
  const m = typeof raw === 'string' ? raw.trim().match(TIME) : null;
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null;
}

function day(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) return raw;
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  const index = DAYS.findIndex((d) => d === key || d.slice(0, 3) === key.slice(0, 3));
  return index >= 0 ? index : null;
}

const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime);

export function validatePlan(
  raw: unknown,
  ctx: { subjects: string[]; days: number[]; start: string; end: string; busy: BusySlot[] }
): { blocks: PlanBlock[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : [];
  const known = new Set(ctx.subjects.map(normalizeSubject));
  const kept: PlanBlock[] = [];
  let dropped = 0;

  for (const item of list) {
    const row = (item ?? {}) as Record<string, unknown>;
    const dayOfWeek = day(row.day ?? row.dayOfWeek);
    const startTime = time(row.start ?? row.startTime);
    const endTime = time(row.end ?? row.endTime);
    const name = typeof row.subject === 'string' ? row.subject : '';
    const type = String(row.type ?? '').toUpperCase() === 'REVISION' ? 'REVISION' : 'HOMEWORK';

    const valid =
      dayOfWeek !== null && ctx.days.includes(dayOfWeek) &&
      startTime && endTime && toMin(endTime) > toMin(startTime) &&
      toMin(endTime) - toMin(startTime) <= 180 &&
      toMin(startTime) >= toMin(ctx.start) && toMin(endTime) <= toMin(ctx.end) &&
      known.has(normalizeSubject(name));
    if (!valid) { dropped++; continue; }

    const block: PlanBlock = { dayOfWeek, subject: canonicalSubject(name, ctx.subjects), startTime, endTime, type };
    const clashes =
      ctx.busy.some((b) => b.dayOfWeek === dayOfWeek && overlaps(b, block)) ||
      kept.some((b) => b.dayOfWeek === dayOfWeek && overlaps(b, block));
    if (clashes) { dropped++; continue; }
    kept.push(block);
  }

  kept.sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7) || toMin(a.startTime) - toMin(b.startTime));
  return { blocks: kept.slice(0, 60), dropped: dropped + Math.max(0, kept.length - 60) };
}
