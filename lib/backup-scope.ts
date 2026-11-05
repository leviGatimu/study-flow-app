/**
 * Which rows of a backup a restore may bring back.
 *
 * A restore replaces the year you are in - never a finished one. Finished
 * years stay in the database untouched, so a backup row that belongs to one
 * of them is skipped rather than copied into the current year (which is what
 * restores used to do, merging every year's history into one).
 *
 * - Backups from 1.1 on name each row's year: `classId` on year-scoped rows,
 *   `termId` (resolved through the backup's `terms`) on term-scoped ones. A
 *   row is kept when that year is the backup's own active year, or when it
 *   names no year at all (rows from before years existed).
 * - 1.0 backups carry no year. Dated rows from before the current year began
 *   belong to a finished year and are skipped; undated rows are kept.
 *
 * Pure, so test/backup-scope.test.mjs can run it under plain node.
 */

export type BackupYearInfo = {
  /** The year that was active when the backup was made (1.1+). */
  activeClassId?: string | null;
  /** term id -> class id for every term in the backup (1.1+). */
  terms?: { id: string; classId: string | null }[];
};

export type RestoreRow = {
  classId?: string | null;
  termId?: string | null;
  /** ISO date for dated rows (tasks, exams, marked days, homework). */
  date?: string | null;
};

export function makeRestoreFilter(backup: BackupYearInfo, currentYearStart: Date | null) {
  const versioned = typeof backup.activeClassId === 'string' && backup.activeClassId !== '';
  const termClass = new Map((backup.terms ?? []).map((t) => [t.id, t.classId]));

  return function keep(row: RestoreRow): boolean {
    if (versioned) {
      const yearOf = row.classId ?? (row.termId ? termClass.get(row.termId) ?? null : null);
      return yearOf === null || yearOf === undefined || yearOf === backup.activeClassId;
    }
    if (!currentYearStart || !row.date) return true;
    const when = new Date(row.date);
    return Number.isNaN(when.getTime()) || when >= currentYearStart;
  };
}
