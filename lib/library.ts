import { extname, join, resolve, sep } from 'path';

/**
 * The resource library: a real folder per subject on the desktop.
 *
 * WHY THIS EXISTS. Resources used to be rows whose files were dumped, flat and
 * timestamp-prefixed, into an uploads directory buried in AppData. That is
 * storage, not organisation - nothing a student could open in Windows Explorer
 * and recognise. On the desktop the library is now a visible tree:
 *
 *     Documents\Study Tracker\<Year>\<Subject>\<folder...>\<file>
 *
 * The rows in the Resource table remain the index the rest of the app reads
 * (the focus page, the studio, search, sync); lib/library-reconcile.ts keeps
 * them following the disk, so a PDF dropped into the folder from Explorer
 * appears in the app and a file deleted there disappears from it.
 *
 * On the web there is no disk to mirror. The same `folder` column gives the
 * explorer its virtual tree, and files stay in the flat store as before.
 *
 * This module is PURE: names, paths and URLs only, no filesystem and no
 * Prisma, so test/library.test.mjs can exercise every rule directly.
 */

/** Set by the Electron launcher. Absent on the web build and in `next dev`. */
export const LIBRARY_DIR: string | null = process.env.LIBRARY_DIR
  ? resolve(process.env.LIBRARY_DIR)
  : null;

export function libraryEnabled(): boolean {
  return LIBRARY_DIR !== null;
}

export const LIBRARY_URL_PREFIX = '/library/';

export const isLibraryUrl = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith(LIBRARY_URL_PREFIX);

export const isUploadUrl = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/');

// Names and folder paths live in their own dependency-free modules, which the
// client bundle imports too - this one reaches for `path` and process.env and
// must not end up there.
import { INVALID_CHARS, safeSegment } from './library-names.ts';
export { MAX_NAME_LENGTH, nameError, safeSegment } from './library-names.ts';
export {
  folderAncestors,
  folderName,
  folderParent,
  isWithinFolder,
  joinFolder,
  normalizeFolder,
  rebaseFolder,
} from './library-paths.ts';

/** "notes (2).pdf" for the second "notes.pdf" in the same folder. */
export function dedupeName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const ext = extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken(candidate)) return candidate;
  }
  throw new Error(`Could not find a free name for ${name}`);
}

// ------------------------------------------------------------------- paths

/**
 * The directory a year's subjects live under. The label is free text ("Year
 * 2", "2025/2026"), so it is coerced; a user without a class yet gets the
 * library root itself.
 */
export function libraryRoot(yearLabel: string | null, dir: string | null = LIBRARY_DIR): string {
  if (!dir) throw new Error('The library is not enabled on this build.');
  return yearLabel ? join(dir, safeSegment(yearLabel)) : dir;
}

export function subjectDir(root: string, subject: string): string {
  return join(root, safeSegment(subject));
}

/** Absolute path of a folder (or the subject root when `folder` is ""). */
export function folderDir(root: string, subject: string, folder: string): string {
  const base = subjectDir(root, subject);
  return folder ? join(base, ...folder.split('/')) : base;
}

/**
 * The URL stored on a row for a file at `absPath`: "/library/" plus the path
 * relative to LIBRARY_DIR, each segment encoded. Encoded rather than raw so a
 * "#" or "?" in a file name cannot truncate the link.
 */
export function libraryUrlFor(absPath: string, dir: string | null = LIBRARY_DIR): string {
  if (!dir) throw new Error('The library is not enabled on this build.');
  const root = resolve(dir);
  const full = resolve(absPath);
  if (!(full === root || full.startsWith(root + sep))) {
    throw new Error(`${absPath} is outside the library`);
  }
  const rel = full.slice(root.length).split(sep).filter(Boolean);
  return LIBRARY_URL_PREFIX + rel.map(encodeURIComponent).join('/');
}

/**
 * Turn a stored "/library/..." URL back into an absolute path, or null when
 * it is malformed or tries to escape. This is the only check between a URL a
 * client sent and the disk, so it refuses rather than repairs.
 */
export function resolveLibraryUrl(url: string, dir: string | null = LIBRARY_DIR): string | null {
  if (!dir || !isLibraryUrl(url)) return null;
  const encoded = url.slice(LIBRARY_URL_PREFIX.length).split('?')[0];
  if (!encoded) return null;

  const segments: string[] = [];
  for (const part of encoded.split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      return null;
    }
    if (!decoded || decoded === '.' || decoded === '..') return null;
    if (INVALID_CHARS.test(decoded)) return null;
    segments.push(decoded);
  }

  const root = resolve(dir);
  const full = resolve(root, ...segments);
  return full !== root && full.startsWith(root + sep) ? full : null;
}

/**
 * Where a URL points, relative to the library root, as display text:
 * "Year 2\Physics\Chapter 1\notes.pdf".
 */
export function libraryDisplayPath(url: string): string | null {
  if (!isLibraryUrl(url)) return null;
  try {
    return url
      .slice(LIBRARY_URL_PREFIX.length)
      .split('/')
      .map(decodeURIComponent)
      .join('\\');
  } catch {
    return null;
  }
}

/** The file name a stored URL ends in, decoded. */
export function fileNameFromUrl(url: string): string {
  const last = url.split('?')[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** The extension of a stored file, lowercase, without the dot. */
export function extensionOf(nameOrUrl: string): string {
  return extname(fileNameFromUrl(nameOrUrl)).slice(1).toLowerCase();
}

/**
 * Files Windows and editors leave behind that are noise, not resources.
 * Anything hidden by convention is skipped; a student never put it there.
 */
export function isIgnoredEntry(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('.') ||
    lower.startsWith('~$') ||
    lower === 'desktop.ini' ||
    lower === 'thumbs.db' ||
    lower.endsWith('.tmp') ||
    lower.endsWith('.crdownload') ||
    lower.endsWith('.part')
  );
}
