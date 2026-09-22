/**
 * Pure helpers for the `folder` column: "" is the subject root, otherwise
 * "/"-joined folder names. Nothing here touches the filesystem, so it is
 * safe in the client bundle (the explorer builds breadcrumbs with it) and
 * under plain `node --test`.
 */

import { nameError } from './library-names.ts';

/**
 * Canonical form of a `folder` value: "" for the subject root, otherwise
 * "/"-joined segments with no empty, dot or invalid parts. Throws on anything
 * else so a bad path from a client never reaches the disk.
 */
export function normalizeFolder(folder: string | null | undefined): string {
  if (!folder) return '';
  const parts = folder
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const error = nameError(part);
    if (error) throw new Error(`Invalid folder path "${folder}": ${error}`);
  }
  return parts.join('/');
}

export function folderParent(folder: string): string {
  const i = folder.lastIndexOf('/');
  return i === -1 ? '' : folder.slice(0, i);
}

export function folderName(folder: string): string {
  const i = folder.lastIndexOf('/');
  return i === -1 ? folder : folder.slice(i + 1);
}

export function joinFolder(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** True when `folder` is `ancestor` itself or sits somewhere beneath it. */
export function isWithinFolder(folder: string, ancestor: string): boolean {
  if (ancestor === '') return true;
  return folder === ancestor || folder.startsWith(ancestor + '/');
}

/**
 * Re-root `folder` from `from` to `to`. Used when a folder is renamed or
 * moved: every descendant row's `folder` is rewritten with this.
 */
export function rebaseFolder(folder: string, from: string, to: string): string {
  if (folder === from) return to;
  if (!isWithinFolder(folder, from)) return folder;
  const rest = folder.slice(from.length + 1);
  return joinFolder(to, rest);
}

/** Every ancestor of a folder path, nearest last: "a/b/c" -> ["a", "a/b"]. */
export function folderAncestors(folder: string): string[] {
  const out: string[] = [];
  const parts = folder.split('/').filter(Boolean);
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

