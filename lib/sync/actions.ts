'use server';

/**
 * The sync engine, as things the UI can call.
 *
 * A thin layer on purpose: everything interesting is in client.ts, and putting
 * it behind server actions rather than exposing the client directly means the
 * signed-in user is resolved here, once, instead of being a parameter any
 * component could get wrong.
 *
 * All of these are no-ops on the web build. There, the database IS the server -
 * there is nothing to sync to, and offering the controls would be offering a
 * button that cannot do anything.
 */

import { revalidatePath } from 'next/cache';

import { getUserId } from '@/lib/auth';
import { IS_SQLITE } from '@/lib/prisma';
import { getSyncState, pairDevice, runSync, unpairDevice } from './client.ts';

export type SyncStatus = {
  /** False on the web build, where syncing is meaningless. */
  available: boolean;
  paired: boolean;
  serverUrl: string | null;
  deviceId: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastPushed: number;
  lastPulled: number;
  /** How many local rows are waiting to go up. The honest "unsaved work" count. */
  pending: number;
};

export async function getSyncStatus(): Promise<SyncStatus> {
  const empty: SyncStatus = {
    available: false,
    paired: false,
    serverUrl: null,
    deviceId: null,
    lastSyncAt: null,
    lastError: null,
    lastPushed: 0,
    lastPulled: 0,
    pending: 0,
  };

  const userId = await getUserId();
  if (!userId || !IS_SQLITE) return empty;

  const state = await getSyncState(userId);
  const { countPending } = await import('./client.ts');

  return {
    available: true,
    paired: !!(state.serverUrl && state.token),
    serverUrl: state.serverUrl,
    deviceId: state.deviceId,
    lastSyncAt: (state as { lastSyncAt?: Date | null }).lastSyncAt ?? null,
    lastError: (state as { lastError?: string | null }).lastError ?? null,
    lastPushed: (state as { lastPushed?: number }).lastPushed ?? 0,
    lastPulled: (state as { lastPulled?: number }).lastPulled ?? 0,
    pending: await countPending(userId),
  };
}

export async function connectSync(serverUrl: string, username: string, password: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (!IS_SQLITE) return { error: 'This build is the server; there is nothing to connect to.' };

  const result = await pairDevice(userId, serverUrl, username, password);
  if ('error' in result) return result;

  // Pair and then immediately sync, because a pairing that leaves the app
  // looking unchanged reads as a pairing that did not work.
  const first = await runSync(userId);
  revalidatePath('/settings');
  return { success: true, pulled: first.pulled, pushed: first.pushed, errors: first.errors };
}

export async function syncNow() {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (!IS_SQLITE) return { error: 'This build is the server; there is nothing to sync.' };

  const result = await runSync(userId);

  // Everything, because sync can change anything.
  revalidatePath('/', 'layout');
  return {
    success: result.errors.length === 0,
    pushed: result.pushed,
    pulled: result.pulled,
    reconciled: result.reconciled,
    errors: result.errors,
  };
}

export async function disconnectSync() {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (!IS_SQLITE) return { error: 'Nothing to disconnect.' };

  await unpairDevice(userId);
  revalidatePath('/settings');
  return { success: true };
}
