import { prisma } from '@/lib/prisma';

/**
 * Whether a stored file belongs to this user (audit D17).
 *
 * The file routes used to check only that SOMEONE was signed in, then serve
 * whatever filename was asked for - so a second account that learned a name
 * could read another account's proof of work, report scans or audio. A file is
 * now readable (and, through sync, writable) only when one of the user's own
 * live records points at it.
 *
 * These are every column that stores an uploaded file's URL; a new one must be
 * added here or its files will 404 for their owner - the safe failure.
 * ReportCard.fileUrl is not one: it records the original filename only.
 */
export async function ownsUpload(userId: string, name: string): Promise<boolean> {
  if (!name || name.includes('/') || name.includes('\\')) return false;
  const tail = `/uploads/${name}`;

  // The soft-delete extension hides tombstoned rows, so a deleted record no
  // longer grants access to its file.
  const [profile, task, homework, resource, song] = await Promise.all([
    prisma.userProgress.count({ where: { userId, avatarUrl: { endsWith: tail } } }),
    prisma.task.count({ where: { userId, proofPdfUrl: { endsWith: tail } } }),
    prisma.homework.count({ where: { userId, proofUrl: { endsWith: tail } } }),
    prisma.resource.count({ where: { userId, url: { endsWith: tail } } }),
    prisma.song.count({
      where: { userId, OR: [{ audioUrl: { endsWith: tail } }, { coverUrl: { endsWith: tail } }] },
    }),
  ]);
  return task + homework + resource + song + profile > 0;
}

/**
 * Whether a desktop library file belongs to this user: a Resource row of
 * theirs records exactly this /library/... URL. One desktop can hold more than
 * one account, and they share one Documents folder.
 */
export async function ownsLibraryFile(userId: string, pathname: string): Promise<boolean> {
  const count = await prisma.resource.count({ where: { userId, url: pathname } });
  return count > 0;
}
