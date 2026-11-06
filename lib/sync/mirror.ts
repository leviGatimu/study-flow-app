/**
 * "Make one side an exact copy of the other."
 *
 * Normal sync merges and has rules that protect work: a deletion always wins, a
 * finished block can never be unfinished. A mirror is the student saying which
 * side is right, so none of those rules apply here. It never runs by itself.
 *
 * Everything is decided up front by planMirror, a pure function over two
 * snapshots, so the counts shown before confirming are exactly what happens.
 * Applying a plan twice is harmless, which is what makes a mirror interrupted
 * by a dropped connection safe to simply run again.
 *
 * Not touched: the User row (a device may not change how an account signs in),
 * API keys (scrub strips them), and models that do not sync at all.
 */

import { SYNC_RULES } from './identity.ts';
import { APPLY_ORDER, naturalKeyOf, type SyncRow } from './merge.ts';
import { ownedBy } from './ownership.ts';

export const MIRROR_MODELS: string[] = APPLY_ORDER.filter((model) => {
  const rule = SYNC_RULES[model];
  return model !== 'user' && (rule?.match === 'ID' || rule?.match === 'NATURAL_KEY');
});

export type WireRow = Record<string, unknown> & { id: string };
/** Every row of one account, tombstones included, by model. */
export type Snapshot = Record<string, WireRow[]>;

export type MirrorCount = { model: string; add: number; change: number; remove: number };

export type MirrorPlan = {
  /** The same thing under two ids: renamed so both sides agree from now on. */
  renames: { model: string; from: string; to: string }[];
  /** Parent first, so a chunk boundary never orphans a row. */
  upserts: SyncRow[];
  removals: { model: string; ids: string[] }[];
  counts: MirrorCount[];
  /** Copying from a side holding almost nothing is usually a mistake. */
  sourceLooksEmpty: boolean;
};

const IGNORED_WHEN_COMPARING = new Set(['id', 'syncedAt', 'updatedAt']);

const isLive = (row: WireRow) => row.deletedAt == null;

function sameContent(source: WireRow, target: WireRow): boolean {
  for (const [field, value] of Object.entries(source)) {
    if (IGNORED_WHEN_COMPARING.has(field)) continue;
    if (JSON.stringify(value ?? null) !== JSON.stringify(target[field] ?? null)) return false;
  }
  return true;
}

function rewriteIds(row: WireRow, renamed: Map<string, string>): WireRow {
  if (renamed.size === 0) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const [field, value] of Object.entries(row)) {
    if ((field === 'id' || field.endsWith('Id')) && typeof value === 'string' && renamed.has(value)) {
      copy[field] = renamed.get(value);
    }
  }
  return copy as WireRow;
}

/**
 * Pair rows that are one thing under two ids, in parent-first order so a key
 * containing a foreign key sees the parent's new id. Live rows pair first, so a
 * tombstone never takes the place of the row actually in use.
 */
function naturalPairs(renamable: Snapshot, fixed: Snapshot) {
  const renames: MirrorPlan['renames'] = [];
  const renamed = new Map<string, string>();

  for (const model of MIRROR_MODELS) {
    const rule = SYNC_RULES[model];
    if (rule.match !== 'NATURAL_KEY') continue;

    const fixedIds = new Set((fixed[model] ?? []).map((row) => row.id));
    const renamableIds = new Set((renamable[model] ?? []).map((row) => row.id));
    const unmatched = (renamable[model] ?? []).filter((row) => !fixedIds.has(row.id));
    const candidates = (fixed[model] ?? []).filter((row) => !renamableIds.has(row.id));
    const claimed = new Set<string>();

    const pass = (accept: (a: WireRow, b: WireRow) => boolean) => {
      for (const row of unmatched) {
        if (renamed.has(row.id)) continue;
        const key = naturalKeyOf(rule, rewriteIds(row, renamed));
        if (!key) continue;
        const match = candidates.find((other) => !claimed.has(other.id) && accept(row, other) && naturalKeyOf(rule, other) === key);
        if (!match) continue;
        claimed.add(match.id);
        renamed.set(row.id, match.id);
        renames.push({ model, from: row.id, to: match.id });
      }
    };
    pass((a, b) => isLive(a) && isLive(b));
    pass(() => true);
  }
  return { renames, renamed };
}

const applyRenames = (snapshot: Snapshot, renamed: Map<string, string>): Snapshot =>
  Object.fromEntries(Object.entries(snapshot).map(([model, rows]) => [model, rows.map((row) => rewriteIds(row, renamed))]));

/** Tombstones a live row still points at, which the target needs to exist. */
function referencedIds(rows: WireRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (field.endsWith('Id') && field !== 'userId' && typeof value === 'string') ids.add(value);
    }
  }
  return ids;
}

/**
 * What it takes to make `target` match `source`.
 *
 * `rename` says which side's ids give way when a natural key pairs two rows: the
 * device's, always, because the server's are what every other device knows.
 * 'none' compares by id only, for restoring a side to its own earlier state.
 */
export function planMirror(source: Snapshot, target: Snapshot, rename: 'source' | 'target' | 'none'): MirrorPlan {
  let renames: MirrorPlan['renames'] = [];
  let from = source;
  let to = target;
  if (rename === 'source') {
    const pairs = naturalPairs(source, target);
    renames = pairs.renames;
    from = applyRenames(source, pairs.renamed);
  } else if (rename === 'target') {
    const pairs = naturalPairs(target, source);
    renames = pairs.renames;
    to = applyRenames(target, pairs.renamed);
  }

  const upserts: SyncRow[] = [];
  const removals: MirrorPlan['removals'] = [];
  const counts: MirrorCount[] = [];
  let sourceLive = 0;
  let targetLive = 0;

  // Up to two rounds: a tombstone kept for a live row can itself point at another.
  const referenced = referencedIds(MIRROR_MODELS.flatMap((model) => (from[model] ?? []).filter(isLive)));
  const allTombstones = MIRROR_MODELS.flatMap((model) => (from[model] ?? []).filter((row) => !isLive(row)));
  for (const id of referencedIds(allTombstones.filter((row) => referenced.has(row.id)))) referenced.add(id);

  for (const model of MIRROR_MODELS) {
    const count: MirrorCount = { model, add: 0, change: 0, remove: 0 };
    const sourceRows = from[model] ?? [];
    const targetById = new Map((to[model] ?? []).map((row) => [row.id, row]));
    const sourceIds = new Set(sourceRows.map((row) => row.id));
    sourceLive += sourceRows.filter(isLive).length;
    targetLive += (to[model] ?? []).filter(isLive).length;

    for (const row of sourceRows) {
      const existing = targetById.get(row.id);
      if (!existing) {
        if (isLive(row)) count.add++;
        else if (!referenced.has(row.id)) continue;
        upserts.push({ model, data: row });
      } else if (!sameContent(row, existing)) {
        if (isLive(row) && !isLive(existing)) count.add++;
        else if (!isLive(row) && isLive(existing)) count.remove++;
        else if (isLive(row)) count.change++;
        upserts.push({ model, data: row });
      }
    }

    const gone = (to[model] ?? []).filter((row) => !sourceIds.has(row.id) && isLive(row)).map((row) => row.id);
    if (gone.length > 0) {
      count.remove += gone.length;
      removals.push({ model, ids: gone });
    }
    if (count.add || count.change || count.remove) counts.push(count);
  }

  return { renames, upserts, removals, counts, sourceLooksEmpty: targetLive > 20 && sourceLive < targetLive / 10 };
}

/**
 * Write rows as given, ignoring every merge rule. updatedAt is written back so
 * later merges see the source's own edit times, and an explicit syncedAt keeps
 * this from counting as a local change.
 */
export async function applyMirrorRows(
  db: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  rows: SyncRow[],
  stamp: Date
): Promise<{ model: string; id: string; message: string }[]> {
  const write = async ({ model, data }: SyncRow) => {
    const { id, ...fields } = data;
    const { count } = await db[model].updateMany({
      where: { id, deletedAt: undefined },
      data: { ...fields, syncedAt: stamp },
    });
    if (count === 0) await db[model].create({ data: { ...data, syncedAt: stamp } });
  };

  let failed: { row: SyncRow; message: string }[] = [];
  for (const row of rows) {
    try {
      await write(row);
    } catch (error) {
      failed.push({ row, message: (error as Error).message });
    }
  }
  // A row can point at a later row of its own model. One retry settles those.
  if (failed.length > 0) {
    const retry = failed;
    failed = [];
    for (const { row } of retry) {
      try {
        await write(row);
      } catch (error) {
        failed.push({ row, message: (error as Error).message });
      }
    }
  }
  return failed.map(({ row, message }) => ({ model: row.model, id: String(row.data.id), message: message.slice(0, 300) }));
}

/** Tombstone what the source does not have, so it can be brought back. */
export async function applyMirrorRemovals(
  db: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  model: string,
  ids: string[],
  userId: string,
  stamp: Date
): Promise<number> {
  const { count } = await db[model].updateMany({
    where: { id: { in: ids }, ...ownedBy(model, userId) },
    data: { deletedAt: stamp, syncedAt: stamp, updatedAt: stamp },
  });
  return count;
}

/** What to read from this side's database for a snapshot. */
export const mirrorReadWhere = (model: string, userId: string) => ({ ...ownedBy(model, userId), deletedAt: undefined });

const CHUNK_ROWS = 200;
const CHUNK_BYTES = 3_000_000;

/**
 * Split rows for sending. A serverless request has a size and a time limit, and
 * one over-large push was failing as a 504 with nothing getting through. Order
 * is kept so parents still go first.
 */
export function chunkRows<T>(rows: T[], maxRows = CHUNK_ROWS, maxBytes = CHUNK_BYTES): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (current.length > 0 && (current.length >= maxRows || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Friendly names for the preview. Everything else is grouped as "other". */
const LABELS: Record<string, string> = {
  task: 'Schedule blocks',
  scheduleTemplate: 'Routine blocks',
  schoolLesson: 'School lessons',
  examEvent: 'Exams',
  homework: 'Homework',
  subject: 'Subjects',
  resource: 'Resources',
  chatSession: 'AI chats',
  tutorModule: 'Practices',
};

export function summariseCounts(counts: MirrorCount[]): { label: string; add: number; change: number; remove: number }[] {
  const groups = new Map<string, { label: string; add: number; change: number; remove: number }>();
  for (const { model, add, change, remove } of counts) {
    const label = LABELS[model] ?? 'Other records';
    const group = groups.get(label) ?? { label, add: 0, change: 0, remove: 0 };
    group.add += add;
    group.change += change;
    group.remove += remove;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => Number(a.label === 'Other records') - Number(b.label === 'Other records'));
}
