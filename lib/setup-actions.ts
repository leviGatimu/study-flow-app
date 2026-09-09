'use server';

/**
 * Server side of first-run setup.
 *
 * Everything here is a thin, validated wrapper over writes that already existed
 * somewhere in the app - renaming the year, setting term dates, adding a
 * subject, saving a key. The wizard deliberately owns no storage of its own
 * beyond one timestamp: it fills in the same rows the ordinary pages do, so a
 * user who skips it and does the work by hand ends up in exactly the same state,
 * and the checklist cannot disagree with the app.
 */

import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getScheduleState, ensureDefaultClass } from '@/lib/term';
import { getViewScope, byClass } from '@/lib/scope';
import { DEFAULT_TIMEZONE } from '@/lib/utils';
import type { SetupSnapshot } from '@/lib/setup';

/** "yyyy-MM-dd" for an <input type="date">, in plain UTC terms. */
function toDateInput(value: Date | null | undefined): string | null {
  if (!value) return null;
  const iso = new Date(value).toISOString();
  return iso.slice(0, 10);
}

/**
 * Read a "yyyy-MM-dd" back into a Date, or null.
 *
 * Parsed as UTC midnight, which is how every other date in this app is stored -
 * `new Date("2026-09-09")` already does exactly that, and going through the
 * local-time constructor instead would shift the day for anyone west of
 * Greenwich and silently move their term by one.
 */
function fromDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Everything the wizard and the checklist need, in one round trip.
 *
 * Counts rather than rows wherever only emptiness matters: the checklist asks
 * "is there at least one weekly block", and pulling a term's worth of templates
 * to answer that would be waste on a page that renders on every dashboard load.
 */
export async function getSetupSnapshot(): Promise<SetupSnapshot | null> {
  const userId = await getUserId();
  if (!userId) return null;

  // Reads only. This runs on every dashboard load, and getScheduleState is
  // request-cached, so creating a missing year from here would both write on a
  // read path and be invisible to a caller that had already asked. The wizard's
  // write actions guarantee the year instead.
  const [user, progress, schedule] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    prisma.userProgress.findUnique({
      where: { userId },
      select: {
        name: true,
        timezone: true,
        geminiApiKey: true,
        openaiApiKey: true,
        ollamaEnabled: true,
        setupCompletedAt: true,
        onboardedAt: true,
      },
    }),
    getScheduleState(userId),
  ]);

  if (!user) return null;

  // Scoped to the year you are in, exactly like listSubjects and the timetable
  // pages: last year's subjects must not make this year's checklist look
  // finished, and an open archive must report on the archive.
  const classFilter = byClass(await getViewScope(userId));

  const [subjects, templateCount, schoolLessonCount] = await Promise.all([
    prisma.subject.findMany({
      where: { userId, ...classFilter },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.scheduleTemplate.count({ where: { userId, ...classFilter } }),
    prisma.schoolLesson.count({ where: { userId, ...classFilter } }),
  ]);

  return {
    username: user.username,
    name: progress?.name || user.username,
    timezone: progress?.timezone || DEFAULT_TIMEZONE,
    classId: schedule.classId,
    classLabel: schedule.classLabel,
    termId: schedule.termId,
    termName: schedule.termName,
    termStartDate: toDateInput(schedule.termStartDate),
    termEndDate: toDateInput(schedule.termEndDate),
    subjects: subjects.map((s) => s.name),
    templateCount,
    schoolLessonCount,
    ai: {
      gemini: Boolean(progress?.geminiApiKey),
      openai: Boolean(progress?.openaiApiKey),
      ollama: Boolean(progress?.ollamaEnabled),
    },
    setupCompletedAt: progress?.setupCompletedAt ?? null,
    onboardedAt: progress?.onboardedAt ?? null,
  };
}

/**
 * Step 1: who you are and where you are.
 *
 * The timezone is the half that matters. It decides which calendar day a task
 * belongs to, so a wrong one moves every deadline by up to a day - and the
 * column's default is Africa/Kigali, which is right for exactly one user. The
 * wizard offers the browser's detected zone and this validates whatever comes
 * back, because the value arrives from the client and lands in date arithmetic.
 */
export async function saveSetupProfile(input: { name: string; timezone: string }) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const name = input.name.trim().slice(0, 60);
  if (!name) return { error: 'Tell us what to call you.' };

  const timezone = input.timezone.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return { error: 'That timezone was not recognised.' };
  }

  await prisma.userProgress.upsert({
    where: { userId },
    update: { name, timezone },
    create: { userId, name, timezone },
  });

  revalidatePath('/');
  revalidatePath('/settings');
  return { success: true };
}

/**
 * Step 2: the academic year and the term inside it.
 *
 * Writes the year's label and the ACTIVE term's name and dates together,
 * because to the user they are one answer: "I'm in S6, this is Term 1, it runs
 * from here to here."
 *
 * Returns `warning` rather than an error when the start date is in the future.
 * That is a legitimate thing to enter in the week before term - but it also
 * stops the schedule dead (getScheduleState -> TERM_NOT_STARTED), and a new user
 * who hit it would see an empty dashboard on day one with no idea why. Saying so
 * at the moment they type it is the difference between a feature and a bug
 * report.
 */
export async function saveSetupYear(input: {
  label: string;
  termName: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const label = input.label.trim().slice(0, 60);
  if (!label) return { error: 'Give this year a name.' };

  const termName = input.termName.trim().slice(0, 60) || 'Term 1';
  const startDate = fromDateInput(input.startDate);
  const endDate = fromDateInput(input.endDate);

  if (startDate && endDate && endDate <= startDate) {
    return { error: 'The term has to end after it starts.' };
  }

  await ensureDefaultClass(userId);
  const schedule = await getScheduleState(userId);
  if (!schedule.classId) return { error: 'No active year to set up.' };

  await prisma.class.update({ where: { id: schedule.classId }, data: { label } });

  if (schedule.termId) {
    await prisma.term.update({
      where: { id: schedule.termId },
      data: { name: termName, startDate, endDate },
    });
  } else {
    // Between terms, or an archived year re-opened: give them one to stand on
    // rather than saving half the answer.
    const agg = await prisma.term.aggregate({
      where: { classId: schedule.classId, deletedAt: null },
      _max: { index: true },
    });
    await prisma.term.create({
      data: {
        classId: schedule.classId,
        userId,
        name: termName,
        index: (agg._max.index ?? 0) + 1,
        status: 'ACTIVE',
        startDate,
        endDate,
      },
    });
  }

  revalidatePath('/');
  revalidatePath('/year');

  const notStartedYet = startDate ? startOfDay(startDate) > startOfDay(new Date()) : false;
  return {
    success: true,
    warning: notStartedYet
      ? 'That start date is in the future, so nothing will be scheduled until it arrives. Change it to today if you want to start now.'
      : null,
  };
}

/**
 * Stop asking - the dashboard checklist has been dismissed for good.
 *
 * ONLY the checklist's own dismiss button calls this. Leaving the wizard does
 * not, whether by skipping out of it or by finishing it: what was skipped has
 * to keep being offered somewhere, and the checklist is that somewhere. It
 * disappears on its own once nothing is outstanding, so a user who answers
 * everything in the wizard never meets it.
 *
 * Idempotent and first-answer-wins: nothing may rewrite the original date.
 */
export async function completeSetup() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  await prisma.userProgress.updateMany({
    where: { userId, setupCompletedAt: null },
    data: { setupCompletedAt: new Date() },
  });

  revalidatePath('/');
  return { success: true };
}
