/**
 * What makes a row on one device "the same row" as a row on another.
 *
 * This file is the foundation of the sync engine, and it exists because
 * last-writer-wins cannot answer that question. LWW compares ids, and every
 * device mints its own cuid, so two devices that independently create the same
 * logical thing produce two rows that LWW will never recognise as one. On this
 * schema that is not a corner case:
 *
 *   - Seven unique constraints are natural keys both devices can create
 *     (Subject, DailySummary, MarkedDay, StudioNote, SubjectGoal,
 *     WeeklySummary, Term). Pushing one device's row into the other's database
 *     hits the constraint and sync stops.
 *   - Task has NO unique constraint. ensureTasksGenerated dedupes on
 *     `templateId|dateKey` in application memory only, so two devices each
 *     generate the same day's blocks, nothing errors, and the user opens the
 *     app to find their whole timetable twice.
 *
 * Every entry below came from auditing the actual create paths. Do not add a
 * model here without tracing where its rows come from.
 *
 * See test/sync/hazards.test.mjs, which reproduces each hazard against real
 * databases, and HANDOFF.md "PHASE 9" for the sequencing.
 */

/**
 * How a model's rows are matched across devices.
 *
 * ID              - the id is trustworthy; rows only ever originate on one
 *                   device, so a union by id is correct.
 * NATURAL_KEY     - match on the listed fields, then merge the payload. The id
 *                   of the surviving row is whichever the server already had.
 * DERIVE          - do not sync the rows at all. They are a pure function of
 *                   data that IS synced, so each device recomputes them after a
 *                   sync and both arrive at the same answer.
 * LOCAL_ONLY      - out of scope for v1. Never leaves the device.
 */
export type MatchStrategy = 'ID' | 'NATURAL_KEY' | 'DERIVE' | 'LOCAL_ONLY';

export type SyncRule = {
  /** How to decide two rows are the same row. */
  match: MatchStrategy;
  /**
   * Fields forming the natural key, for match: 'NATURAL_KEY'.
   * Order is significant only for readability.
   */
  key?: string[];
  /**
   * Fields that must NOT be resolved by last-writer-wins because their value
   * is accumulated rather than set. LWW on these does not merely fail to add
   * the two devices' contributions - it erases one side's.
   */
  accumulated?: string[];
  /**
   * Fields that only ever move in one direction. Merge with max(), never LWW:
   * a stale write must not be able to pull them backwards.
   */
  monotonic?: string[];
  /** Why this rule, in one line. Kept short and specific. */
  why: string;
};

/**
 * The v1 sync scope.
 *
 * Deliberately not all 28 models. AI chat history and the music library stay
 * local: they are the two heaviest to transfer (unbounded chat text, audio
 * files up to 60MB) and nothing about a student's academic continuity depends
 * on them being on both devices.
 *
 * ExamEvent and Homework ARE in scope, against the first instinct to defer
 * them. Task.examId points at ExamEvent, so leaving ExamEvent local-only makes
 * every synced revision block a dangling reference on the other device - a
 * synced row may never point at a local-only row.
 */
export const SYNC_RULES: Record<string, SyncRule> = {
  // -------------------------------------------------------------- the account

  user: {
    match: 'ID',
    why:
      'The one row sync does not merge. Identity comes from the account: the ' +
      'server is authoritative and a device receives this row when it first ' +
      'logs in, never the other way round. Every other table keys off userId, ' +
      'so if two devices ever disagree about it nothing else can be matched. ' +
      'Note passwordHash must not be pushed back up from a device.',
  },

  // ---------------------------------------------------------------- academic

  class: {
    match: 'NATURAL_KEY',
    key: ['userId', 'status'],
    monotonic: ['longestStreak'],
    accumulated: [],
    why:
      'ensureDefaultClass() creates "Year 1" on first launch, so both devices ' +
      'make one before they ever sync. Nothing in the DB enforces one ACTIVE ' +
      'class, so the duplicate would simply persist. Match only applies to the ' +
      'ACTIVE row; archived years have no natural key and keep their ids.',
  },

  term: {
    match: 'NATURAL_KEY',
    key: ['classId', 'index'],
    why:
      'index is computed as max(index)+1 against the local database, not a ' +
      'sequence, so both devices independently mint "Term 2". @@unique already ' +
      'enforces this key, so a naive push fails loudly rather than duplicating.',
  },

  scheduleTemplate: {
    match: 'NATURAL_KEY',
    key: ['userId', 'classId', 'dayOfWeek', 'subject', 'startTime'],
    why:
      'No unique constraint at all, so a bad merge duplicates the timetable ' +
      'silently. endTime/deadlineDay/type are payload, not identity - they are ' +
      'the fields a user edits on one device.',
  },

  task: {
    match: 'NATURAL_KEY',
    key: ['userId', 'templateId', 'examId', 'date'],
    why:
      'The exact key ensureTasksGenerated already dedupes on, plus examId for ' +
      'revision blocks. Rows where BOTH templateId and examId are null are ' +
      'manual one-offs with no natural key: those fall back to id matching, ' +
      'because two genuinely different one-offs can share a date and subject.',
  },

  subject: {
    match: 'NATURAL_KEY',
    key: ['userId', 'name'],
    why:
      'The certain collision: seedSubjectsIfEmpty() populates this table on a ' +
      'fresh desktop install BEFORE first sync. Compare names case-folded and ' +
      'through normalizeSubject() - the constraint is case-sensitive on ' +
      'Postgres, so "Physics" and "physics" are two rows to the database and ' +
      'one subject to the student.',
  },

  examEvent: {
    match: 'ID',
    why:
      'Always created by an explicit user action or an AI timetable import, ' +
      'never auto-generated on load, so ids are trustworthy. In scope because ' +
      'Task.examId would otherwise dangle.',
  },

  homework: {
    match: 'ID',
    why: 'Explicit user action only. A due assignment must appear on both devices.',
  },

  // ------------------------------------------------------------ subject-keyed

  subjectGoal: {
    match: 'NATURAL_KEY',
    key: ['userId', 'subject'],
    why: '@@unique already enforces this; both devices can set a target offline.',
  },

  studioNote: {
    match: 'NATURAL_KEY',
    key: ['userId', 'subject'],
    why:
      'One note per subject, enforced by @@unique. Accepted trade-off: two ' +
      'devices editing the same note resolves LWW on content, so one side\'s ' +
      'edits are lost. Merging prose is out of scope for v1.',
  },

  markedDay: {
    match: 'NATURAL_KEY',
    key: ['userId', 'date'],
    why:
      'A bare user click on a calendar cell - no payload, derivable from ' +
      'nothing. Merges as a set union. Note toggleMarkedDay hard-deletes ' +
      'rather than soft-deleting, so an unmark racing a mark needs a tombstone ' +
      'to resolve; today there is nothing to compare.',
  },

  masteryItem: {
    match: 'ID',
    why:
      'Deliberately NOT keyed on (userId, subject, title). The app already ' +
      'allows two checklist items with the same title, so a natural key would ' +
      'merge two genuinely different items and destroy one.',
  },

  resource: {
    match: 'ID',
    why:
      'Same reasoning as masteryItem - duplicates are already tolerated, so ' +
      'inventing a key risks a false merge. url is a tempting key but the same ' +
      'link can legitimately be filed under two subjects.',
  },

  // ------------------------------------------------------------------- marks

  reportCard: {
    match: 'ID',
    why:
      'Holds aiSummary, AI-generated once from a document whose bytes are ' +
      'never persisted - irreplaceable, so never discard a row. No usable ' +
      'natural key: the app permits several cards per term.',
  },

  subjectGrade: {
    match: 'ID',
    why:
      'Holds irreplaceable aiFeedback and is a cascade child of reportCard, so ' +
      'it must follow its parent\'s strategy.',
  },

  // --------------------------------------------------------------- recomputed

  dailySummary: {
    match: 'DERIVE',
    why:
      'A pure function of that day\'s Task rows, already re-upserted on every ' +
      'read. Syncing it would move a cache across the wire and invite a ' +
      'conflict that cannot exist: recompute after Task merges instead.',
  },

  weeklySummary: {
    match: 'DERIVE',
    why: 'Same as dailySummary - recomputed from Task on every read.',
  },

  // ------------------------------------------------------------------ user
  //
  // NOT a plain LWW row. See `accumulated` - these fields have no ledger
  // anywhere, so last-writer-wins destroys the losing device's earnings
  // outright rather than merely failing to add them.

  userProgress: {
    match: 'NATURAL_KEY',
    key: ['userId'],
    accumulated: ['xp', 'focusSessions', 'totalFocusMinutes'],
    monotonic: ['level'],
    why:
      'Created lazily from a dozen different call sites, so both devices can ' +
      'mint one with different ids before the first sync. Keyed on userId ' +
      'because it is 1:1 with User. xp/focusSessions/totalFocusMinutes must ' +
      'merge as deltas, never LWW.',
  },

  // -------------------------------------------------------------- local only

  chatSession: { match: 'LOCAL_ONLY', why: 'AI chat scratchpad; no academic continuity.' },
  chatMessage: { match: 'LOCAL_ONLY', why: 'Unbounded prompt/response text - the heaviest table.' },
  song: { match: 'LOCAL_ONLY', why: 'Real audio files up to 60MB behind audioUrl.' },
  playlist: { match: 'LOCAL_ONLY', why: 'Meaningless without song, which is local-only.' },
  aiNote: { match: 'LOCAL_ONLY', why: 'Generated notes; sourceName is a filename, not a stored file.' },
  stickyNote: { match: 'LOCAL_ONLY', why: 'Desktop-canvas scratchpad, tied to no academic model.' },
  project: { match: 'LOCAL_ONLY', why: 'Personal side projects, not school-issued work.' },
  projectDoc: { match: 'LOCAL_ONLY', why: 'Travels with its local-only parent project.' },
  tutorModule: { match: 'LOCAL_ONLY', why: 'sourcePdfUrl is a filename only; quiz content is regenerable.' },
  quizAttempt: { match: 'LOCAL_ONLY', why: 'Child of tutorModule, which is local-only.' },
};

/** Models that actually move between devices in v1. */
export const SYNCED_MODELS = Object.entries(SYNC_RULES)
  .filter(([, rule]) => rule.match === 'ID' || rule.match === 'NATURAL_KEY')
  .map(([model]) => model);

/** Models each device recomputes for itself once a sync has landed. */
export const DERIVED_MODELS = Object.entries(SYNC_RULES)
  .filter(([, rule]) => rule.match === 'DERIVE')
  .map(([model]) => model);

/**
 * Deleting a duplicate is never safe on this schema.
 *
 * Class -> Term -> {Task, ExamEvent, Homework, ReportCard, ...} and
 * ScheduleTemplate -> Task are all ON DELETE CASCADE, so resolving a duplicate
 * by dropping the losing row takes completed work, written descriptions and
 * proof-of-work uploads with it. Reconciling a natural-key collision MUST
 * re-parent these foreign keys onto the surviving row first.
 *
 * test/sync/hazards.test.mjs proves the blast radius.
 */
export const REPARENT_BEFORE_DELETE: Record<string, { model: string; fk: string }[]> = {
  class: [
    { model: 'term', fk: 'classId' },
    { model: 'scheduleTemplate', fk: 'classId' },
    { model: 'subject', fk: 'classId' },
  ],
  term: [
    { model: 'task', fk: 'termId' },
    { model: 'examEvent', fk: 'termId' },
    { model: 'homework', fk: 'termId' },
    { model: 'reportCard', fk: 'termId' },
  ],
  scheduleTemplate: [{ model: 'task', fk: 'templateId' }],
  subject: [{ model: 'examEvent', fk: 'subjectId' }],
  reportCard: [{ model: 'subjectGrade', fk: 'reportCardId' }],
};
