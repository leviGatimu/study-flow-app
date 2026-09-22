import { existsSync } from 'fs';
import { mkdir, readdir, rename } from 'fs/promises';
import { extname, join } from 'path';

// Relative, extension-qualified imports and NO `@/lib/prisma`: the client is
// injected, so test/library-reconcile.test.mjs can drive this against a real
// SQLite database and a temp directory under plain `node --test`.
import { softDelete, type Db } from './soft-delete.ts';
import type { ClassScope } from './scope';
import { resolveUploadPath } from './upload.ts';
import {
  dedupeName,
  folderDir,
  isIgnoredEntry,
  isLibraryUrl,
  isUploadUrl,
  joinFolder,
  LIBRARY_DIR,
  libraryRoot,
  libraryUrlFor,
  resolveLibraryUrl,
  safeSegment,
  subjectDir,
} from './library.ts';

/**
 * Make the Resource rows agree with the library folder on disk.
 *
 * The folder is the truth on the desktop: the student can add, rename and
 * delete things in Windows Explorer and expects the app to notice. The rows
 * are the index everything else reads. This runs when a resources page loads
 * and does four things, all idempotent:
 *
 *   1. A directory for every known subject, so the tree is there to drop
 *      files into before anything has been uploaded.
 *   2. A row for every file and folder on disk that has none.
 *   3. Tombstones for rows whose file or folder has gone from the disk.
 *   4. Files from the old flat store moved into their subject's folder, once.
 *
 * Deliberately conservative in two places. A FOLDER row that has never been
 * on this disk (url "") is CREATED as a directory - that is how a folder made
 * on the website reaches the desktop - but one that has been (url set) and is
 * now missing was deleted by the student and is tombstoned, not resurrected.
 * And step 4 only touches files that exist locally: a row whose bytes never
 * arrived is left exactly as it is.
 *
 * Bounded, because a stray move into the library could bring a whole drive
 * with it: eight levels deep and a few thousand entries per pass.
 */

const MAX_DEPTH = 8;
const MAX_ENTRIES = 4000;

type Row = {
  id: string;
  subject: string;
  title: string;
  type: string;
  url: string;
  folder: string;
  classId: string | null;
};

export type ReconcileResult = {
  /** Subject folders found on disk, by the subject name they map to. */
  subjectsOnDisk: string[];
  created: number;
  removed: number;
  migrated: number;
};

/** Case-insensitive, like NTFS. */
const key = (s: string) => s.toLowerCase();

export async function reconcileLibrary(
  db: Db,
  userId: string,
  scope: ClassScope | null,
  knownSubjects: string[],
  /** The library root. Defaults to LIBRARY_DIR; tests point it at a temp dir. */
  dir: string | null = LIBRARY_DIR
): Promise<ReconcileResult | null> {
  // A finished year is a record, not a workspace: nothing is written for it,
  // on disk or in the table.
  if (!dir || scope?.isArchive) return null;

  const root = libraryRoot(scope?.label ?? null, dir);
  const result: ReconcileResult = { subjectsOnDisk: [], created: 0, removed: 0, migrated: 0 };
  const inClass = scope ? { classId: scope.classId } : {};
  const url = (abs: string) => libraryUrlFor(abs, dir);
  const pathOf = (u: string) => resolveLibraryUrl(u, dir);

  await mkdir(root, { recursive: true });

  // deletedAt is filtered explicitly rather than trusting the soft-delete
  // extension: a tombstoned FOLDER row with no url would otherwise be
  // re-created as a directory on every visit.
  const rows = (await db.resource.findMany({
    where: { userId, ...inClass, deletedAt: null },
    select: { id: true, subject: true, title: true, type: true, url: true, folder: true, classId: true },
  })) as Row[];

  // Directory name -> subject name. Subjects come from the timetable and the
  // rows; a directory nobody recognises is a subject the student created in
  // Explorer, and its name is the subject.
  const subjects = new Map<string, string>();
  for (const s of [...knownSubjects, ...rows.map((r) => r.subject)]) {
    if (s && !subjects.has(key(safeSegment(s)))) subjects.set(key(safeSegment(s)), s);
  }

  // 1. Every subject gets its directory.
  for (const subject of subjects.values()) {
    await mkdir(subjectDir(root, subject), { recursive: true });
  }

  // 4 (first, so the walk below sees the moved files). Legacy flat uploads.
  for (const row of rows) {
    if (row.type !== 'FILE' || !isUploadUrl(row.url)) continue;
    const source = resolveUploadPath(row.url.slice('/uploads/'.length));
    if (!source || !existsSync(source)) continue;

    const into = folderDir(root, row.subject, row.folder);
    await mkdir(into, { recursive: true });
    const ext = extname(source);
    const stem = safeSegment(ext ? row.title.replace(new RegExp(`${ext.replace('.', '\\.')}$`, 'i'), '') : row.title);
    const name = dedupeName(`${stem}${ext}`, (c) => existsSync(join(into, c)));
    const target = join(into, name);

    try {
      await rename(source, target);
    } catch (error) {
      console.warn(`[library] could not move ${source} into the library:`, error);
      continue;
    }
    await db.resource.update({
      where: { id: row.id },
      data: { url: url(target), title: name },
    });
    row.url = url(target);
    row.title = name;
    result.migrated++;
  }

  // 2 + 3 need to know what is where.
  const filesByUrl = new Map<string, Row>();
  const foldersByPath = new Map<string, Row>(); // "subject\u0000folder/title"
  for (const row of rows) {
    if (row.type === 'FILE' && isLibraryUrl(row.url)) filesByUrl.set(row.url, row);
    if (row.type === 'FOLDER') {
      foldersByPath.set(`${key(row.subject)}\u0000${key(joinFolder(row.folder, row.title))}`, row);
    }
  }

  // A FOLDER row that has never existed on this disk becomes a directory.
  for (const row of rows) {
    if (row.type !== 'FOLDER' || row.url) continue;
    const made = folderDir(root, row.subject, joinFolder(row.folder, row.title));
    await mkdir(made, { recursive: true });
    await db.resource.update({ where: { id: row.id }, data: { url: url(made) } });
    row.url = url(made);
  }

  const seenFiles = new Set<string>();
  const seenFolders = new Set<string>();
  let entries = 0;

  async function walk(subject: string, at: string, folder: string, depth: number) {
    if (depth > MAX_DEPTH) return;
    let items: import('fs').Dirent[];
    try {
      items = await readdir(at, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (++entries > MAX_ENTRIES) return;
      if (isIgnoredEntry(item.name)) continue;
      const full = join(at, item.name);

      if (item.isDirectory()) {
        const path = joinFolder(folder, item.name);
        const k = `${key(subject)}\u0000${key(path)}`;
        seenFolders.add(k);
        if (!foldersByPath.has(k)) {
          await db.resource.create({
            data: { userId, subject, title: item.name, type: 'FOLDER', url: url(full), folder, ...inClass },
          });
          result.created++;
        }
        await walk(subject, full, path, depth + 1);
      } else if (item.isFile()) {
        const fileUrl = url(full);
        seenFiles.add(fileUrl);
        if (!filesByUrl.has(fileUrl)) {
          await db.resource.create({
            data: { userId, subject, title: item.name, type: 'FILE', url: fileUrl, folder, ...inClass },
          });
          result.created++;
        }
      }
    }
  }

  let topLevel: import('fs').Dirent[] = [];
  try {
    topLevel = await readdir(root, { withFileTypes: true });
  } catch {
    // Unreadable root: nothing to index, and nothing to remove either.
    return result;
  }

  for (const entry of topLevel) {
    if (!entry.isDirectory() || isIgnoredEntry(entry.name)) continue;
    const subject = subjects.get(key(entry.name)) ?? entry.name;
    result.subjectsOnDisk.push(subject);
    await walk(subject, join(root, entry.name), '', 1);
  }

  // 3. Rows whose file or folder is no longer on the disk. Only rows under
  // THIS year's root are judged by the walk; anything pointing elsewhere (a
  // year folder that was renamed, say) is checked by its own path so a rename
  // never reads as a mass deletion.
  const gone: string[] = [];
  for (const row of rows) {
    if (row.type === 'FILE' && isLibraryUrl(row.url) && !seenFiles.has(row.url)) {
      const full = pathOf(row.url);
      if (!full || !existsSync(full)) gone.push(row.id);
    }
    if (row.type === 'FOLDER' && row.url) {
      const k = `${key(row.subject)}\u0000${key(joinFolder(row.folder, row.title))}`;
      if (!seenFolders.has(k)) {
        const full = pathOf(row.url);
        if (!full || !existsSync(full)) gone.push(row.id);
      }
    }
  }
  if (gone.length > 0) {
    result.removed = await softDelete(db, 'resource', { id: { in: gone }, userId });
  }

  return result;
}

/** The year's directory, for the "Open folder" button on the overview. */
export function yearFolderPath(scope: ClassScope | null): string | null {
  if (!LIBRARY_DIR) return null;
  return libraryRoot(scope?.label ?? null);
}

/** The subject directory, for "Open folder" buttons and the details rail. */
export function subjectFolderPath(scope: ClassScope | null, subject: string): string | null {
  if (!LIBRARY_DIR) return null;
  return subjectDir(libraryRoot(scope?.label ?? null), subject);
}
