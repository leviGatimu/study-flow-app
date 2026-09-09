/**
 * Deleting a row has to leave a mark.
 *
 * Every model in this schema carries a `deletedAt` column and 42 queries
 * already filter on it - but until now nothing ever WROTE one. All 45 delete
 * call sites removed the row outright, which is fine for a single database and
 * fatal for two: a row that simply vanishes is indistinguishable from a row the
 * other device has not seen yet, so the next sync resurrects everything you
 * deleted. A tombstone is what turns "gone" into a fact that can travel.
 *
 * The two halves of this file are deliberately different in character:
 *
 *   READS are filtered by a Prisma client extension (see softDeleteExtension).
 *   Filtering has to happen at EVERY read or deleted rows come back in the UI,
 *   and there are well over a hundred of them spread across ten files with no
 *   shared query layer. That is not something call sites can be trusted to
 *   remember, so it is applied centrally and invisibly.
 *
 *   WRITES go through the explicit softDelete() helper below. The opposite
 *   reasoning applies: a delete that silently means something other than delete
 *   is exactly the kind of magic that hides bugs, and two paths in this app
 *   (restoring a backup, and purging old tombstones) genuinely do want the row
 *   gone. Making the soft path explicit keeps the hard path honest.
 *
 * test/sync/soft-delete.test.mjs guards both halves, including a drift test
 * that fails if a raw .delete()/.deleteMany() appears outside the allow-list.
 *
 * This module deliberately imports NOTHING at runtime. The generated Prisma
 * client is a directory import, which webpack resolves and plain Node ESM does
 * not, so importing it here would put this file out of reach of `node --test` -
 * exactly the reach the tests need. lib/sync/identity.ts is dependency-free for
 * the same reason.
 */

/**
 * What `ON DELETE CASCADE` used to do for us, as data.
 *
 * A hard delete of a Class took its terms, subjects and templates with it,
 * because the foreign keys say so. A soft delete does not - the parent is
 * merely flagged, and the database has no idea anything happened - so the
 * cascade has to be reproduced by hand or the app is left showing terms whose
 * year is gone.
 *
 * Generated from the 49 `onDelete: Cascade` relations in prisma/schema.prisma.
 * The test re-derives it from the schema and fails on drift, so do not edit
 * this by hand to work around a failure - fix the schema or the test.
 */
export const SOFT_DELETE_CASCADES: Record<string, { model: string; fk: string }[]> = {
  chatSession: [{ model: 'chatMessage', fk: 'sessionId' }],
  class: [
    { model: 'aiNote', fk: 'classId' },
    { model: 'chatSession', fk: 'classId' },
    { model: 'masteryItem', fk: 'classId' },
    { model: 'project', fk: 'classId' },
    { model: 'quizAttempt', fk: 'classId' },
    { model: 'resource', fk: 'classId' },
    { model: 'scheduleTemplate', fk: 'classId' },
    { model: 'stickyNote', fk: 'classId' },
    { model: 'studioNote', fk: 'classId' },
    { model: 'subject', fk: 'classId' },
    { model: 'subjectGoal', fk: 'classId' },
    { model: 'subjectGrade', fk: 'classId' },
    { model: 'term', fk: 'classId' },
    { model: 'tutorModule', fk: 'classId' },
  ],
  project: [{ model: 'projectDoc', fk: 'projectId' }],
  reportCard: [{ model: 'subjectGrade', fk: 'reportCardId' }],
  scheduleTemplate: [{ model: 'task', fk: 'templateId' }],
  term: [
    { model: 'dailySummary', fk: 'termId' },
    { model: 'examEvent', fk: 'termId' },
    { model: 'homework', fk: 'termId' },
    { model: 'markedDay', fk: 'termId' },
    { model: 'reportCard', fk: 'termId' },
    { model: 'task', fk: 'termId' },
    { model: 'weeklySummary', fk: 'termId' },
  ],
  tutorModule: [{ model: 'quizAttempt', fk: 'moduleId' }],
  user: [
    { model: 'aiNote', fk: 'userId' },
    { model: 'chatSession', fk: 'userId' },
    { model: 'class', fk: 'userId' },
    { model: 'dailySummary', fk: 'userId' },
    { model: 'examEvent', fk: 'userId' },
    { model: 'homework', fk: 'userId' },
    { model: 'markedDay', fk: 'userId' },
    { model: 'masteryItem', fk: 'userId' },
    { model: 'playlist', fk: 'userId' },
    { model: 'project', fk: 'userId' },
    { model: 'reportCard', fk: 'userId' },
    { model: 'resource', fk: 'userId' },
    { model: 'scheduleTemplate', fk: 'userId' },
    { model: 'song', fk: 'userId' },
    { model: 'stickyNote', fk: 'userId' },
    { model: 'studioNote', fk: 'userId' },
    { model: 'subject', fk: 'userId' },
    { model: 'subjectGoal', fk: 'userId' },
    { model: 'task', fk: 'userId' },
    { model: 'tutorModule', fk: 'userId' },
    { model: 'userProgress', fk: 'userId' },
    { model: 'weeklySummary', fk: 'userId' },
    { model: 'xpEvent', fk: 'userId' },
  ],
};

/**
 * Opt one query out of the tombstone filter.
 *
 * Spread it into a `where` to say "I mean all of them, deleted included":
 *
 *   where: { userId, ...INCLUDE_DELETED, date: { gte: start } }
 *
 * The extension leaves any query alone that mentions `deletedAt` itself, and an
 * explicit `undefined` counts as mentioning it while Prisma treats it as no
 * filter at all. Written as a named constant rather than an inline
 * `deletedAt: undefined` because that reads like a mistake, and because this is
 * the thing you want to be able to grep for.
 *
 * Deliberately rare. The one load-bearing use is task generation, which has to
 * see deleted tasks so that a block you removed does not come back tomorrow.
 */
export const INCLUDE_DELETED = { deletedAt: undefined } as const;

/**
 * The read operations that take a `where` we can narrow.
 *
 * findUnique is deliberately absent: its `where` only accepts unique fields, so
 * `deletedAt: null` is rejected outright. It is handled by filtering the result
 * instead - see the extension below.
 */
const FILTERABLE_READS = [
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

/**
 * True when the caller has already said something about tombstones.
 *
 * A query that asks for deleted rows on purpose - the archive views, the purge
 * job, a sync push reading its own tombstones to send them - must not have that
 * intent quietly overwritten. Checking only the top level is deliberate: a
 * nested `deletedAt` inside an OR is answering a different question.
 */
function mentionsDeletedAt(where: unknown): boolean {
  return !!where && typeof where === 'object' && 'deletedAt' in (where as object);
}

/**
 * Filters tombstones out of every read, everywhere, without touching a call site.
 *
 * Applied in lib/prisma.ts. Relation reads loaded through `include`/`select` are
 * NOT covered - a query extension cannot reach inside them - so those carry
 * their own `where: { deletedAt: null }`; the test enumerates them.
 */
export function softDeleteExtension() {
  return {
    name: 'softDelete',
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if ((FILTERABLE_READS as readonly string[]).includes(operation)) {
            const where = (args?.where ?? {}) as Record<string, unknown>;
            if (!mentionsDeletedAt(where)) {
              return query({ ...args, where: { ...where, deletedAt: null } });
            }
            return query(args);
          }

          // findUnique cannot carry the filter in its where, so the row is
          // fetched and then withheld. findUniqueOrThrow must still throw.
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const result = (await query(args)) as { deletedAt?: Date | null } | null;
            if (result && result.deletedAt != null) {
              if (operation === 'findUniqueOrThrow') {
                throw new Error('No record found (row is deleted)');
              }
              return null;
            }
            return result;
          }

          return query(args);
        },
      },
    },
  };
}

/**
 * A Prisma client or an interactive transaction client - anything with models
 * on it. Typed loosely on purpose: this has to work with `prisma`, with the
 * `tx` handed to $transaction, and with the extended client, and pinning it to
 * one of those buys nothing at these call sites.
 */
type Db = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Mark rows deleted, and everything the database would have taken with them.
 *
 * Returns the number of rows tombstoned at the top level, matching what
 * deleteMany used to return, so call sites that checked `count` still read the
 * same way.
 *
 * Pass the `tx` from a $transaction when the delete is part of a larger unit of
 * work - the cascade then rolls back with everything else. Passing the plain
 * client is fine for a standalone delete.
 */
export async function softDelete(
  db: Db,
  model: string,
  where: Record<string, unknown>,
  when: Date = new Date()
): Promise<number> {
  const targets = await db[model].findMany({
    where: { ...where, deletedAt: null },
    select: { id: true },
  });
  const ids = targets.map((row: { id: string }) => row.id);
  if (ids.length === 0) return 0;

  await db[model].updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: when },
  });

  await cascade(db, model, ids, when);
  return ids.length;
}

/**
 * Walk the cascade graph, tombstoning children breadth-first.
 *
 * The graph is a DAG rooted at User, so this terminates without a visited set;
 * a row reached twice is simply already tombstoned and filtered out by the
 * `deletedAt: null` guard on the next pass.
 */
async function cascade(db: Db, model: string, ids: string[], when: Date): Promise<void> {
  const children = SOFT_DELETE_CASCADES[model];
  if (!children) return;

  for (const child of children) {
    const rows = await db[child.model].findMany({
      where: { [child.fk]: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (rows.length === 0) continue;

    const childIds = rows.map((row: { id: string }) => row.id);
    await db[child.model].updateMany({
      where: { id: { in: childIds } },
      data: { deletedAt: when },
    });
    await cascade(db, child.model, childIds, when);
  }
}

/**
 * How long a tombstone is worth keeping.
 *
 * Long enough that a device left in a drawer for a term still learns what was
 * deleted while it was away; short enough that the table does not grow forever.
 * A device offline longer than this resurrects deleted rows, which is the
 * trade every replicated system makes here.
 */
export const TOMBSTONE_RETENTION_DAYS = 90;

/**
 * Drop tombstones nobody needs any more.
 *
 * A tombstone exists to tell the other device "this is gone". Once every device
 * has had a fair chance to hear that, the row is dead weight, and without this
 * the database only ever grows: soft delete never frees a byte.
 *
 * The model list is passed in rather than discovered here so this file can stay
 * free of runtime imports (see the note at the top). Callers read it off
 * `Prisma.dmmf.datamodel.models`, which is where the truth lives anyway.
 *
 * Returns what it removed, per model, so a caller can log it. Models are purged
 * children-first via the cascade graph, so a parent is never removed while a
 * row still points at it.
 */
export async function purgeTombstones(
  db: Db,
  models: string[],
  olderThanDays: number = TOMBSTONE_RETENTION_DAYS
): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const removed: Record<string, number> = {};

  for (const model of purgeOrder(models)) {
    const { count } = await db[model].deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    if (count > 0) removed[model] = count;
  }

  return removed;
}

/**
 * Children before parents.
 *
 * Purging is a real delete, so the foreign keys are live again. Removing a
 * Class before its Terms would either cascade rows away that are not old enough
 * to go yet, or fail outright - so anything that appears as a child in the
 * cascade graph is purged before anything that appears as its parent.
 */
function purgeOrder(models: string[]): string[] {
  const depth = new Map<string, number>();

  const measure = (model: string, seen: Set<string>): number => {
    if (depth.has(model)) return depth.get(model)!;
    if (seen.has(model)) return 0;
    seen.add(model);
    const children = SOFT_DELETE_CASCADES[model] ?? [];
    const value = children.length
      ? 1 + Math.max(...children.map((c) => measure(c.model, seen)))
      : 0;
    depth.set(model, value);
    return value;
  };

  for (const model of models) measure(model, new Set());
  return [...models].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0));
}
