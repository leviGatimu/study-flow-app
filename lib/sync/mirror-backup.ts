/**
 * The copy of both sides taken before a mirror, so it can be undone.
 *
 * Next to the database on this machine and nowhere else. Only the latest one is
 * kept per account: it holds everything the student has, and undo only ever goes
 * back one step.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { MirrorBackup } from './mirror-client.ts';

function backupPath(userId: string): string {
  const database = (process.env.DATABASE_URL ?? '').replace(/^file:/, '');
  if (!database) throw new Error('Could not find where this app keeps its data.');
  // userId comes from the signed-in session, but it names a file, so keep it plain.
  return join(dirname(database), 'sync-backups', `${userId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

export async function saveMirrorBackup(userId: string, backup: MirrorBackup): Promise<void> {
  const path = backupPath(userId);
  await mkdir(dirname(path), { recursive: true });
  // Written before anything changes. If this throws, the mirror does not run.
  await writeFile(path, JSON.stringify(backup));
}

export async function readMirrorBackup(userId: string): Promise<MirrorBackup | null> {
  try {
    return JSON.parse(await readFile(backupPath(userId), 'utf8')) as MirrorBackup;
  } catch {
    return null;
  }
}

export async function clearMirrorBackup(userId: string): Promise<void> {
  await rm(backupPath(userId), { force: true });
}
