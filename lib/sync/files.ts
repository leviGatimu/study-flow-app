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
 * KNOWN LIMIT, and it is not this file's to fix: on the web the uploads live on
 * Vercel's filesystem, which is ephemeral, unless SUPABASE_STORAGE_BUCKET and
 * its keys are set (Phase 8, written but never enabled). Until that bucket
 * exists the server has no durable copy to serve, so device-to-server file sync
 * works and server-to-device finds nothing to fetch. See HANDOFF.md.
 */

import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

import { prisma } from '@/lib/prisma';
import { resolveUploadPath, UPLOAD_DIR } from '@/lib/upload';
import { APPLY_ORDER } from './merge.ts';
import { FILE_COLUMNS } from './file-columns.ts';

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

        if (result.fetched >= limit) return result;

        try {
          const response = await fetch(`${serverUrl}/uploads/${encodeURIComponent(name)}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            result.missing++;
            continue;
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, bytes);
          result.fetched++;
        } catch (error) {
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
        if (result.fetched >= limit) return result;

        try {
          const head = await fetch(`${serverUrl}/api/sync/file?name=${encodeURIComponent(name)}`, {
            method: 'HEAD',
            headers: { authorization: `Bearer ${token}` },
          });
          if (head.ok) continue; // the server already has it

          const body = new FormData();
          body.append('name', name);
          body.append('file', new Blob([await readFile(source)]), name);

          const response = await fetch(`${serverUrl}/api/sync/file`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
            body,
          });
          if (response.ok) result.fetched++;
          else result.missing++;
        } catch (error) {
          result.warnings.push(`${name}: ${(error as Error).message}`);
        }
      }
    }
  }

  return result;
}

/** Where a device keeps its copies, for the log line that inevitably gets asked about. */
export const LOCAL_UPLOADS = UPLOAD_DIR;
