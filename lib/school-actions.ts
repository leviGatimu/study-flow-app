'use server';

/**
 * The user's own school day.
 *
 * This used to be a constant. `SCHOOL_DATA` in components/SchoolTimetable.tsx
 * held one student's real timetable - Networking Fundamentals, Upper Technical
 * English, Kinyarwanda - and the dashboard status card, the lesson
 * notifications and the week view all imported it directly. Every account on
 * the deployment therefore saw the same lessons, and nobody could change them
 * without editing the app.
 *
 * Two things follow from making it data, and both are deliberate:
 *
 *   A new account has NO lessons, and the UI must be right about that. The
 *   school states on the dashboard, the lesson alerts and the "School Hours"
 *   band on /timetable all disappear rather than showing a stranger's day.
 *
 *   Lessons are CLASS-scoped, like ScheduleTemplate. Starting a new academic
 *   year gives you a blank school timetable, because the timetable genuinely
 *   changed - and last year's stays readable in the archive.
 */

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DAY_NAMES, toMinutes, weekdayOrder, type SchoolLesson } from '@/lib/school';
import { askAIBuddy } from '@/lib/ai-actions';
import { parseJsonLoose, asString } from '@/lib/ai-parse';
import {
  getViewScope,
  byClass,
  requireClassStamp,
  isViewingArchive,
  ARCHIVE_WRITE_ERROR,
} from '@/lib/scope';

export type SchoolLessonInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  isBreak?: boolean;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate at the boundary, because these strings are compared, not parsed.
 *
 * Every consumer slices "HH:MM" apart with split(':') and does arithmetic on
 * the halves. A stored "9:00" or "0900" does not throw - it silently sorts and
 * compares wrong, and the dashboard quietly believes you are in a lesson at the
 * wrong time. So the shape is enforced once, here, where it enters the database.
 */
function validate(input: SchoolLessonInput): SchoolLessonInput {
  const subject = input.subject?.trim();
  if (!subject) throw new Error('A lesson needs a name');
  if (subject.length > 120) throw new Error('Lesson name is too long');

  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new Error('Day must be 0 (Sunday) to 6 (Saturday)');
  }
  if (!TIME.test(input.startTime)) throw new Error('Start time must look like 09:00');
  if (!TIME.test(input.endTime)) throw new Error('End time must look like 10:40');

  // Equal is rejected too: a zero-length lesson is never "now", so it would sit
  // in the timetable looking real and never once light up.
  if (toMinutes(input.endTime) <= toMinutes(input.startTime)) {
    throw new Error('A lesson has to end after it starts');
  }

  return {
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    subject,
    isBreak: input.isBreak ?? false,
  };
}

/**
 * This year's school timetable, in the order a week runs.
 *
 * Monday first, not Sunday: dayOfWeek uses the schema's 0=Sunday convention so
 * it matches ScheduleTemplate, but a school week reads Mon-Sun. Sorting here
 * rather than in each of the four consumers keeps them from disagreeing.
 */
export async function getSchoolLessons(): Promise<SchoolLesson[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const lessons = await prisma.schoolLesson.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      subject: true,
      isBreak: true,
    },
  });

  return lessons.sort(
    (a, b) =>
      weekdayOrder(a.dayOfWeek) - weekdayOrder(b.dayOfWeek) ||
      toMinutes(a.startTime) - toMinutes(b.startTime)
  );
}

export async function createSchoolLesson(input: SchoolLessonInput) {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  let clean: SchoolLessonInput;
  try {
    clean = validate(input);
  } catch (error) {
    return { error: (error as Error).message };
  }

  await prisma.schoolLesson.create({
    data: { ...clean, userId, ...(await requireClassStamp(userId)) },
  });

  revalidateSchool();
  return { success: true };
}

export async function updateSchoolLesson(id: string, input: SchoolLessonInput) {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  let clean: SchoolLessonInput;
  try {
    clean = validate(input);
  } catch (error) {
    return { error: (error as Error).message };
  }

  // updateMany, not update: `where: { id }` alone would let any signed-in user
  // rewrite anyone's timetable. The same hole was found on subject grades and
  // flashcard reviews in the academic-year pass; do not reintroduce it here.
  const { count } = await prisma.schoolLesson.updateMany({
    where: { id, userId },
    data: clean,
  });
  if (count === 0) return { error: 'That lesson no longer exists' };

  revalidateSchool();
  return { success: true };
}

export async function deleteSchoolLesson(id: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  await softDelete(prisma, 'schoolLesson', { id, userId });

  revalidateSchool();
  return { success: true };
}

/**
 * Replace the whole week in one go.
 *
 * What the import path needs: a user pasting or uploading a timetable means
 * "this is my week now", not "add these to whatever is there". Doing it as
 * delete-then-create inside a transaction keeps the intermediate state - a
 * half-replaced week - from ever being observable by a concurrent read.
 *
 * The delete is a soft one, so the other device learns the old lessons went
 * away instead of resurrecting them on the next sync.
 */
export async function replaceSchoolTimetable(lessons: SchoolLessonInput[]) {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  let clean: SchoolLessonInput[];
  try {
    clean = lessons.map(validate);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (clean.length > 200) return { error: 'That is more lessons than a week can hold' };

  const stamp = await requireClassStamp(userId);
  const scope = byClass(await getViewScope(userId));

  await prisma.$transaction(async (tx) => {
    await softDelete(tx, 'schoolLesson', { userId, ...scope });
    if (clean.length > 0) {
      await tx.schoolLesson.createMany({
        data: clean.map((lesson) => ({ ...lesson, userId, ...stamp })),
      });
    }
  });

  revalidateSchool();
  return { success: true, count: clean.length };
}

/**
 * Every surface a lesson shows on.
 *
 * Four of them, which is exactly why the hardcoded array was so easy to miss:
 * changing the timetable changes the dashboard card, the week grid, the portal
 * and the day view all at once.
 */
function revalidateSchool() {
  revalidatePath('/school-timetable');
  revalidatePath('/');
  revalidatePath('/timetable');
  revalidatePath('/calendar');
}

/* -------------------------------------------------------------------------- */
/*  Reading a timetable off a photo                                            */
/* -------------------------------------------------------------------------- */

/**
 * Turn a photo (or PDF, or document) of a school timetable into lessons.
 *
 * Two steps, deliberately, in the same shape as the exam-timetable importer:
 * this one only READS and returns a proposal, and nothing is written until the
 * user has looked at it and pressed the button. Model output is not trustworthy
 * enough to go straight into the database - a misread "9" for "0" would move a
 * lesson by nine hours and the student would find out by missing it.
 *
 * Everything the model returns is re-validated here. A row that cannot be
 * understood is DROPPED and counted, never guessed at, so the review screen can
 * say "3 rows could not be read" instead of quietly showing a wrong lesson.
 */
export async function extractSchoolTimetable(input: {
  text?: string;
  image?: { data: string; mimeType: string };
}): Promise<{ success: true; lessons: SchoolLessonInput[]; dropped: number } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };

  const text = (input.text ?? '').trim().slice(0, 30000);
  if (!text && !input.image) return { error: 'Upload a photo of your timetable first.' };

  const systemInstruction = `You read a school's weekly class timetable and turn it into structured data.

Respond with ONLY one valid JSON object - no prose, no markdown fences:
{ "lessons": [{ "day": string, "start": "HH:MM", "end": "HH:MM", "subject": string, "isBreak": boolean }] }

Rules:
- One entry per period in the grid, for every day shown.
- "day" is the full English weekday name: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
- "start" and "end" are 24-hour times, zero-padded: "09:00", "14:30". Convert any am/pm times. A period ending at half past four in the afternoon is "16:30".
- "subject" is the lesson name exactly as written on the timetable. Do not abbreviate, translate or tidy it.
- "isBreak" is true for breaks, lunch, assembly and other non-teaching slots; false otherwise.
- Include break and lunch rows - the day is wrong without them.
- If a period spans two cells or repeats across days, emit it once per day it occurs on.
- Ignore anything that is not a timetable period: headings, room numbers, teacher names, term dates.
- If you cannot read a timetable at all, return {"lessons": []}.`;

  const prompt = input.image
    ? `Read the school timetable in the attached image and produce the JSON now.${
        text ? `\n\nExtra context:\n"""\n${text}\n"""` : ''
      }`
    : `Here is the school timetable as text. Produce the JSON now.\n"""\n${text}\n"""`;

  const result = await askAIBuddy(prompt, [], undefined, input.image, systemInstruction);
  if (result.error) return { error: result.error };

  const parsed = parseJsonLoose(result.text || '');
  if (!parsed) return { error: 'That response could not be understood. Try a clearer photo.' };

  return { success: true, ...sanitizeLessons(parsed?.lessons) };
}

const DAY_INDEX = new Map(DAY_NAMES.map((name, index) => [name.toLowerCase(), index]));

/**
 * Coerce one model-supplied time into "HH:MM", or null.
 *
 * Models are asked for 24-hour times and mostly comply, but "9:00", "9.00",
 * "09:00 AM" and "4:30 pm" all turn up. Accepting those is worth the twenty
 * lines; the alternative is dropping half a legible timetable on a formatting
 * technicality.
 */
function asTime(value: unknown): string | null {
  const raw = asString(value, 20)?.toLowerCase().replace(/\s+/g, '');
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})[:.h]?(\d{2})?(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Keep only rows that survive validation, and count what was thrown away. */
function sanitizeLessons(raw: unknown): { lessons: SchoolLessonInput[]; dropped: number } {
  if (!Array.isArray(raw)) return { lessons: [], dropped: 0 };

  const lessons: SchoolLessonInput[] = [];
  let dropped = 0;

  for (const row of raw.slice(0, 200)) {
    const day = asString((row as Record<string, unknown>)?.day, 20)?.toLowerCase();
    const dayOfWeek = day ? DAY_INDEX.get(day) : undefined;
    const startTime = asTime((row as Record<string, unknown>)?.start);
    const endTime = asTime((row as Record<string, unknown>)?.end);
    const subject = asString((row as Record<string, unknown>)?.subject, 120);

    if (dayOfWeek === undefined || !startTime || !endTime || !subject) {
      dropped++;
      continue;
    }
    // The same rule the writer enforces, applied before the user ever sees the
    // row - a backwards period is a misread, not something to review.
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      dropped++;
      continue;
    }

    lessons.push({
      dayOfWeek,
      startTime,
      endTime,
      subject,
      isBreak:
        (row as Record<string, unknown>)?.isBreak === true ||
        /\b(break|lunch|assembly|recess)\b/i.test(subject),
    });
  }

  return {
    lessons: lessons.sort(
      (a, b) =>
        weekdayOrder(a.dayOfWeek) - weekdayOrder(b.dayOfWeek) ||
        toMinutes(a.startTime) - toMinutes(b.startTime)
    ),
    dropped,
  };
}
