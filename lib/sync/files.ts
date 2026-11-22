/**
 * The files behind the rows.
 *
 * Syncing a row that says `proofPdfUrl: "/uploads/proof-abc.pdf"` moves the
 * SENTENCE, not the PDF. On the other device that link resolves to nothing, and
 * the failure is quiet - the row looks fine until somebody clicks it.
 *
 * Two decisions shape this:
 *
 *   LAZY, NOT EAGER. Files are fetched when a device notices it is missing one,
 *   not as part of the row exchange. An upload here can be 60MB of audio, and a
 *   sync that pulls a term's worth of them before showing a single task would
 *   be a sync nobody waits for. A missing file is a degraded row, not a broken
 *   one, which is what makes deferring it safe.
 *
 *   FAILURE IS NOT FATAL. A file that cannot be fetched leaves the row exactly
 *   as it is and records a warning. The alternative - failing the sync - would
 *   let one 404 block every task, mark and grade behind it.
 *
 *   ASK ONCE. What each file's state is gets remembered for this launch, and
 *   failures back off from 5 minutes to a day (file-backoff.ts). Before that,
 *   every run re-asked about and re-sent every file a server had not kept,
 *   which on a hosted server is a transfer bill that never stops growing.
 *
 * The web server must store uploads in the Supabase bucket (SUPABASE_* env):
 * a host's own disk is temporary, so a file "kept" there is lost on redeploy.
 */

import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

import { prisma } from '@/lib/prisma';
import { resolveUploadPath, UPLOAD_DIR } from '@/lib/upload';
import { APPLY_ORDER } from './merge.ts';
import { FILE_COLUMNS } from './file-columns.ts';
import { putToSignedUrl } from '@/lib/signed-upload';
import { FileBackoff } from './file-backoff.ts';

/**
 * What this launch already knows per file (see file-backoff.ts). One for each
 * direction: "the server has it" says nothing about whether this device does.
 */
const uploads = new FileBackoff();
const downloads = new FileBackoff();

/** Forget what was learned, e.g. after pairing with a different server. */
export function resetFileBackoff(): void {
  uploads.clear();
  downloads.clear();
}

/**
 * The most files one run may ask about, in each direction. Counted per
 * attempt, not per success: a run that fails 400 times is exactly the run
 * that must stop early.
 */
const MAX_ATTEMPTS_PER_RUN = 50;

/** Only our own uploads. An external link is not ours to copy. */
const ownUpload = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/uploads/');

const fileNameOf = (url: string) => url.slice('/uploads/'.length);

export type FileSyncResult = {
  fetched: number;
  missing: number;
  warnings: string[];
};

/**
 * Fetch anything referenced locally that this device does not have on disk.
 *
 * Runs after a pull, when the rows naming the files have already landed. Called
 * with the same bearer token the row exchange used - the uploads route is
 * authenticated, and it has to be: these are report cards and proof-of-work
 * photographs, not public assets.
 */
export async function fetchMissingFiles(
  userId: string,
  serverUrl: string,
  token: string,
  limit = 50
): Promise<FileSyncResult> {
  const result: FileSyncResult = { fetched: 0, missing: 0, warnings: [] };
  let attempts = 0;

  for (const model of APPLY_ORDER) {
    const columns = FILE_COLUMNS[model];
    if (!columns) continue;

    const rows = await prisma[model as 'task'].findMany({
      // Every model in FILE_COLUMNS carries userId directly; there is no
      // relation hop to make here, and a model that needed one would have to be
      // added deliberately rather than falling through unscoped.
      where: {
        userId,
        OR: columns.map((column) => ({ [column]: { startsWith: '/uploads/' } })),
      },
      select: Object.fromEntries([['id', true], ...columns.map((c) => [c, true])]),
    });

    for (const row of rows as Record<string, unknown>[]) {
      for (const column of columns) {
        const url = row[column];
        if (!ownUpload(url)) continue;

        const name = fileNameOf(url);
        const target = resolveUploadPath(name);
        // resolveUploadPath returns null for anything that tries to escape the
        // uploads directory. A name that fails it is not a file we will write.
        if (!target) {
          result.warnings.push(`Refused a suspicious upload name: ${name}`);
          continue;
        }
        if (existsSync(target)) continue;
        if (!downloads.shouldTry(name)) continue;

        if (result.fetched >= limit || attempts >= MAX_ATTEMPTS_PER_RUN) return result;
        attempts++;

        try {
          const response = await fetch(`${serverUrl}/uploads/${encodeURIComponent(name)}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            // The server does not have it either (lost, or never sent). Asking
            // again in twenty seconds will not change that.
            downloads.failed(name);
            result.missing++;
            continue;
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, bytes);
          downloads.succeeded(name);
          result.fetched++;
        } catch (error) {
          downloads.failed(name);
          result.warnings.push(`${name}: ${(error as Error).message}`);
        }
      }
    }
  }

  return result;
}

/**
 * Send up any file this device holds that the server has not got.
 *
 * Asks first rather than uploading blind: a device that has synced before
 * already shares most of these, and re-sending a term of PDFs on every sync
 * would make syncing something people turn off.
 */
export async function pushLocalFiles(
  userId: string,
  serverUrl: string,
  token: string,
  limit = 50
): Promise<FileSyncResult> {
  const result: FileSyncResult = { fetched: 0, missing: 0, warnings: [] };
  const { readFile } = await import('fs/promises');
  let attempts = 0;

  for (const model of APPLY_ORDER) {
    const columns = FILE_COLUMNS[model];
    if (!columns) continue;

    const rows = await prisma[model as 'task'].findMany({
      where: {
        userId,
        OR: columns.map((column) => ({ [column]: { startsWith: '/uploads/' } })),
      },
      select: Object.fromEntries([['id', true], ...columns.map((c) => [c, true])]),
    });

    for (const row of rows as Record<string, unknown>[]) {
      for (const column of columns) {
        const url = row[column];
        if (!ownUpload(url)) continue;

        const name = fileNameOf(url);
        const source = resolveUploadPath(name);
        if (!source || !existsSync(source)) continue;
        if (!uploads.shouldTry(name)) continue;
        if (result.fetched >= limit || attempts >= MAX_ATTEMPTS_PER_RUN) return result;
        attempts++;

        try {
          const head = await fetch(`${serverUrl}/api/sync/file?name=${encodeURIComponent(name)}`, {
            method: 'HEAD',
            headers: { authorization: `Bearer ${token}` },
          });
          if (head.ok) {
            // The server already has it: never ask about this file again this launch.
            uploads.succeeded(name);
            continue;
          }

          const bytes = new Blob([await readFile(source)]);
          if (bytes.size > DIRECT_UPLOAD_FROM_BYTES && (await pushDirect(serverUrl, token, name, bytes))) {
            uploads.succeeded(name);
            result.fetched++;
            continue;
          }

          const body = new FormData();
          body.append('name', name);
          body.append('file', bytes, name);

          const response = await fetch(`${serverUrl}/api/sync/file`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
            body,
          });
          if (response.ok) {
            uploads.succeeded(name);
            result.fetched++;
          } else {
            // Refused (too large, storage down, an older server): back off
            // instead of re-sending the whole file on every run.
            uploads.failed(name);
            result.missing++;
          }
        } catch (error) {
          uploads.failed(name);
          result.warnings.push(`${name}: ${(error as Error).message}`);
        }
      }
    }
  }

  return result;
}

/**
 * Above this, a POST through the website would hit Vercel's ~4.5 MB body
 * limit, so the file goes straight into the bucket instead.
 */
const DIRECT_UPLOAD_FROM_BYTES = 4 * 1024 * 1024;

/**
 * Ask for a signed URL and PUT the file to it. False when the server has no
 * bucket (or is older than the ticket route), so the caller posts it as before.
 */
async function pushDirect(serverUrl: string, token: string, name: string, bytes: Blob): Promise<boolean> {
  const response = await fetch(`${serverUrl}/api/sync/file/ticket`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, size: bytes.size }),
  });
  if (response.status === 404 || response.status === 501) return false;
  const data = (await response.json().catch(() => ({}))) as { uploadUrl?: string; alreadyHad?: boolean; error?: string };
  if (!response.ok) throw new Error(data.error ?? `ticket refused (${response.status})`);
  if (data.alreadyHad) return true;
  if (!data.uploadUrl) return false;
  await putToSignedUrl(data.uploadUrl, bytes, '');
  return true;
}

/** Where a device keeps its copies, for the log line that inevitably gets asked about. */
export const LOCAL_UPLOADS = UPLOAD_DIR;
