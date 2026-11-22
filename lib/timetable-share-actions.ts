'use server';

import { revalidatePath } from 'next/cache';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byClass, getViewScope, isViewingArchive, requireWritableScope, ARCHIVE_WRITE_ERROR } from '@/lib/scope';
import { applyTimetableImport } from '@/lib/timetable-import';
import { getScheduleState } from '@/lib/term';
import {
  buildTimetableFile,
  parseTimetableData,
  timetableFileName,
  type TimetableFile,
} from '@/lib/timetable-share';

/**
 * Sharing a timetable as a file: export what this year holds, import what a
 * file holds in its place.
 *
 * Importing REPLACES (the owner's call): the file's school lessons become the
 * importer's school lessons for the year in view, and its study routine their
 * study routine. A part the file does not include is left alone. Finished
 * blocks are history and are kept, exactly as removing a routine block by
 * hand keeps them (deleteTemplate in lib/actions.ts).
 */

export async function exportTimetable(parts: { lessons: boolean; routine: boolean }): Promise<
  { ok: true; file: TimetableFile; fileName: string } | { ok: false; error: string }
> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You are signed out. Sign in and try again.' };
  if (!parts?.lessons && !parts?.routine) return { ok: false, error: 'Choose what to share.' };

  // The year in view, so a finished year can be shared as well as this one.
  const scope = byClass(await getViewScope(userId));
  const [lessons, templates, progress] = await Promise.all([
    parts.lessons
      ? prisma.schoolLesson.findMany({
          where: { userId, ...scope },
          select: { dayOfWeek: true, startTime: true, endTime: true, subject: true, isBreak: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : Promise.resolve(null),
    parts.routine
      ? prisma.scheduleTemplate.findMany({
          where: { userId, ...scope },
          select: { dayOfWeek: true, subject: true, startTime: true, endTime: true, deadlineDay: true, type: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : Promise.resolve(null),
    prisma.userProgress.findUnique({ where: { userId }, select: { name: true } }),
  ]);

  const name = progress?.name?.trim();
  const from = name && name !== 'Student' ? name : null;
  const now = new Date();
  const file = buildTimetableFile({
    from,
    now,
    schoolLessons: lessons ?? undefined,
    studyRoutine: templates?.map((t) => ({ ...t, type: t.type === 'REVISION' ? 'REVISION' : 'HOMEWORK' })) ?? undefined,
  });
  // What is stored was checked on the way in, but a file must never be one
  // this app would refuse to read back.
  const check = parseTimetableData(file);
  if (!check.ok) return { ok: false, error: `Your timetable could not be exported: ${check.error}` };
  return { ok: true, file, fileName: timetableFileName(from, now) };
}

export type ImportSummary = {
  lessons: number | null;
  blocks: number | null;
  newSubjects: string[];
  /** False when no term is running: the routine is saved but makes no blocks until one is. */
  termRunning: boolean;
};

export async function importTimetable(raw: unknown): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You are signed out. Sign in and try again.' };
  if (await isViewingArchive(userId)) return { ok: false, error: ARCHIVE_WRITE_ERROR };

  // Never trust what the browser parsed: check the whole thing again here.
  const parsed = parseTimetableData(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;

  let scope;
  try {
    scope = await requireWritableScope(userId);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  const stamp = byClass(scope);

  let result;
  try {
    result = await applyTimetableImport(prisma, userId, stamp, data);
  } catch (error) {
    console.error('importTimetable failed', error);
    return { ok: false, error: 'The timetable could not be imported. Nothing was changed. Try again.' };
  }

  for (const path of ['/manage', '/school-timetable', '/timetable', '/calendar', '/', '/subjects', '/history']) {
    revalidatePath(path);
  }

  const schedule = await getScheduleState(userId);

  return {
    ok: true,
    summary: { ...result, termRunning: schedule.isRunning },
  };
}

