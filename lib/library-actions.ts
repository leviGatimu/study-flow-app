'use server';

import { revalidatePath } from 'next/cache';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { byClass, getViewScope, requireWritableScope, type ClassScope } from '@/lib/scope';
import { normalizeSubject } from '@/lib/utils';
import {
  extensionOf,
  folderName,
  folderParent,
  isLibraryUrl,
  isWithinFolder,
  joinFolder,
  LIBRARY_DIR,
  libraryEnabled,
  nameError,
  normalizeFolder,
  rebaseFolder,
} from '@/lib/library';
import { reconcileLibrary, subjectFolderPath, yearFolderPath } from '@/lib/library-reconcile';
import {
  createFolderOnDisk,
  relocateOnDisk,
  removeFolderOnDisk,
  removeStoredFile,
  statStoredFile,
  storeResourceFile,
} from '@/lib/library-store';

/**
 * The resource explorer's server side.
 *
 * Every action here works on both builds. On the desktop it also touches the
 * library folder (lib/library-store.ts) so the tree in Windows Explorer and
 * the tree in the app never disagree; on the web the folder structure is
 * virtual and lives only in the rows.
 *
 * Results are returned, not thrown, because the explorer shows them inline:
 * "notes.pdf is already there" belongs next to the rename box, not in a
 * console.
 */

export type ResourceItem = {
  id: string;
  subject: string;
  title: string;
  type: 'FILE' | 'LINK' | 'FOLDER';
  url: string;
  folder: string;
  /** Lowercase extension for FILE rows, "" otherwise. */
  ext: string;
  size: number | null;
  createdAt: string;
  updatedAt: string;
  /** True for a FILE whose bytes live in the desktop library, not the flat store. */
  inLibrary: boolean;
};

export type SubjectLibrary = {
  subject: string;
  items: ResourceItem[];
  /** Absolute path of the subject's folder on the desktop; null on the web. */
  folderPath: string | null;
  /** Absolute path of the library root, for turning a url into a file path. */
  libraryDir: string | null;
  archived: boolean;
  /** Every subject in the year, this one included, for the navigation pane. */
  subjects: string[];
};

export type LibrarySubject = {
  name: string;
  files: number;
  links: number;
  folders: number;
  masteryDone: number;
  masteryTotal: number;
  /** ISO time of the newest item, for "updated 2 days ago". Null when empty. */
  lastAdded: string | null;
};

export type LibraryOverview = {
  subjects: LibrarySubject[];
  recent: ResourceItem[];
  /** Absolute path of the year's library folder on the desktop; null on the web. */
  folderPath: string | null;
  libraryDir: string | null;
  archived: boolean;
};

type ActionResult = { success: true } | { success: false; error: string };

type Row = {
  id: string;
  subject: string;
  title: string;
  type: string;
  url: string;
  folder: string;
  createdAt: Date;
  updatedAt: Date;
};

async function toItem(row: Row, withSize: boolean): Promise<ResourceItem> {
  const type = row.type === 'FOLDER' || row.type === 'LINK' ? row.type : 'FILE';
  const stats = withSize && type === 'FILE' ? await statStoredFile(row.url) : null;
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    type,
    url: row.url,
    folder: row.folder,
    ext: type === 'FILE' ? extensionOf(row.url) || extensionOf(row.title) : '',
    size: stats?.size ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: (stats?.modifiedAt ?? row.updatedAt).toISOString(),
    inLibrary: isLibraryUrl(row.url),
  };
}

function revalidate(subject?: string) {
  revalidatePath('/resources');
  if (subject) revalidatePath(`/resources/${encodeURIComponent(subject)}`);
  revalidatePath('/focus');
}

/** Subjects the year knows about, from every table that names one. */
async function knownSubjects(userId: string, scope: ClassScope | null): Promise<string[]> {
  const [subjects, templates, mastery] = await Promise.all([
    prisma.subject.findMany({ where: { userId, ...byClass(scope) }, select: { name: true } }),
    prisma.scheduleTemplate.findMany({ where: { userId, ...byClass(scope) }, select: { subject: true } }),
    prisma.masteryItem.findMany({ where: { userId, ...byClass(scope) }, select: { subject: true } }),
  ]);
  const names = new Set<string>();
  for (const s of subjects) names.add(normalizeSubject(s.name));
  for (const t of templates) names.add(normalizeSubject(t.subject));
  for (const m of mastery) names.add(normalizeSubject(m.subject));
  names.delete('');
  return Array.from(names);
}

// ------------------------------------------------------------------- reads

export async function getLibraryOverview(): Promise<LibraryOverview | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const scope = await getViewScope(userId);
  const known = await knownSubjects(userId, scope);
  const onDisk = (await reconcileLibrary(prisma, userId, scope, known))?.subjectsOnDisk ?? [];

  const [rows, mastery] = await Promise.all([
    prisma.resource.findMany({
      where: { userId, ...byClass(scope) },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.masteryItem.findMany({
      where: { userId, ...byClass(scope) },
      select: { subject: true, isCompleted: true },
    }),
  ]);

  const bySubject = new Map<string, LibrarySubject>();
  const ensure = (name: string) => {
    const n = normalizeSubject(name);
    if (!n) return null;
    let entry = bySubject.get(n.toLowerCase());
    if (!entry) {
      entry = { name: n, files: 0, links: 0, folders: 0, masteryDone: 0, masteryTotal: 0, lastAdded: null };
      bySubject.set(n.toLowerCase(), entry);
    }
    return entry;
  };

  for (const name of [...known, ...onDisk]) ensure(name);
  for (const row of rows) {
    const entry = ensure(row.subject);
    if (!entry) continue;
    if (row.type === 'FOLDER') entry.folders++;
    else if (row.type === 'LINK') entry.links++;
    else entry.files++;
    const at = row.createdAt.toISOString();
    if (!entry.lastAdded || at > entry.lastAdded) entry.lastAdded = at;
  }
  for (const m of mastery) {
    const entry = ensure(m.subject);
    if (!entry) continue;
    entry.masteryTotal++;
    if (m.isCompleted) entry.masteryDone++;
  }

  const recent = await Promise.all(
    rows.filter((r) => r.type !== 'FOLDER').slice(0, 8).map((r) => toItem(r, false))
  );

  return {
    subjects: Array.from(bySubject.values()).sort((a, b) => a.name.localeCompare(b.name)),
    recent,
    folderPath: yearFolderPath(scope),
    libraryDir: LIBRARY_DIR,
    archived: scope?.isArchive ?? false,
  };
}

export async function getSubjectLibrary(subject: string): Promise<SubjectLibrary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const normalized = normalizeSubject(subject);
  const scope = await getViewScope(userId);

  // Reconciling covers the whole year, not one subject, because a file moved
  // between two subject folders in Explorer has to disappear from one and
  // appear in the other in the same pass.
  const known = await knownSubjects(userId, scope);
  const onDisk = (await reconcileLibrary(prisma, userId, scope, [normalized, ...known]))?.subjectsOnDisk ?? [];

  const [rows, filed] = await Promise.all([
    prisma.resource.findMany({
      where: { userId, ...byClass(scope), subject: normalized },
      orderBy: [{ title: 'asc' }],
    }),
    prisma.resource.findMany({
      where: { userId, ...byClass(scope) },
      select: { subject: true },
      distinct: ['subject'],
    }),
  ]);

  const subjects = new Map<string, string>();
  for (const name of [normalized, ...known, ...onDisk, ...filed.map((f) => f.subject)]) {
    const n = normalizeSubject(name);
    if (n && !subjects.has(n.toLowerCase())) subjects.set(n.toLowerCase(), n);
  }

  return {
    subject: normalized,
    items: await Promise.all(rows.map((r) => toItem(r, true))),
    folderPath: subjectFolderPath(scope, normalized),
    libraryDir: LIBRARY_DIR,
    archived: scope?.isArchive ?? false,
    subjects: Array.from(subjects.values()).sort((a, b) => a.localeCompare(b)),
  };
}

// ------------------------------------------------------------------ writes

/** The row, if it is the caller's; the same shape every write starts from. */
async function ownRow(userId: string, id: string): Promise<Row | null> {
  return prisma.resource.findFirst({ where: { id, userId } });
}

/** Does anything in `folder` already use `title` (case-insensitively)? */
async function nameTaken(
  userId: string,
  scope: ClassScope | null,
  subject: string,
  folder: string,
  title: string,
  exceptId?: string
): Promise<boolean> {
  const siblings = await prisma.resource.findMany({
    where: { userId, ...byClass(scope), subject, folder, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { title: true, type: true },
  });
  return siblings.some((s) => s.type !== 'LINK' && s.title.toLowerCase() === title.toLowerCase());
}

/**
 * Rewrite a folder's descendants after it moved from `fromPath` to `toPath`.
 * Rows only: the directory itself was renamed in one call, which moved every
 * child with it, so only the stored paths and urls need to follow.
 */
async function rebaseDescendants(
  userId: string,
  scope: ClassScope | null,
  subject: string,
  fromPath: string,
  toPath: string,
  fromUrl: string,
  toUrl: string
) {
  const rows = await prisma.resource.findMany({
    where: { userId, ...byClass(scope), subject },
    select: { id: true, folder: true, url: true, type: true },
  });
  for (const row of rows) {
    if (!isWithinFolder(row.folder, fromPath)) continue;
    const data: { folder: string; url?: string } = { folder: rebaseFolder(row.folder, fromPath, toPath) };
    if (fromUrl && isLibraryUrl(row.url) && row.url.startsWith(fromUrl + '/')) {
      data.url = toUrl + row.url.slice(fromUrl.length);
    }
    await prisma.resource.update({ where: { id: row.id }, data });
  }
}

export async function createResourceFolder(
  subject: string,
  parent: string,
  name: string
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not signed in.' };

  const title = name.trim();
  const problem = nameError(title);
  if (problem) return { success: false, error: problem };

  try {
    const scope = await requireWritableScope(userId);
    const normalized = normalizeSubject(subject);
    const parentPath = normalizeFolder(parent);
    if (await nameTaken(userId, scope, normalized, parentPath, title)) {
      return { success: false, error: `A folder or file called "${title}" is already here.` };
    }

    const url = await createFolderOnDisk(scope, normalized, joinFolder(parentPath, title));
    await prisma.resource.create({
      data: { userId, subject: normalized, title, type: 'FOLDER', url, folder: parentPath, ...byClass(scope) },
    });
    revalidate(normalized);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function renameResource(id: string, name: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not signed in.' };

  try {
    const scope = await requireWritableScope(userId);
    const row = await ownRow(userId, id);
    if (!row) return { success: false, error: 'That item no longer exists.' };

    let title = name.trim();
    // Renaming "notes.pdf" to "Chapter 1" should not strip the extension:
    // Explorer keeps it, and the icon and viewer depend on it.
    if (row.type === 'FILE') {
      const ext = extensionOf(row.title);
      if (ext && !title.toLowerCase().endsWith(`.${ext}`)) title = `${title}.${ext}`;
    }
    const problem = row.type === 'LINK' ? (title ? null : 'Give it a name.') : nameError(title);
    if (problem) return { success: false, error: problem };
    if (title === row.title) return { success: true };

    if (row.type !== 'LINK' && (await nameTaken(userId, scope, row.subject, row.folder, title, id))) {
      return { success: false, error: `Something called "${title}" is already here.` };
    }

    const newPath = joinFolder(row.folder, title);
    const url = await relocateOnDisk(scope, row.subject, row.url, newPath);
    await prisma.resource.update({ where: { id }, data: { title, url } });

    if (row.type === 'FOLDER') {
      await rebaseDescendants(userId, scope, row.subject, joinFolder(row.folder, row.title), newPath, row.url, url);
    }
    revalidate(row.subject);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function moveResource(id: string, targetFolder: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not signed in.' };

  try {
    const scope = await requireWritableScope(userId);
    const row = await ownRow(userId, id);
    if (!row) return { success: false, error: 'That item no longer exists.' };

    const target = normalizeFolder(targetFolder);
    if (target === row.folder) return { success: true };

    const ownPath = joinFolder(row.folder, row.title);
    if (row.type === 'FOLDER' && isWithinFolder(target, ownPath)) {
      return { success: false, error: 'A folder cannot be moved into itself.' };
    }

    // The destination has to exist - as a FOLDER row, or implied by something
    // already filed beneath it - or the item would vanish into a path nothing
    // lists.
    if (target) {
      const exists = await prisma.resource.findFirst({
        where: {
          userId,
          ...byClass(scope),
          subject: row.subject,
          OR: [
            { type: 'FOLDER', folder: folderParent(target), title: folderName(target) },
            { folder: target },
            { folder: { startsWith: target + '/' } },
          ],
        },
        select: { id: true },
      });
      if (!exists) return { success: false, error: 'That folder does not exist any more.' };
    }

    if (row.type !== 'LINK' && (await nameTaken(userId, scope, row.subject, target, row.title, id))) {
      return { success: false, error: `Something called "${row.title}" is already in that folder.` };
    }

    const newPath = joinFolder(target, row.title);
    const url = await relocateOnDisk(scope, row.subject, row.url, newPath);
    await prisma.resource.update({ where: { id }, data: { folder: target, url } });

    if (row.type === 'FOLDER') {
      await rebaseDescendants(userId, scope, row.subject, ownPath, newPath, row.url, url);
    }
    revalidate(row.subject);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteResourceItem(id: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not signed in.' };

  try {
    const scope = await requireWritableScope(userId);
    const row = await ownRow(userId, id);
    if (!row) return { success: true };

    if (row.type === 'FOLDER') {
      const path = joinFolder(row.folder, row.title);
      const descendants = await prisma.resource.findMany({
        where: { userId, ...byClass(scope), subject: row.subject },
        select: { id: true, type: true, url: true, folder: true },
      });
      const inside = descendants.filter((d) => isWithinFolder(d.folder, path));

      // Bytes first: a tombstone pointing at a file that is still there is
      // recoverable by the reconciler, a file with no row is an orphan.
      if (libraryEnabled() && row.url) {
        await removeFolderOnDisk(row.url);
      } else {
        for (const d of inside) if (d.type === 'FILE') await removeStoredFile(d.url);
      }
      await softDelete(prisma, 'resource', { id: { in: [id, ...inside.map((d) => d.id)] }, userId });
    } else {
      if (row.type === 'FILE') await removeStoredFile(row.url);
      await softDelete(prisma, 'resource', { id, userId });
    }

    revalidate(row.subject);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Upload one or more files into a folder. Partial success is reported as
 * such: four PDFs and one .exe should land four PDFs and name the one that
 * did not, not fail the lot.
 */
export async function uploadResourceFiles(
  formData: FormData
): Promise<{ added: number; errors: string[] }> {
  const userId = await getUserId();
  if (!userId) return { added: 0, errors: ['Not signed in.'] };

  const errors: string[] = [];
  let added = 0;

  try {
    const scope = await requireWritableScope(userId);
    const subject = normalizeSubject(String(formData.get('subject') ?? ''));
    if (!subject) return { added: 0, errors: ['Choose a subject first.'] };
    const folder = normalizeFolder(String(formData.get('folder') ?? ''));

    const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { added: 0, errors: ['No files were selected.'] };

    for (const file of files) {
      try {
        const stored = await storeResourceFile(scope, subject, folder, file);
        await prisma.resource.create({
          data: { userId, subject, title: stored.title, type: 'FILE', url: stored.url, folder, ...byClass(scope) },
        });
        added++;
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    if (added > 0) revalidate(subject);
  } catch (error) {
    errors.push((error as Error).message);
  }

  return { added, errors };
}

export async function addResourceLink(
  subject: string,
  folder: string,
  title: string,
  url: string
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not signed in.' };

  const name = title.trim();
  let href = url.trim();
  if (!name) return { success: false, error: 'Give the link a name.' };
  if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href)) href = `https://${href}`;
  try {
    const parsed = new URL(href);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return { success: false, error: 'That does not look like a web address.' };
  }

  try {
    const scope = await requireWritableScope(userId);
    const normalized = normalizeSubject(subject);
    if (!normalized) return { success: false, error: 'Choose a subject first.' };
    await prisma.resource.create({
      data: {
        userId,
        subject: normalized,
        title: name,
        type: 'LINK',
        url: href,
        folder: normalizeFolder(folder),
        ...byClass(scope),
      },
    });
    revalidate(normalized);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
