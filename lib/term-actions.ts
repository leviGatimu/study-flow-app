'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getScheduleState, type ScheduleState } from '@/lib/term';
import {
  buildTermSummary,
  buildClassSummary,
  readStoredSummary,
  type PeriodSummary,
} from '@/lib/summary';

/**
 * Lifecycle actions for the academic year.
 *
 * The rules these enforce, agreed with Levi:
 *   - Dates only ever PROMPT. Nothing here fires on a schedule; every
 *     transition is something the user explicitly does.
 *   - Exactly one ACTIVE class per user, and at most one ACTIVE term in it.
 *   - The timetable belongs to the class, so a new term resumes the same
 *     weekly schedule. Only a NEW CLASS starts blank.
 */

function refresh() {
  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/timetable');
  revalidatePath('/manage');
  revalidatePath('/settings');
  revalidatePath('/streak');
}

export async function getCurrentScheduleState(): Promise<ScheduleState | null> {
  const userId = await getUserId();
  if (!userId) return null;
  return getScheduleState(userId);
}

/** The active class plus every term, for the management UI. */
export async function getClassOverview() {
  const userId = await getUserId();
  if (!userId) return null;

  const classes = await prisma.class.findMany({
    where: { userId, deletedAt: null },
    orderBy: { startedAt: 'desc' },
    include: {
      terms: { where: { deletedAt: null }, orderBy: { index: 'asc' } },
    },
  });

  return classes;
}

async function requireActiveClass(userId: string) {
  const cls = await prisma.class.findFirst({
    where: { userId, status: 'ACTIVE', deletedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  return cls;
}

/**
 * Pause the schedule. Usable any day, mid-term: stops task generation and
 * freezes the streak without ending anything.
 */
export async function pauseSchedule() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year to pause.' };

  await prisma.class.update({
    where: { id: cls.id },
    data: { pausedAt: new Date() },
  });
  refresh();
  return { success: true };
}

/** Resume after a pause. The streak continues from its frozen value. */
export async function resumeSchedule() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year to resume.' };

  await prisma.class.update({
    where: { id: cls.id },
    data: { pausedAt: null },
  });

  // Clear the legacy school-break flag too, so a user who paused the old way
  // is not left frozen by a field nothing sets any more.
  await prisma.userProgress.updateMany({
    where: { userId },
    data: { schoolEndDate: null },
  });

  refresh();
  return { success: true };
}

/**
 * Finish the running term. The class stays active and the timetable is
 * untouched; the schedule simply stops until the next term is started.
 */
export async function endActiveTerm() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const state = await getScheduleState(userId);
  if (!state.termId) return { error: 'No term is running.' };

  // Snapshot the grade now. A finished term's result should not drift later
  // because a task inside it was edited.
  const summary = await buildTermSummary(userId, state.termId);

  await prisma.term.update({
    where: { id: state.termId },
    data: {
      status: 'COMPLETED',
      endDate: state.termEndDate ?? new Date(),
      summary: summary ? JSON.stringify(summary) : null,
    },
  });
  refresh();
  return { success: true, summary };
}

/** Push the active term's end date out, for "ends today - extend" prompts. */
export async function extendActiveTerm(newEndDate: Date) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const state = await getScheduleState(userId);
  if (!state.termId) return { error: 'No term is running.' };

  await prisma.term.update({
    where: { id: state.termId },
    data: { endDate: newEndDate },
  });
  refresh();
  return { success: true };
}

/**
 * Start a term. Creates one if no UPCOMING term is queued, so "start the next
 * term" always works even for a user who never set future dates.
 */
export async function startNextTerm(input?: {
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year.' };

  const terms = await prisma.term.findMany({
    where: { classId: cls.id, deletedAt: null },
    orderBy: { index: 'asc' },
  });

  if (terms.some((t) => t.status === 'ACTIVE')) {
    return { error: 'A term is already running. End it first.' };
  }

  const upcoming = terms.find((t) => t.status === 'UPCOMING');
  const nextIndex = terms.reduce((max, t) => Math.max(max, t.index), 0) + 1;

  if (upcoming) {
    await prisma.term.update({
      where: { id: upcoming.id },
      data: {
        status: 'ACTIVE',
        name: input?.name ?? upcoming.name,
        startDate: input?.startDate ?? upcoming.startDate ?? new Date(),
        endDate: input?.endDate ?? upcoming.endDate,
      },
    });
  } else {
    await prisma.term.create({
      data: {
        classId: cls.id,
        userId,
        name: input?.name ?? `Term ${nextIndex}`,
        index: nextIndex,
        status: 'ACTIVE',
        startDate: input?.startDate ?? new Date(),
        endDate: input?.endDate ?? null,
      },
    });
  }

  // Starting a term implies you are back at work.
  await prisma.class.update({ where: { id: cls.id }, data: { pausedAt: null } });

  refresh();
  return { success: true };
}

/** Queue a future term without starting it. */
export async function addUpcomingTerm(input: {
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year.' };

  const agg = await prisma.term.aggregate({
    where: { classId: cls.id, deletedAt: null },
    _max: { index: true },
  });
  const nextIndex = (agg._max.index ?? 0) + 1;

  await prisma.term.create({
    data: {
      classId: cls.id,
      userId,
      name: input.name?.trim() || `Term ${nextIndex}`,
      index: nextIndex,
      status: 'UPCOMING',
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });
  refresh();
  return { success: true };
}

export async function updateTerm(
  termId: string,
  data: { name?: string; startDate?: Date | null; endDate?: Date | null }
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const term = await prisma.term.findFirst({ where: { id: termId, userId } });
  if (!term) return { error: 'Term not found.' };

  await prisma.term.update({
    where: { id: termId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() || term.name } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    },
  });
  refresh();
  return { success: true };
}

/** Rename the current academic year ("Year 1" -> "S6", "Level 300", ...). */
export async function renameActiveClass(label: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = label.trim();
  if (!trimmed) return { error: 'Name cannot be empty.' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year.' };

  await prisma.class.update({ where: { id: cls.id }, data: { label: trimmed } });
  refresh();
  return { success: true };
}

/**
 * Finish the academic year. Archives it read-only; any running term is closed
 * with it. Nothing is deleted - the year stays fully readable.
 */
export async function completeActiveClass() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const cls = await requireActiveClass(userId);
  if (!cls) return { error: 'No active year.' };

  const now = new Date();

  // Any term still running is closed with the year, so it needs its own
  // snapshot before the status flips.
  const openTerms = await prisma.term.findMany({
    where: { classId: cls.id, status: { not: 'COMPLETED' }, deletedAt: null },
    select: { id: true },
  });
  const termSnapshots = await Promise.all(
    openTerms.map(async (t) => ({
      id: t.id,
      summary: await buildTermSummary(userId, t.id),
    }))
  );
  const classSummary = await buildClassSummary(userId, cls.id);

  await prisma.$transaction([
    ...termSnapshots.map((t) =>
      prisma.term.update({
        where: { id: t.id },
        data: {
          status: 'COMPLETED',
          summary: t.summary ? JSON.stringify(t.summary) : null,
        },
      })
    ),
    prisma.class.update({
      where: { id: cls.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        pausedAt: null,
        summary: classSummary ? JSON.stringify(classSummary) : null,
      },
    }),
  ]);
  refresh();
  return { success: true, summary: classSummary };
}

/**
 * Open a new academic year. Starts genuinely blank - no timetable, no
 * subjects - which is what Levi asked for: only a new class resets the
 * schedule, never a new term. XP and level are lifetime and carry over; the
 * streak restarts, because it belongs to the class.
 */
export async function startNewClass(label: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = label.trim();
  if (!trimmed) return { error: 'Give the year a name.' };

  const existingActive = await requireActiveClass(userId);
  if (existingActive) {
    return { error: 'Finish the current year before starting a new one.' };
  }

  await prisma.class.create({
    data: {
      userId,
      label: trimmed,
      status: 'ACTIVE',
      terms: { create: { userId, name: 'Term 1', index: 1, status: 'ACTIVE' } },
    },
  });
  refresh();
  return { success: true };
}

/**
 * Read-only snapshot of a finished (or current) academic year.
 *
 * This is the "open the old class and see your history" view. It never exposes
 * a way to edit an archived year - completed work is a record, not a workspace.
 */
export async function getClassArchive(classId: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const cls = await prisma.class.findFirst({
    where: { id: classId, userId, deletedAt: null },
    include: {
      terms: { where: { deletedAt: null }, orderBy: { index: 'asc' } },
    },
  });
  if (!cls) return null;

  const termIds = cls.terms.map((t) => t.id);

  const [tasks, doneTasks, exams, subjects, templates, reportCards] = await Promise.all([
    prisma.task.count({ where: { termId: { in: termIds }, isDeleted: false } }),
    prisma.task.findMany({
      where: { termId: { in: termIds }, isDeleted: false, isDone: true },
      select: { startTime: true, endTime: true, subject: true },
    }),
    prisma.examEvent.count({ where: { termId: { in: termIds } } }),
    prisma.subject.count({ where: { classId: cls.id } }),
    prisma.scheduleTemplate.count({ where: { classId: cls.id } }),
    prisma.reportCard.count({ where: { termId: { in: termIds } } }),
  ]);

  // Minutes studied, from the scheduled length of everything ticked off.
  let minutes = 0;
  const bySubject = new Map<string, number>();
  for (const t of doneTasks) {
    const [sH, sM] = t.startTime.split(':').map(Number);
    const [eH, eM] = t.endTime.split(':').map(Number);
    let mins = (eH * 60 + eM) - (sH * 60 + sM);
    if (mins < 0) mins += 1440; // crosses midnight
    minutes += mins;
    bySubject.set(t.subject, (bySubject.get(t.subject) ?? 0) + mins);
  }

  const topSubjects = [...bySubject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subject, mins]) => ({ subject, minutes: mins }));

  return {
    id: cls.id,
    label: cls.label,
    status: cls.status,
    startedAt: cls.startedAt,
    completedAt: cls.completedAt,
    longestStreak: cls.longestStreak,
    terms: cls.terms.map((t) => ({
      id: t.id,
      name: t.name,
      index: t.index,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
    })),
    totals: {
      tasks,
      tasksDone: doneTasks.length,
      minutes,
      exams,
      subjects,
      templates,
      reportCards,
    },
    topSubjects,
  };
}

/**
 * A term's summary: the snapshot if it has been completed, otherwise computed
 * live so a running term can still show you where it stands.
 */
export async function getTermSummary(termId: string): Promise<PeriodSummary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const term = await prisma.term.findFirst({
    where: { id: termId, userId, deletedAt: null },
    select: { summary: true, status: true },
  });
  if (!term) return null;

  return readStoredSummary(term.summary) ?? buildTermSummary(userId, termId);
}

/** Same, for a whole academic year. */
export async function getClassSummary(classId: string): Promise<PeriodSummary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const cls = await prisma.class.findFirst({
    where: { id: classId, userId, deletedAt: null },
    select: { summary: true },
  });
  if (!cls) return null;

  return readStoredSummary(cls.summary) ?? buildClassSummary(userId, classId);
}
