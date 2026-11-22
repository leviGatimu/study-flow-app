/**
 * The file a student downloads to share their School lessons and Study
 * routine with someone else, and the rules for reading one back.
 *
 * Pure and free of `@/` imports so `node --test` can load it. The file is
 * JSON with a `kind` and a `version`: a reader refuses anything that is not
 * ours, and a newer version it does not understand, with a message a person
 * can act on. Everything else is checked here, once, by the same rules the
 * app applies when a lesson or block is typed in, because a file can come
 * from anywhere - an older app, a hand edit, a different person's mistake.
 *
 * The server re-runs parseTimetableData on whatever the client sends; the
 * client only parses first so the review screen appears instantly.
 */

export const TIMETABLE_FILE_KIND = 'study-flow-timetable';
export const TIMETABLE_FILE_VERSION = 1;
export const TIMETABLE_FILE_EXTENSION = 'studyflow';

export const MAX_SHARED_LESSONS = 200;
export const MAX_SHARED_BLOCKS = 200;
const MAX_NAME = 120;
/** A whole week's timetable is a few KB; anything far bigger is not one. */
export const MAX_TIMETABLE_FILE_BYTES = 1024 * 1024;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export type SharedLesson = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  isBreak: boolean;
};

export type SharedBlock = {
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: 'HOMEWORK' | 'REVISION';
};

export type TimetableData = {
  /** The sender's display name, shown as "From …" on the review screen. */
  from: string | null;
  exportedAt: string | null;
  /** null = the file does not include this part, so importing leaves it alone. */
  schoolLessons: SharedLesson[] | null;
  studyRoutine: SharedBlock[] | null;
};

export type TimetableFile = {
  kind: typeof TIMETABLE_FILE_KIND;
  version: number;
  exportedAt: string;
  from: string | null;
  subjects: string[];
  schoolLessons?: SharedLesson[];
  studyRoutine?: SharedBlock[];
};

export type ParseResult = { ok: true; data: TimetableData } | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const dayName = (day: number) => DAY_NAMES[day];

/** Every subject a timetable uses, breaks excluded, in first-seen order and without case duplicates. */
export function subjectsOf(data: Pick<TimetableData, 'schoolLessons' | 'studyRoutine'>): string[] {
  const seen = new Map<string, string>();
  for (const lesson of data.schoolLessons ?? []) {
    if (!lesson.isBreak && !seen.has(lesson.subject.toLowerCase())) seen.set(lesson.subject.toLowerCase(), lesson.subject);
  }
  for (const block of data.studyRoutine ?? []) {
    if (!seen.has(block.subject.toLowerCase())) seen.set(block.subject.toLowerCase(), block.subject);
  }
  return [...seen.values()];
}

export function buildTimetableFile(input: {
  from: string | null;
  schoolLessons?: SharedLesson[];
  studyRoutine?: SharedBlock[];
  now?: Date;
}): TimetableFile {
  const file: TimetableFile = {
    kind: TIMETABLE_FILE_KIND,
    version: TIMETABLE_FILE_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    from: input.from?.trim() || null,
    subjects: subjectsOf({ schoolLessons: input.schoolLessons ?? null, studyRoutine: input.studyRoutine ?? null }),
  };
  if (input.schoolLessons) file.schoolLessons = input.schoolLessons.map(pickLesson);
  if (input.studyRoutine) file.studyRoutine = input.studyRoutine.map(pickBlock);
  return file;
}

const pickLesson = (l: SharedLesson): SharedLesson => ({
  dayOfWeek: l.dayOfWeek,
  startTime: l.startTime,
  endTime: l.endTime,
  subject: l.subject,
  isBreak: l.isBreak,
});

const pickBlock = (b: SharedBlock): SharedBlock => ({
  dayOfWeek: b.dayOfWeek,
  subject: b.subject,
  startTime: b.startTime,
  endTime: b.endTime,
  deadlineDay: b.deadlineDay,
  type: b.type,
});

/** "Levi timetable 2026-11-20.studyflow"; characters Windows refuses in a name are dropped. */
export function timetableFileName(from: string | null, now = new Date()): string {
  const who = (from ?? '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40);
  const date = now.toISOString().slice(0, 10);
  return `${who ? `${who} ` : ''}timetable ${date}.${TIMETABLE_FILE_EXTENSION}`;
}

/** Read the text of a downloaded file. */
export function parseTimetableFile(text: string): ParseResult {
  if (text.length > MAX_TIMETABLE_FILE_BYTES) return { ok: false, error: "This file is too big to be a Study Flow timetable." };
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: "This isn't a Study Flow timetable file." };
  }
  return parseTimetableData(raw);
}

/** Check an already-parsed object. The server calls this on whatever the client sends. */
export function parseTimetableData(raw: unknown): ParseResult {
  if (!isRecord(raw) || raw.kind !== TIMETABLE_FILE_KIND) {
    return { ok: false, error: "This isn't a Study Flow timetable file." };
  }
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "This timetable file is damaged: it has no version." };
  }
  if (version > TIMETABLE_FILE_VERSION) {
    return { ok: false, error: 'This timetable was made by a newer Study Flow. Update the app, then import it again.' };
  }

  const hasLessons = raw.schoolLessons !== undefined && raw.schoolLessons !== null;
  const hasRoutine = raw.studyRoutine !== undefined && raw.studyRoutine !== null;
  if (!hasLessons && !hasRoutine) return { ok: false, error: 'This timetable file is empty.' };

  let schoolLessons: SharedLesson[] | null = null;
  if (hasLessons) {
    if (!Array.isArray(raw.schoolLessons)) return { ok: false, error: 'The school lessons in this file are damaged.' };
    if (raw.schoolLessons.length > MAX_SHARED_LESSONS) return { ok: false, error: `This file has more than ${MAX_SHARED_LESSONS} school lessons.` };
    schoolLessons = [];
    const seen = new Set<string>();
    for (const [index, item] of raw.schoolLessons.entries()) {
      const lesson = readLesson(item);
      if (typeof lesson === 'string') return { ok: false, error: `School lesson ${index + 1}: ${lesson}` };
      // The app keys a lesson by its day and start; two at once cannot both be kept.
      const key = `${lesson.dayOfWeek}|${lesson.startTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      schoolLessons.push(lesson);
    }
  }

  let studyRoutine: SharedBlock[] | null = null;
  if (hasRoutine) {
    if (!Array.isArray(raw.studyRoutine)) return { ok: false, error: 'The study routine in this file is damaged.' };
    if (raw.studyRoutine.length > MAX_SHARED_BLOCKS) return { ok: false, error: `This file has more than ${MAX_SHARED_BLOCKS} study blocks.` };
    studyRoutine = [];
    const seen = new Set<string>();
    for (const [index, item] of raw.studyRoutine.entries()) {
      const block = readBlock(item);
      if (typeof block === 'string') return { ok: false, error: `Study block ${index + 1}: ${block}` };
      const key = routineKey(block);
      if (seen.has(key)) continue;
      seen.add(key);
      studyRoutine.push(block);
    }
  }

  const from = typeof raw.from === 'string' ? raw.from.trim().slice(0, 80) || null : null;
  const exportedAt = typeof raw.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : null;
  return { ok: true, data: { from, exportedAt, schoolLessons, studyRoutine } };
}

function readLesson(item: unknown): SharedLesson | string {
  if (!isRecord(item)) return 'it is damaged.';
  const day = readDay(item.dayOfWeek);
  if (day === null) return 'the day is missing.';
  const startTime = item.startTime;
  const endTime = item.endTime;
  if (typeof startTime !== 'string' || !TIME.test(startTime)) return 'the start time must look like 09:00.';
  if (typeof endTime !== 'string' || !TIME.test(endTime)) return 'the end time must look like 10:40.';
  // Same rule as typing a lesson in: a school lesson never runs past midnight.
  if (toMinutes(endTime) <= toMinutes(startTime)) return 'it has to end after it starts.';
  const subject = readName(item.subject);
  if (!subject) return 'it has no name.';
  return { dayOfWeek: day, startTime, endTime, subject, isBreak: item.isBreak === true };
}

function readBlock(item: unknown): SharedBlock | string {
  if (!isRecord(item)) return 'it is damaged.';
  const day = readDay(item.dayOfWeek);
  if (day === null) return 'the day is missing.';
  const startTime = item.startTime;
  const endTime = item.endTime;
  if (typeof startTime !== 'string' || !TIME.test(startTime)) return 'the start time must look like 19:30.';
  if (typeof endTime !== 'string' || !TIME.test(endTime)) return 'the end time must look like 21:00.';
  // A study block may run past midnight (22:30 to 00:00); it may not be empty.
  if (startTime === endTime) return 'it has to end at a different time from when it starts.';
  const subject = readName(item.subject);
  if (!subject) return 'it has no subject.';
  const type = item.type === 'REVISION' ? 'REVISION' : item.type === 'HOMEWORK' ? 'HOMEWORK' : null;
  if (!type) return 'its type must be Homework or Revision.';
  return { dayOfWeek: day, subject, startTime, endTime, deadlineDay: readDeadlineDay(item.deadlineDay, day), type };
}

function readDay(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  return name.slice(0, MAX_NAME);
}

/** A weekday name, written the way the app writes it; the block's own day when unreadable. */
function readDeadlineDay(value: unknown, day: number): string {
  if (typeof value === 'string') {
    const match = DAY_NAMES.find((name) => name.toLowerCase() === value.trim().toLowerCase());
    if (match) return match;
  }
  return dayName(day);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The sync engine's natural key for a routine block, minus the user and year. */
export function routineKey(block: Pick<SharedBlock, 'dayOfWeek' | 'subject' | 'startTime'>): string {
  return `${block.dayOfWeek}|${block.subject.toLowerCase()}|${block.startTime}`;
}

/** The sync engine's natural key for a school lesson, minus the user and year. */
export function lessonKey(lesson: Pick<SharedLesson, 'dayOfWeek' | 'startTime'>): string {
  return `${lesson.dayOfWeek}|${lesson.startTime}`;
}

/**
 * How to turn the rows someone has into the rows a file brings, touching as
 * little as possible: a row on the same natural key is kept and updated
 * (so sync sees an edit, not a delete plus a twin), the rest of the old rows
 * go, the rest of the new ones are created.
 */
export function planReplace<Old extends { id: string }, New>(
  existing: Old[],
  incoming: New[],
  keyOfOld: (row: Old) => string,
  keyOfNew: (row: New) => string
): { update: { id: string; row: New }[]; create: New[]; remove: string[] } {
  const byKey = new Map<string, Old>();
  const remove: string[] = [];
  for (const row of existing) {
    const key = keyOfOld(row);
    // Duplicates already in the database (an old bad merge): keep one, drop the rest.
    if (byKey.has(key)) remove.push(row.id);
    else byKey.set(key, row);
  }
  const update: { id: string; row: New }[] = [];
  const create: New[] = [];
  for (const row of incoming) {
    const match = byKey.get(keyOfNew(row));
    if (match) {
      update.push({ id: match.id, row });
      byKey.delete(keyOfNew(row));
    } else {
      create.push(row);
    }
  }
  for (const row of byKey.values()) remove.push(row.id);
  return { update, create, remove };
}
