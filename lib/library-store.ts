import { existsSync } from 'fs';
import { mkdir, rename, rm, stat, unlink, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';

import type { ClassScope } from '@/lib/scope';
import { deleteUpload, resolveUploadPath, saveUpload } from '@/lib/upload';
import {
  dedupeName,
  folderDir,
  isLibraryUrl,
  isUploadUrl,
  libraryEnabled,
  libraryRoot,
  libraryUrlFor,
  resolveLibraryUrl,
  safeSegment,
} from '@/lib/library';

/**
 * Where a resource's bytes go, and how they move.
 *
 * Two backends behind one contract, chosen by libraryEnabled():
 *
 *   desktop  the file is written under its subject's folder with its own
 *            name, and the row's url is "/library/<path>";
 *   web      lib/upload.ts as before - flat, timestamp-prefixed, "/uploads/".
 *
 * Deliberately NOT a 'use server' module. These take a userId or a resolved
 * scope as arguments, which would make them privilege holes if the client
 * could call them; lib/library-actions.ts wraps them behind the session.
 */

export type StoredFile = { url: string; title: string };

// Same allowlist reasoning as lib/upload.ts, applied before a byte is written.
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv',
  'mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus',
  'mp4', 'webm',
]);
// Under the 64 MB server-action body limit in next.config.ts, and the same
// ceiling the music library already uses.
export const MAX_LIBRARY_FILE_BYTES = 60 * 1024 * 1024;

export function fileTypeError(file: File): string | null {
  if (!file || file.size === 0) return `${file?.name || 'That file'} is empty.`;
  if (file.size > MAX_LIBRARY_FILE_BYTES) return `${file.name} is larger than 60 MB.`;
  const ext = extname(file.name).slice(1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return `${file.name}: .${ext || '?'} files are not supported.`;
  return null;
}

/**
 * Persist an uploaded file for a resource. The returned title is the name it
 * ended up with, which on the desktop is what Explorer shows.
 */
export async function storeResourceFile(
  scope: ClassScope | null,
  subject: string,
  folder: string,
  file: File
): Promise<StoredFile> {
  const problem = fileTypeError(file);
  if (problem) throw new Error(problem);

  if (!libraryEnabled()) {
    const url = await saveUpload(file, 'resource', MAX_LIBRARY_FILE_BYTES);
    return { url, title: basename(file.name) };
  }

  const dir = folderDir(libraryRoot(scope?.label ?? null), subject, folder);
  await mkdir(dir, { recursive: true });

  const ext = extname(file.name);
  const stem = safeSegment(basename(file.name, ext)) || 'file';
  const name = dedupeName(`${stem}${ext.toLowerCase()}`, (c) => existsSync(join(dir, c)));
  const target = join(dir, name);

  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return { url: libraryUrlFor(target), title: name };
}

/** Delete the bytes behind a FILE row, whichever store holds them. */
export async function removeStoredFile(url: string): Promise<void> {
  if (isLibraryUrl(url)) {
    const full = resolveLibraryUrl(url);
    if (!full) return;
    try {
      await unlink(full);
    } catch {
      // Already gone from Explorer; the row is being tombstoned anyway.
    }
    return;
  }
  if (isUploadUrl(url)) await deleteUpload(url);
}

/** Size and mtime for the details rail; null when the bytes are not local. */
export async function statStoredFile(url: string): Promise<{ size: number; modifiedAt: Date } | null> {
  const full = isLibraryUrl(url)
    ? resolveLibraryUrl(url)
    : isUploadUrl(url)
      ? resolveUploadPath(url.slice('/uploads/'.length))
      : null;
  if (!full) return null;
  try {
    const info = await stat(full);
    return info.isFile() ? { size: info.size, modifiedAt: info.mtime } : null;
  } catch {
    return null;
  }
}

/** Create a folder's directory; returns its url, or "" off the desktop. */
export async function createFolderOnDisk(
  scope: ClassScope | null,
  subject: string,
  path: string
): Promise<string> {
  if (!libraryEnabled()) return '';
  const dir = folderDir(libraryRoot(scope?.label ?? null), subject, path);
  await mkdir(dir, { recursive: true });
  return libraryUrlFor(dir);
}

/**
 * Move or rename a file or directory that a row points at. Returns the url
 * to store, or the old url unchanged when nothing on disk was involved.
 *
 * Refuses to overwrite: Explorer would ask, and a server action cannot.
 */
export async function relocateOnDisk(
  scope: ClassScope | null,
  subject: string,
  currentUrl: string,
  newPath: string
): Promise<string> {
  if (!libraryEnabled() || !isLibraryUrl(currentUrl)) return currentUrl;

  const from = resolveLibraryUrl(currentUrl);
  if (!from) throw new Error('That item is missing from the library folder.');

  const to = folderDir(libraryRoot(scope?.label ?? null), subject, newPath);
  if (from === to) return currentUrl;
  // NTFS is case-insensitive, so "notes.pdf" -> "Notes.pdf" finds itself
  // already there. That is a rename, not a collision.
  const caseOnly = from.toLowerCase() === to.toLowerCase();
  if (!caseOnly && existsSync(to)) {
    throw new Error(`Something called "${basename(to)}" is already there.`);
  }

  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
  return libraryUrlFor(to);
}

/** Remove a folder's directory and everything in it. */
export async function removeFolderOnDisk(url: string): Promise<void> {
  if (!isLibraryUrl(url)) return;
  const full = resolveLibraryUrl(url);
  if (!full) return;
  await rm(full, { recursive: true, force: true });
}
