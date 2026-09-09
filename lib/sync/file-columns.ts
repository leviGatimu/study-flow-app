/**
 * Which columns hold an upload, and nothing else.
 *
 * Its own module, and deliberately importing NOTHING, for the same reason
 * lib/sync/identity.ts does: files.ts reaches for `@/lib/prisma`, which a plain
 * `node --test` cannot resolve, and a declaration nobody can test is a
 * declaration that drifts. The guard in test/sync/engine.test.mjs checks every
 * name here against the Prisma client's own metadata.
 */

/**
 * Every column that holds an upload URL.
 *
 * Listed rather than discovered: a URL column is only recognisable by what the
 * app does with it, and matching on the NAME would sweep in TutorModule's
 * sourcePdfUrl (a filename the user typed, not a stored file), UserProgress's
 * ollamaBaseUrl and SyncState's own serverUrl. Song.audioUrl and coverUrl are
 * absent for a different reason - the music library is local-only in v1.
 *
 * test/sync/engine.test.mjs checks every column here against the client's
 * metadata, because a typo would be invisible: the query builds its select
 * dynamically, so a wrong name is a runtime failure inside a sync, not a
 * compile error.
 */
export const FILE_COLUMNS: Record<string, string[]> = {
  task: ['proofPdfUrl'],
  resource: ['url'],
  reportCard: ['fileUrl'],
  homework: ['proofUrl'],
};
