/**
 * Ownership for synced models that have no userId column.
 *
 * The push route overwrites userId on every incoming row with the signed-in
 * user, so a device cannot write into another account - for models that HAVE
 * the column. These do not: they are owned through a parent. A pushed row of
 * one of them is accepted only when its parent belongs to the pusher,
 * otherwise a device that learned another account's chat or set id could
 * write into it.
 *
 * Takes the database as a parameter (no runtime imports) so the sync harness
 * can exercise it against real SQLite.
 */

import type { SyncRow } from './merge.ts';

export const OWNED_THROUGH: Record<string, { relation: string; parentModel: string; fk: string }> = {
  subjectGrade: { relation: 'reportCard', parentModel: 'reportCard', fk: 'reportCardId' },
  chatMessage: { relation: 'session', parentModel: 'chatSession', fk: 'sessionId' },
  quizAttempt: { relation: 'module', parentModel: 'tutorModule', fk: 'moduleId' },
};

type CountDb = Record<string, { count: (args: unknown) => Promise<number> }>;

/**
 * Drop parent-owned rows whose parent belongs to someone else. A parent may
 * arrive in the same push (a new chat and its first messages), so a parent
 * row in the batch counts - the route has already set its userId to the
 * pusher. A tombstoned parent of the pusher's still counts: a message may be
 * deleted along with its session. Returns the kept rows and how many were
 * dropped.
 */
export async function keepOwnedRows(
  db: unknown,
  rows: SyncRow[],
  userId: string
): Promise<{ rows: SyncRow[]; dropped: number }> {
  const counter = db as CountDb;
  const kept: SyncRow[] = [];
  const known = new Map<string, boolean>();
  let dropped = 0;

  // A row whose id already exists under ANOTHER account is never applied:
  // merging by id would overwrite that row and hand it to the pusher (found
  // 2026-10-05 - an existing exam and chat were both taken over this way).
  const foreign = await foreignIds(db, rows, userId);

  for (const row of rows) {
    if (foreign.has(`${row.model}:${String(row.data.id)}`)) {
      dropped++;
      continue;
    }
    const rule = OWNED_THROUGH[row.model];
    if (!rule) {
      kept.push(row);
      continue;
    }
    const parentId = String(row.data[rule.fk] ?? '');
    const cacheKey = `${rule.parentModel}:${parentId}`;
    if (parentId && !known.has(cacheKey)) {
      const inBatch = rows.some(
        (r) => r.model === rule.parentModel && String(r.data.id) === parentId && r.data.userId === userId
      );
      const owned =
        inBatch ||
        (await counter[rule.parentModel].count({
          // Mentioning deletedAt opts this query out of the tombstone filter.
          where: { id: parentId, userId, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] },
        })) > 0;
      known.set(cacheKey, owned);
    }
    if (parentId && known.get(cacheKey)) kept.push(row);
    else dropped++;
  }
  return { rows: kept, dropped };
}

type FindDb = Record<string, { findMany: (args: unknown) => Promise<{ id: string }[]> }>;

/** "model:id" for every pushed row whose id exists but is not this user's. */
async function foreignIds(db: unknown, rows: SyncRow[], userId: string): Promise<Set<string>> {
  const finder = db as FindDb;
  const byModel = new Map<string, string[]>();
  for (const row of rows) {
    if (row.model === 'user' || row.data.id === undefined) continue;
    const ids = byModel.get(row.model) ?? [];
    ids.push(String(row.data.id));
    byModel.set(row.model, ids);
  }

  const foreign = new Set<string>();
  for (const [model, ids] of byModel) {
    const parent = OWNED_THROUGH[model];
    const notMine = parent ? { NOT: { [parent.relation]: { userId } } } : { NOT: { userId } };
    const hits = await finder[model].findMany({
      // Tombstones included (mentioning deletedAt opts out of the filter): a
      // deleted row of someone else's is still not this user's to rewrite.
      where: { id: { in: ids }, ...notMine, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] },
      select: { id: true },
    });
    for (const hit of hits) foreign.add(`${model}:${hit.id}`);
  }
  return foreign;
}
