/**
 * Applying one side's rows to the other, without eating anything.
 *
 * This is the only file that decides who wins. It runs UNCHANGED on both sides -
 * the server applying a device's push, and a device applying the server's pull -
 * because a merge rule that behaves differently depending on where it runs is a
 * merge rule that will eventually disagree with itself and leave the two
 * databases permanently apart.
 *
 * Everything here is driven by lib/sync/identity.ts. Do not special-case a model
 * in this file: add or change its rule there, where the reasoning lives and
 * where the drift test can see it.
 *
 * THE RULES, in the order they are applied to a single incoming row:
 *
 *   1. MATCH. Find the local row this one IS. By id for match: 'ID'; by the
 *      natural key for match: 'NATURAL_KEY', because two devices independently
 *      creating "Physics" or Monday's 20:00 block mint two different cuids for
 *      one thing, and matching by id would duplicate the user's whole timetable.
 *
 *   2. DELETION WINS. If either side is a tombstone, the result is a tombstone,
 *      regardless of which is newer. This is deliberately not last-writer-wins:
 *      the failure it prevents - you delete something, and a device that was
 *      offline pushes it back - is the exact failure tombstones exist for, and
 *      it is far more upsetting than an edit landing on a doomed row.
 *
 *   3. isDone NEVER GOES BACKWARDS. A completed task stays completed even if a
 *      stale device pushes an older, unticked copy. Losing the record of work
 *      you actually did is the worst outcome this engine can produce.
 *
 *   4. MONOTONIC fields take max(); ACCUMULATED fields are summed as deltas.
 *      Both are declared per model in identity.ts. Last-writer-wins on a
 *      running total does not merely fail to add the two sides - it erases one.
 *
 *   5. Everything else: last writer wins on updatedAt, tie broken by deviceId
 *      so both sides independently reach the SAME answer rather than each
 *      preferring itself and staying apart forever.
 *
 * See test/sync/engine.test.mjs, which drives all of this against three real
 * SQLite databases.
 */

import { SYNC_RULES, REPARENT_BEFORE_DELETE, type SyncRule } from './identity.ts';

/**
 * The order rows are written in: every parent before anything that points at it.
 *
 * NOT the order they appear in identity.ts, which groups them by how they were
 * reasoned about. There, task sits next to scheduleTemplate and before
 * examEvent - but Task.examId REFERENCES ExamEvent, so applying that order
 * inserts a task pointing at an exam the database has never heard of and the
 * foreign key rejects it. Whole batches would fail on a device that happened to
 * have planned revision for an exam.
 *
 * test/sync/engine.test.mjs re-derives the constraint from the Prisma client's
 * own relation metadata and fails if a new foreign key ever contradicts this
 * list, so it cannot silently rot the way a hand-kept order usually does.
 */
export const APPLY_ORDER = [
  'user',
  'userProgress',
  'class',
  'term',
  'subject',
  'scheduleTemplate',
  'schoolLesson',
  'examEvent',
  'task',
  'homework',
  'subjectGoal',
  'studioNote',
  'markedDay',
  'masteryItem',
  'resource',
  'reportCard',
  'subjectGrade',
  'xpEvent',
] as const;

/**
 * Which foreign key on which model points at which parent.
 *
 * Inverted from REPARENT_BEFORE_DELETE so there is still one declaration of the
 * relationship graph rather than two that can disagree.
 *
 * Needed because a natural-key collision RENAMES a row mid-batch. B pushes its
 * own "Maths" template plus the completed task under it; the server recognises
 * the template as one it already has under a different id, and the task that
 * follows is left pointing at an id the server has never heard of. The foreign
 * key rejects it and the user's completed work never arrives - which is exactly
 * the silent data loss this engine exists to avoid.
 */
const FK_TO_PARENT: Record<string, Record<string, string>> = (() => {
  const map: Record<string, Record<string, string>> = {};
  for (const [parent, children] of Object.entries(REPARENT_BEFORE_DELETE)) {
    for (const { model, fk } of children) {
      map[model] = { ...(map[model] ?? {}), [fk]: parent };
    }
  }
  return map;
})();

/** A Prisma client or transaction client. Typed loosely for the same reason lib/soft-delete.ts is. */
type Db = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** One row on the wire: the model it belongs to and its columns. */
export type SyncRow = {
  model: string;
  data: Record<string, unknown>;
};

export type MergeOutcome = {
  applied: number;
  /** Rows that arrived describing something the local side already had, and lost. */
  rejected: number;
  /** Natural-key collisions that were reconciled onto an existing row. */
  reconciled: number;
  /**
   * Where an incoming id was folded into a different local id. The pusher needs
   * this to stop sending its own copy forever.
   */
  remapped: { model: string; from: string; to: string }[];
  errors: { model: string; id: string; message: string }[];
};

/** Columns that describe the row's place in the sync protocol, not its content. */
const PROTOCOL_FIELDS = new Set(['syncedAt']);

const asDate = (value: unknown): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const time = (row: Record<string, unknown>): number => asDate(row.updatedAt)?.getTime() ?? 0;

/**
 * Which of two versions of the same row is authoritative.
 *
 * The deviceId tiebreak matters more than it looks. Two rows saved in the same
 * millisecond with no tiebreak would have each side keep its own, and they would
 * stay different through every future sync - a permanent split that no amount of
 * re-syncing repairs. Comparing a stable string makes both sides pick the same
 * winner without talking to each other.
 */
function incomingWins(
  incoming: Record<string, unknown>,
  local: Record<string, unknown>,
  incomingDevice: string,
  localDevice: string
): boolean {
  const a = time(incoming);
  const b = time(local);
  if (a !== b) return a > b;
  return incomingDevice > localDevice;
}

/**
 * The natural key of a row, as a where clause.
 *
 * Returns null when the incoming row does not carry every key field, which
 * means it cannot be matched by key and has to fall back to its id.
 *
 * NOTE the one case this does NOT handle, deliberately: Subject has to match
 * CASE-FOLDED, because normalizeSubject does not lowercase and Postgres
 * compares case-sensitively, so "Physics" and "physics" are two rows to the
 * database and one subject to the student. Prisma's `mode: 'insensitive'` is
 * Postgres-only and this code runs on SQLite too, so the case-insensitive match
 * is done by the caller reading candidates back - see applyOne.
 */
function keyWhere(rule: SyncRule, row: Record<string, unknown>): Record<string, unknown> | null {
  if (!rule.key?.length) return null;
  const where: Record<string, unknown> = {};
  for (const field of rule.key) {
    if (row[field] === undefined) return null;
    where[field] = row[field] ?? null;
  }
  return where;
}

/**
 * Find the local row that IS this incoming one, by natural key.
 *
 * Two passes, and the second is the one that matters. The exact query catches
 * the ordinary case. When it misses, the non-string parts of the key are used
 * to narrow, and the string parts are compared CASE-FOLDED in memory - because
 * "Physics" and "physics" are two rows to Postgres and one subject to the
 * student, and Prisma's `mode: 'insensitive'` is Postgres-only while this code
 * also runs on the desktop's SQLite. The narrowed set is a handful of rows (one
 * user's subjects, one day's timetable), so reading it back costs nothing.
 */
async function matchByKey(
  db: Db,
  model: string,
  rule: SyncRule,
  incoming: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const where = keyWhere(rule, incoming);
  if (!where) return null;

  const exact = await db[model].findFirst({ where: { ...where, deletedAt: undefined } });
  if (exact) return exact;

  const stringFields = Object.entries(where).filter(([, v]) => typeof v === 'string');
  if (stringFields.length === 0) return null;

  const narrowed = Object.fromEntries(
    Object.entries(where).filter(([, v]) => typeof v !== 'string')
  );
  const candidates = await db[model].findMany({
    where: { ...narrowed, deletedAt: undefined },
  });

  return (
    candidates.find((row: Record<string, unknown>) =>
      stringFields.every(
        ([field, value]) =>
          String(row[field] ?? '').toLowerCase() === String(value).toLowerCase()
      )
    ) ?? null
  );
}

/**
 * Merge one incoming row's payload onto the local one.
 *
 * Returns the fields to write, or null when the local row already wins outright
 * and nothing should be touched.
 */
function resolve(
  rule: SyncRule,
  incoming: Record<string, unknown>,
  local: Record<string, unknown>,
  incomingDevice: string,
  localDevice: string
): Record<string, unknown> | null {
  const winner = incomingWins(incoming, local, incomingDevice, localDevice)
    ? incoming
    : local;
  const data: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(winner)) {
    if (field === 'id' || PROTOCOL_FIELDS.has(field)) continue;
    data[field] = value;
  }

  // Rule 2: a tombstone on either side is the answer.
  const incomingDeleted = asDate(incoming.deletedAt);
  const localDeleted = asDate(local.deletedAt);
  if (incomingDeleted || localDeleted) {
    // The earlier tombstone, so re-syncing never moves the deletion forward in
    // time and never lets it look newer than an edit it has already beaten.
    const first = [incomingDeleted, localDeleted].filter(Boolean).sort(
      (a, b) => (a as Date).getTime() - (b as Date).getTime()
    )[0];
    data.deletedAt = first;
  }

  // Rule 3: completion is one-way.
  if ('isDone' in incoming || 'isDone' in local) {
    data.isDone = incoming.isDone === true || local.isDone === true;
  }

  // Rule 4a: monotonic fields only ever climb.
  for (const field of rule.monotonic ?? []) {
    const a = Number(incoming[field] ?? 0);
    const b = Number(local[field] ?? 0);
    data[field] = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  }

  // Rule 4b: accumulated counters. Without a ledger the honest merge is the
  // larger of the two - it never erases the bigger contribution, which plain
  // last-writer-wins does. xpEvent shows the right answer for values that
  // matter: an append-only row per grant, summed. focusSessions and
  // totalFocusMinutes still need that treatment; until they get it this is the
  // safe direction rather than the correct one.
  for (const field of rule.accumulated ?? []) {
    const a = Number(incoming[field] ?? 0);
    const b = Number(local[field] ?? 0);
    data[field] = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  }

  // Nothing to do when the local row already holds the answer.
  const changed = Object.entries(data).some(([field, value]) => {
    const current = local[field];
    if (value instanceof Date || current instanceof Date) {
      return (asDate(value)?.getTime() ?? null) !== (asDate(current)?.getTime() ?? null);
    }
    return value !== current;
  });
  return changed ? data : null;
}

/**
 * Move every child of `loser` onto `winner`, then tombstone the loser.
 *
 * Deleting a duplicate outright is never safe on this schema: Class -> Term ->
 * Task and ScheduleTemplate -> Task are ON DELETE CASCADE, so dropping the
 * losing row of a natural-key collision would take completed work, written
 * descriptions and proof-of-work uploads with it. REPARENT_BEFORE_DELETE in
 * identity.ts lists what has to be moved first; test/sync/hazards.test.mjs
 * measures the blast radius when it is not.
 */
async function reconcile(
  db: Db,
  model: string,
  loserId: string,
  winnerId: string,
  when: Date
): Promise<void> {
  for (const child of REPARENT_BEFORE_DELETE[model] ?? []) {
    await db[child.model].updateMany({
      where: { [child.fk]: loserId },
      data: { [child.fk]: winnerId },
    });
  }
  await db[model].updateMany({
    where: { id: loserId },
    data: { deletedAt: when, syncedAt: null },
  });
}

/**
 * Apply a batch of rows to `db`.
 *
 * `stamp` is what to write into syncedAt: the server's own clock when the
 * server accepts a push, and the server's value when a device applies a pull.
 * Passing null marks the row dirty, which is only right when this side has made
 * a change the other has not seen.
 *
 * Rows are applied PARENT FIRST, in APPLY_ORDER, so a Task never arrives before
 * the Term or the ExamEvent it points at.
 */
export async function applyRows(
  db: Db,
  rows: SyncRow[],
  {
    stamp,
    localDevice,
    incomingDevice,
    now = new Date(),
  }: { stamp: Date | null; localDevice: string; incomingDevice: string; now?: Date }
): Promise<MergeOutcome> {
  const outcome: MergeOutcome = {
    applied: 0,
    rejected: 0,
    reconciled: 0,
    remapped: [],
    errors: [],
  };

  // Ids the server has folded into an existing row, keyed "model:oldId". Built
  // as the batch is applied and consulted by every row that follows, so a child
  // pushed alongside a re-keyed parent lands on the surviving parent.
  const remap = new Map<string, string>();

  const byModel = new Map<string, SyncRow[]>();
  for (const row of rows) {
    if (!SYNC_RULES[row.model]) continue; // local-only or derived: not ours to write
    byModel.set(row.model, [...(byModel.get(row.model) ?? []), row]);
  }

  for (const model of APPLY_ORDER) {
    const batch = byModel.get(model);
    if (!batch?.length) continue;
    const rule = SYNC_RULES[model];

    for (const { data } of batch) {
      const id = String(data.id ?? '');
      try {
        await applyOne(db, model, rule, data, {
          stamp,
          localDevice,
          incomingDevice,
          now,
          outcome,
          remap,
        });
      } catch (error) {
        outcome.errors.push({ model, id, message: (error as Error).message });
      }
    }
  }

  return outcome;
}

async function applyOne(
  db: Db,
  model: string,
  rule: SyncRule,
  incoming: Record<string, unknown>,
  ctx: {
    stamp: Date | null;
    localDevice: string;
    incomingDevice: string;
    now: Date;
    outcome: MergeOutcome;
    remap: Map<string, string>;
  }
): Promise<void> {
  const { stamp, localDevice, incomingDevice, now, outcome, remap } = ctx;
  const id = String(incoming.id ?? '');
  if (!id) throw new Error('row has no id');

  // Follow any parent this batch has already re-keyed, before the row is
  // matched or written - including inside its own natural key, which may well
  // BE the foreign key (a template is identified partly by its class).
  for (const [fk, parent] of Object.entries(FK_TO_PARENT[model] ?? {})) {
    const current = incoming[fk];
    if (typeof current !== 'string') continue;
    const replacement = remap.get(`${parent}:${current}`);
    if (replacement) incoming = { ...incoming, [fk]: replacement };
  }

  // Deliberately raw reads: the merge has to SEE tombstones. Filtering them out
  // is what turns "this was deleted" into "I have never heard of this", and the
  // engine would then recreate every row the user removed.
  const byId = await db[model].findFirst({ where: { id, deletedAt: undefined } });

  // A natural-key model may already hold this row under a different id, minted
  // independently on the other side.
  let match = byId;
  let collided = false;
  if (!match && rule.match === 'NATURAL_KEY') {
    match = await matchByKey(db, model, rule, incoming);
    collided = !!match;
  }

  if (!match) {
    const data: Record<string, unknown> = { ...incoming, syncedAt: stamp };
    await db[model].create({ data });
    outcome.applied++;
    return;
  }

  // The incoming row and the local one are the same thing under two ids. Keep
  // the LOCAL id - it is the one this side's foreign keys already point at -
  // and tell the pusher, so it stops sending its own copy.
  if (collided && match.id !== id) {
    const existingOther = await db[model].findFirst({
      where: { id, deletedAt: undefined },
    });
    if (existingOther) {
      await reconcile(db, model, existingOther.id, match.id, now);
    }
    outcome.reconciled++;
    outcome.remapped.push({ model, from: id, to: match.id });
    remap.set(`${model}:${id}`, match.id);
  }

  const data = resolve(rule, incoming, match, incomingDevice, localDevice);
  if (!data) {
    outcome.rejected++;
    // Even when nothing changed, record that the two sides now agree, or this
    // row is offered again on every future sync forever.
    if (stamp) await markSynced(db, model, match.id, match.updatedAt, stamp);
    return;
  }

  await db[model].updateMany({
    where: { id: match.id },
    data: { ...data, syncedAt: stamp },
  });
  outcome.applied++;
}

/**
 * Record that a row and the server now agree, WITHOUT making it look edited.
 *
 * `updatedAt` is `@updatedAt`, so Prisma rewrites it on every update - and this
 * particular update writes no content at all. Left alone, the bookkeeping write
 * that follows a push moves the pusher's row into the future, and the very next
 * pull then finds the server's newer content "older" and rejects it. The
 * symptom is brutal to read: two devices that sync cleanly, report no errors,
 * and permanently disagree.
 *
 * So the row's existing updatedAt is written back explicitly. Prisma honours an
 * explicit value on an @updatedAt field; that behaviour is what this depends on,
 * and test/sync/engine.test.mjs would fail loudly if it ever changed.
 */
export async function markSynced(
  db: Db,
  model: string,
  id: string,
  updatedAt: unknown,
  stamp: Date
): Promise<void> {
  const keep = asDate(updatedAt);
  await db[model].updateMany({
    where: { id },
    data: keep ? { syncedAt: stamp, updatedAt: keep } : { syncedAt: stamp },
  });
}

/**
 * Strip a row down to what may cross the wire.
 *
 * passwordHash travels DOWN to a device (offline login needs it) but must never
 * be accepted travelling up: a device is not allowed to change how an account
 * authenticates. The direction is the caller's to declare.
 */
export function scrub(
  model: string,
  row: Record<string, unknown>,
  direction: 'up' | 'down'
): Record<string, unknown> {
  const copy = { ...row };
  delete copy.syncedAt;
  if (model === 'user' && direction === 'up') {
    delete copy.passwordHash;
    delete copy.isAdmin;
  }
  if (model === 'userProgress') {
    // The user's own billing-linked credentials. They are configured per device
    // and there is no reason for them to leave the machine they were typed on.
    delete copy.geminiApiKey;
    delete copy.openaiApiKey;
  }
  return copy;
}
