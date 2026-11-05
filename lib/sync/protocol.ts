/**
 * The wire format, and the rules for reading a cursor.
 *
 * Kept apart from merge.ts and from the route so that both ends of the
 * conversation are typed against the same declaration and neither can drift.
 */

import type { SyncRow } from './merge.ts';

/** How many rows a single pull page carries. */
export const PULL_PAGE_SIZE = 500;

/** How many rows a device may push in one request. */
export const PUSH_LIMIT = 2000;

export const FOCUS_LOG_HEADER = 'x-study-flow-focus-log';
/** Sent by clients whose database has User.sessionVersion (desktop 1.0.19+). */
export const SESSION_VERSION_HEADER = 'x-study-flow-session-version';
export const DEVICE_HEADER = 'x-study-flow-device';

/** Older desktop clients cannot write unknown Prisma columns on pull. */
export function focusLogPayload(model: string, data: Record<string, unknown>, supported: boolean) {
  if (model !== 'xpEvent' || supported) return data;
  const legacy = { ...data };
  delete legacy.focusSeconds;
  delete legacy.taskId;
  return legacy;
}

/**
 * Older desktop clients have no User.sessionVersion column, and writing an
 * unknown column on pull fails. Only clients that announce it receive it.
 */
export function sessionVersionPayload(model: string, data: Record<string, unknown>, supported: boolean) {
  if (model !== 'user' || supported) return data;
  const legacy = { ...data };
  delete legacy.sessionVersion;
  return legacy;
}

/** Sent by clients whose database has ExamEvent.category (desktop 1.0.20+). */
export const EXAM_CATEGORY_HEADER = 'x-study-flow-exam-category';

/** Older desktop clients have no ExamEvent.category column; leave it out for them. */
export function examCategoryPayload(model: string, data: Record<string, unknown>, supported: boolean) {
  if (model !== 'examEvent' || supported) return data;
  const legacy = { ...data };
  delete legacy.category;
  return legacy;
}

/** Sent by clients whose database has the homework work columns (desktop 1.0.21+). */
export const HOMEWORK_WORK_HEADER = 'x-study-flow-homework-work';

/** Older desktop clients have no Homework answer/file columns; leave them out. */
export function homeworkWorkPayload(model: string, data: Record<string, unknown>, supported: boolean) {
  if (model !== 'homework' || supported) return data;
  const legacy = { ...data };
  delete legacy.briefFileUrl;
  delete legacy.answer;
  delete legacy.answerFileUrl;
  return legacy;
}

/**
 * Where a device got to, as the SERVER measures it.
 *
 * A plain timestamp is not enough: many rows can share a millisecond, so a
 * cursor of "everything after 12:00:00.000" either re-sends the whole tie on
 * every pull or, if it skips past it, loses whichever rows fell on the far side
 * of the page boundary. The id breaks the tie, and rows are ordered by
 * (syncedAt, id) so the pair is a stable position in a total order.
 */
export type Cursor = { syncedAt: string; id: string } | null;

export type PushRequest = {
  deviceId: string;
  rows: SyncRow[];
};

export type PushResponse = {
  /** The server's clock at the moment it accepted the batch. */
  serverTime: string;
  applied: number;
  rejected: number;
  reconciled: number;
  /** Ids the server folded into an existing row: the device must adopt these. */
  remapped: { model: string; from: string; to: string }[];
  errors: { model: string; id: string; message: string }[];
};

export type PullResponse = {
  serverTime: string;
  rows: SyncRow[];
  /** Where to resume. Null only when the server has nothing at all. */
  cursor: Cursor;
  /** True when more rows are waiting; the device should pull again immediately. */
  hasMore: boolean;
};

/**
 * The where-clause for "everything after this cursor", on (syncedAt, id).
 *
 * `syncedAt: { not: null }` is not redundant with the range test. A row the
 * server has never stamped is one that has never been written through the
 * server extension, and including it would hand a device a row with no position
 * in the order - which the cursor could then never advance past.
 */
export function afterCursor(cursor: Cursor): Record<string, unknown> {
  if (!cursor) return { syncedAt: { not: null } };
  const at = new Date(cursor.syncedAt);
  return {
    OR: [{ syncedAt: { gt: at } }, { AND: [{ syncedAt: at }, { id: { gt: cursor.id } }] }],
  };
}

/** Rows come back in the cursor's own order, or paging silently drops them. */
export const CURSOR_ORDER = [{ syncedAt: 'asc' as const }, { id: 'asc' as const }];
