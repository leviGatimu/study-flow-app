/**
 * The device half: send what changed here, take what changed there.
 *
 * Runs inside the desktop app's own Next server, against its own SQLite file.
 * The web build never calls it - there, the database IS the server.
 *
 * The shape of one sync, and the order is not negotiable:
 *
 *   1. PUSH first. A device's local edits go up before anything comes down, so
 *      a conflict is resolved once, on the server, with both versions in hand.
 *      Pulling first would apply the server's version locally and then push it
 *      straight back, which looks like it worked and quietly discards the local
 *      edit.
 *   2. ADOPT the remaps. When the server folds a locally-minted row into one it
 *      already had - two devices both created "Physics" - the device has to
 *      take on the server's id, or it offers its own copy again forever.
 *   3. PULL in pages until the server says there is no more.
 *
 * Everything is idempotent. A sync interrupted halfway leaves the device with a
 * cursor it has genuinely consumed and dirty rows it has genuinely not sent, so
 * the next run continues rather than repeating or skipping.
 */

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { applyRows, markSynced, scrub, APPLY_ORDER, type SyncRow } from './merge.ts';
import {
  PUSH_LIMIT,
  type Cursor,
  type PullResponse,
  type PushResponse,
} from './protocol.ts';

export type SyncResult = {
  pushed: number;
  pulled: number;
  reconciled: number;
  /** Uploads transferred in either direction. */
  files: number;
  errors: string[];
  at: Date;
};

type State = {
  id: string;
  deviceId: string;
  serverUrl: string | null;
  token: string | null;
  cursor: Date | null;
  cursorId: string | null;
};

/**
 * This install's row, created on first use.
 *
 * The device id is minted once and kept. It is not a secret and not an
 * identity - the token is both of those - it exists only so the merge has a
 * stable string to break an exact updatedAt tie with, and so two installs
 * signed into the same account do not look like one.
 */
export async function getSyncState(userId: string): Promise<State> {
  const existing = await prisma.syncState.findFirst({ where: { userId } });
  if (existing) return existing as State;

  return (await prisma.syncState.create({
    data: { userId, deviceId: randomUUID() },
  })) as State;
}

/** Pair this install with a web account. The one step that must happen online. */
export async function pairDevice(
  userId: string,
  serverUrl: string,
  username: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return { error: 'The server address must start with http:// or https://' };

  let response: Response;
  try {
    response = await fetch(`${base}/api/sync/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { error: `Could not reach ${base}. Check the address and your connection.` };
  }

  const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!response.ok || !body.token) {
    return { error: body.error ?? `The server refused the sign-in (${response.status}).` };
  }

  const state = await getSyncState(userId);
  await prisma.syncState.update({
    where: { id: state.id },
    data: { serverUrl: base, token: body.token, lastError: null },
  });
  return { success: true };
}

/** Forget the pairing. Local data is untouched; only the link is dropped. */
export async function unpairDevice(userId: string): Promise<void> {
  const state = await getSyncState(userId);
  await prisma.syncState.update({
    where: { id: state.id },
    data: { serverUrl: null, token: null, cursor: null, cursorId: null, lastError: null },
  });
}

/**
 * Every local row the server has not seen.
 *
 * `syncedAt: null` is the whole query, and it is why no clock comparison
 * appears anywhere in this file. Tombstones are included on purpose - a
 * deletion is a change, and the one the engine most needs to deliver.
 */
async function collectDirty(userId: string): Promise<SyncRow[]> {
  const rows: SyncRow[] = [];

  for (const model of APPLY_ORDER) {
    if (rows.length >= PUSH_LIMIT) break;
    const where =
      model === 'user'
        ? { id: userId, syncedAt: null }
        : model === 'subjectGrade'
          ? { reportCard: { userId }, syncedAt: null }
          : { userId, syncedAt: null };

    const found = await prisma[model as 'task'].findMany({
      // deletedAt: undefined defeats the tombstone read filter. Without it a
      // device would keep every deletion to itself, which is precisely the bug
      // soft deletes were introduced to fix.
      where: { ...(where as object), deletedAt: undefined },
      take: PUSH_LIMIT - rows.length,
    });
    for (const row of found) {
      rows.push({ model, data: scrub(model, row as Record<string, unknown>, 'up') });
    }
  }

  return rows;
}

/**
 * How many local rows are waiting to go up.
 *
 * Shown in Settings because "last synced 3 hours ago" is not the question a
 * user actually has - "is anything of mine still only on this machine" is.
 */
export async function countPending(userId: string): Promise<number> {
  let total = 0;
  for (const model of APPLY_ORDER) {
    const where =
      model === 'user'
        ? { id: userId, syncedAt: null }
        : model === 'subjectGrade'
          ? { reportCard: { userId }, syncedAt: null }
          : { userId, syncedAt: null };
    total += await prisma[model as 'task'].count({
      where: { ...(where as object), deletedAt: undefined },
    });
  }
  return total;
}

/**
 * Take on the server's id for a row this device minted independently.
 *
 * Re-parents the local children first, exactly as a natural-key collision is
 * reconciled on the server, then removes the local duplicate for real. A hard
 * delete is right here and nowhere else: this row was never anybody's source of
 * truth - the server has already told us it is the same thing as another row -
 * so a tombstone would only travel back up and ask the server to delete the
 * survivor.
 */
async function adoptRemaps(remapped: PushResponse['remapped']): Promise<void> {
  const { REPARENT_BEFORE_DELETE } = await import('./identity.ts');

  for (const { model, from, to } of remapped) {
    if (from === to) continue;
    for (const child of REPARENT_BEFORE_DELETE[model] ?? []) {
      await prisma[child.model as 'task'].updateMany({
        where: { [child.fk]: from } as object,
        data: { [child.fk]: to } as object,
      });
    }
    await prisma[model as 'task'].deleteMany({ where: { id: from } });
  }
}

/** One full exchange. Safe to call when offline: it reports the failure and changes nothing. */
export async function runSync(userId: string): Promise<SyncResult> {
  const state = await getSyncState(userId);
  const at = new Date();

  if (!state.serverUrl || !state.token) {
    return {
      pushed: 0,
      pulled: 0,
      reconciled: 0,
      files: 0,
      errors: ['This device is not paired yet.'],
      at,
    };
  }

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${state.token}`,
  };
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;
  let reconciled = 0;
  let files = 0;

  try {
    // 1. Push.
    const dirty = await collectDirty(userId);
    if (dirty.length > 0) {
      const response = await fetch(`${state.serverUrl}/api/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId: state.deviceId, rows: dirty }),
      });
      if (!response.ok) throw new Error(await describe(response));

      const result = (await response.json()) as PushResponse;
      pushed = result.applied + result.rejected;
      reconciled = result.reconciled;
      for (const e of result.errors) errors.push(`${e.model} ${e.id}: ${e.message}`);

      // 2. Adopt the server's ids, then mark everything we sent as clean. The
      // server's stamp is used, not our own clock, so the two sides agree about
      // where each row stands.
      await adoptRemaps(result.remapped);

      const remapped = new Set(result.remapped.map((r) => `${r.model}:${r.from}`));
      const stamp = new Date(result.serverTime);
      for (const row of dirty) {
        if (remapped.has(`${row.model}:${row.data.id}`)) continue;
        await markSynced(prisma, row.model, String(row.data.id), row.data.updatedAt, stamp);
      }
    }

    // 3. Pull, page by page.
    let cursor: Cursor = state.cursor
      ? { syncedAt: state.cursor.toISOString(), id: state.cursorId ?? '' }
      : null;

    for (let page = 0; page < 100; page++) {
      const query = cursor ? `?cursor=${encodeURIComponent(`${cursor.syncedAt}|${cursor.id}`)}` : '';
      const response = await fetch(`${state.serverUrl}/api/sync${query}`, { headers });
      if (!response.ok) throw new Error(await describe(response));

      const result = (await response.json()) as PullResponse;
      if (result.rows.length > 0) {
        const outcome = await applyRows(prisma, result.rows, {
          // The server's stamp, so a row that just arrived is not immediately
          // mistaken for a local edit and pushed straight back.
          stamp: new Date(result.serverTime),
          localDevice: state.deviceId,
          incomingDevice: 'server',
        });
        pulled += outcome.applied;
        reconciled += outcome.reconciled;
        for (const e of outcome.errors) errors.push(`${e.model} ${e.id}: ${e.message}`);
      }

      cursor = result.cursor;
      await prisma.syncState.update({
        where: { id: state.id },
        data: {
          cursor: cursor ? new Date(cursor.syncedAt) : null,
          cursorId: cursor?.id ?? null,
        },
      });

      if (!result.hasMore) break;
    }

    // 4. The files the rows point at. Last on purpose and never fatal: a task
    // whose proof-of-work photo has not arrived yet is a task you can still
    // see, tick and plan around, whereas a sync that refuses to finish because
    // of one 60MB song is a sync that never delivers anything.
    try {
      const { fetchMissingFiles, pushLocalFiles } = await import('./files.ts');
      const up = await pushLocalFiles(userId, state.serverUrl, state.token);
      const down = await fetchMissingFiles(userId, state.serverUrl, state.token);
      files = up.fetched + down.fetched;
      for (const warning of [...up.warnings, ...down.warnings]) errors.push(warning);
    } catch (error) {
      errors.push(`Files: ${(error as Error).message}`);
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  await prisma.syncState.update({
    where: { id: state.id },
    data: {
      lastSyncAt: at,
      lastError: errors[0] ?? null,
      lastPushed: pushed,
      lastPulled: pulled,
    },
  });

  return { pushed, pulled, reconciled, files, errors, at };
}

/** A failed response, as a sentence rather than a status code. */
async function describe(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401) {
    return 'The server no longer accepts this device. Pair it again in Settings.';
  }
  return body.error ?? `The server returned ${response.status}.`;
}
