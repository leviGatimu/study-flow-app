/**
 * The device's half of a mirror. It does all the thinking; the server only
 * hands over its rows and writes what it is told, within the signed-in account.
 *
 * Takes its database and the server as arguments so the test suite can drive it
 * against real databases with no network.
 */

import { markSynced, scrub, type SyncRow } from './merge.ts';
import {
  applyMirrorRemovals,
  applyMirrorRows,
  chunkRows,
  MIRROR_MODELS,
  mirrorReadWhere,
  planMirror,
  type MirrorPlan,
  type Snapshot,
  type WireRow,
} from './mirror.ts';
import { ownedBy } from './ownership.ts';

export type MirrorDirection = 'web-matches-desktop' | 'desktop-matches-web';

export type MirrorRemote = {
  /** The server's rows, and its clock when it started reading them. */
  snapshot(): Promise<{ rows: Snapshot; serverTime: string }>;
  upsert(rows: SyncRow[]): Promise<{ errors: { model: string; id: string; message: string }[] }>;
  remove(model: string, ids: string[]): Promise<void>;
};

export type MirrorBackup = {
  at: string;
  direction: MirrorDirection;
  local: Snapshot;
  remote: Snapshot;
  /** Rows waiting to go up before the mirror, so undo can make them wait again. */
  dirty: { model: string; id: string }[];
  cursor: { at: string | null; id: string | null };
};

export type MirrorOutcome = {
  errors: string[];
  applied: number;
  removed: number;
  /** Where the next pull should start, when the mirror finished. */
  cursor: Date | null;
};

type Db = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toWire = (value: unknown) => JSON.parse(JSON.stringify(value)) as WireRow;

export async function readLocalSnapshot(db: Db, userId: string): Promise<{ rows: Snapshot; dirty: { model: string; id: string }[] }> {
  const rows: Snapshot = {};
  const dirty: { model: string; id: string }[] = [];
  for (const model of MIRROR_MODELS) {
    const found: Record<string, unknown>[] = await db[model].findMany({ where: mirrorReadWhere(model, userId) });
    rows[model] = found.map((row) => toWire(scrub(model, row, 'down')));
    for (const row of found) if (row.syncedAt == null) dirty.push({ model, id: String(row.id) });
  }
  return { rows, dirty };
}

/** Compare the two sides. Writes nothing. */
export async function previewMirror(db: Db, userId: string, remote: MirrorRemote, direction: MirrorDirection) {
  const [local, server] = await Promise.all([readLocalSnapshot(db, userId), remote.snapshot()]);
  const plan =
    direction === 'web-matches-desktop'
      ? planMirror(local.rows, server.rows, 'source')
      : planMirror(server.rows, local.rows, 'target');
  return { plan, local, server };
}

/**
 * Give a local row the id the server knows it by. Foreign keys are ON UPDATE
 * CASCADE, so everything pointing at it follows.
 */
async function renameLocal(db: Db, renames: MirrorPlan['renames']) {
  for (const { model, from, to } of renames) {
    const row = await db[model].findFirst({ where: { id: from, deletedAt: undefined } });
    if (!row) continue;
    await db[model].updateMany({
      where: { id: from, deletedAt: undefined },
      data: { id: to, updatedAt: row.updatedAt, syncedAt: row.syncedAt },
    });
  }
}

async function writeToRemote(remote: MirrorRemote, plan: MirrorPlan, errors: string[]) {
  let applied = 0;
  for (const chunk of chunkRows(plan.upserts)) {
    const result = await remote.upsert(chunk);
    applied += chunk.length - result.errors.length;
    for (const failure of result.errors) errors.push(`${failure.model} ${failure.id}: ${failure.message}`);
  }
  let removed = 0;
  for (const { model, ids } of plan.removals) {
    for (const part of chunkRows(ids, 500)) {
      await remote.remove(model, part);
      removed += part.length;
    }
  }
  return { applied, removed };
}

async function writeToLocal(db: Db, userId: string, plan: MirrorPlan, stamp: Date, errors: string[]) {
  const failures = await applyMirrorRows(db, plan.upserts, stamp);
  for (const failure of failures) errors.push(`${failure.model} ${failure.id}: ${failure.message}`);
  let removed = 0;
  for (const { model, ids } of plan.removals) removed += await applyMirrorRemovals(db, model, ids, userId, stamp);
  return { applied: plan.upserts.length - failures.length, removed };
}

/** Nothing is left waiting to go up: the two sides now agree. */
async function markAllClean(db: Db, userId: string, stamp: Date) {
  for (const model of MIRROR_MODELS) {
    const dirty: { id: string; updatedAt: unknown }[] = await db[model].findMany({
      where: { ...ownedBy(model, userId), syncedAt: null, deletedAt: undefined },
      select: { id: true, updatedAt: true },
    });
    for (const row of dirty) await markSynced(db, model, row.id, row.updatedAt, stamp);
  }
}

/**
 * Run a mirror. The caller has already saved `backup` from the same preview.
 * On any failure the dirty flags stay, so nothing looks finished that is not,
 * and running it again picks up what is left.
 */
export async function runMirror(
  db: Db,
  userId: string,
  remote: MirrorRemote,
  direction: MirrorDirection,
  preview: Awaited<ReturnType<typeof previewMirror>>
): Promise<MirrorOutcome> {
  const { plan, server } = preview;
  const errors: string[] = [];
  const stamp = new Date(server.serverTime);

  await renameLocal(db, plan.renames);

  try {
    const { applied, removed } =
      direction === 'web-matches-desktop'
        ? await writeToRemote(remote, plan, errors)
        : await writeToLocal(db, userId, plan, stamp, errors);
    if (errors.length > 0) return { errors, applied, removed, cursor: null };
    await markAllClean(db, userId, stamp);
    return { errors, applied, removed, cursor: stamp };
  } catch (error) {
    errors.push((error as Error).message);
    return { errors, applied: 0, removed: 0, cursor: null };
  }
}

/**
 * Put both sides back as they were before a mirror. Anything changed since is
 * replaced too, which the screen says before this runs.
 */
export async function undoMirror(db: Db, userId: string, remote: MirrorRemote, backup: MirrorBackup): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  const { rows: remoteNow, serverTime } = await remote.snapshot();
  await writeToRemote(remote, planMirror(backup.remote, remoteNow, 'none'), errors);

  const { rows: localNow } = await readLocalSnapshot(db, userId);
  const localPlan = planMirror(backup.local, localNow, 'target');
  await renameLocal(db, localPlan.renames);
  await writeToLocal(db, userId, localPlan, new Date(serverTime), errors);

  await markAllClean(db, userId, new Date(serverTime));
  for (const { model, id } of backup.dirty) {
    const row = await db[model].findFirst({ where: { id, deletedAt: undefined }, select: { updatedAt: true } });
    if (row) await db[model].updateMany({ where: { id, deletedAt: undefined }, data: { updatedAt: row.updatedAt, syncedAt: null } });
  }
  return { errors };
}

/** The real server, over HTTP. */
export function httpRemote(serverUrl: string, token: string, deviceId: string): MirrorRemote {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  const url = `${serverUrl}/api/sync/mirror`;

  const read = async (response: Response) => {
    if (response.ok) return response.json();
    if (response.status === 404) throw new Error('The website needs updating before this can run. Try again in a few minutes.');
    if (response.status === 401) throw new Error('The website no longer accepts this device. Disconnect and sign in again.');
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `The website returned ${response.status}. Nothing was lost; try again.`);
  };

  return {
    async snapshot() {
      const rows: Snapshot = {};
      let serverTime = '';
      for (const model of MIRROR_MODELS) {
        rows[model] = [];
        let after = '';
        for (;;) {
          const query = new URLSearchParams({ model, after });
          const page = (await read(await fetch(`${url}?${query}`, { headers }))) as { rows: WireRow[]; next: string | null; serverTime: string };
          serverTime ||= page.serverTime;
          rows[model].push(...page.rows);
          if (!page.next) break;
          after = page.next;
        }
      }
      return { rows, serverTime };
    },
    async upsert(rows) {
      return read(await fetch(url, { method: 'POST', headers, body: JSON.stringify({ op: 'upsert', deviceId, rows }) }));
    },
    async remove(model, ids) {
      await read(await fetch(url, { method: 'POST', headers, body: JSON.stringify({ op: 'remove', deviceId, model, ids }) }));
    },
  };
}
