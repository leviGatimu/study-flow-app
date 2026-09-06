import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import { startOfDay } from 'date-fns';
import { getZonedNow, DEFAULT_TIMEZONE } from '@/lib/utils';

/**
 * Why the schedule is or is not running.
 *
 *   RUNNING         active class, active term, not paused
 *   PAUSED          the user hit pause; mid-term, any day
 *   BETWEEN_TERMS   a term finished and the next has not been started
 *   CLASS_COMPLETE  the year is finished; nothing runs until a new one opens
 *   NO_CLASS        no academic year set up at all
 */
export type ScheduleReason =
  | 'RUNNING'
  | 'PAUSED'
  | 'BETWEEN_TERMS'
  | 'CLASS_COMPLETE'
  | 'NO_CLASS';

export type ScheduleState = {
  reason: ScheduleReason;
  /**
   * The single rule the rest of the app depends on: tasks are generated, and
   * the streak advances, ONLY when this is true.
   */
  isRunning: boolean;
  isPaused: boolean;

  classId: string | null;
  classLabel: string | null;

  termId: string | null;
  termName: string | null;
  termStartDate: Date | null;
  termEndDate: Date | null;

  /** Set when today is on or past the active term's end date. Dates only ever
   *  prompt - nothing transitions on its own. */
  termEndDue: boolean;
  /** The next UPCOMING term, if one is queued. */
  nextTerm: { id: string; name: string; startDate: Date | null } | null;
  /** Set when the next term's start date has arrived and it is still UPCOMING. */
  nextTermStartDue: boolean;
};

const EMPTY: ScheduleState = {
  reason: 'NO_CLASS',
  isRunning: false,
  isPaused: false,
  classId: null,
  classLabel: null,
  termId: null,
  termName: null,
  termStartDate: null,
  termEndDate: null,
  termEndDue: false,
  nextTerm: null,
  nextTermStartDue: false,
};

/**
 * Resolve where the user is in their academic year, and whether the schedule
 * should be running right now.
 *
 * Plain function rather than a server action so it can be called cheaply from
 * inside other server code (task generation, streak sync) without a round trip.
 */
export const getScheduleState = cache(async function getScheduleState(
  userId: string
): Promise<ScheduleState> {
  const [activeClass, progress] = await Promise.all([
    prisma.class.findFirst({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        terms: { where: { deletedAt: null }, orderBy: { index: 'asc' } },
      },
    }),
    prisma.userProgress.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
  ]);

  if (!activeClass) {
    // No ACTIVE class: either they finished the year, or never had one.
    const completed = await prisma.class.count({
      where: { userId, status: 'COMPLETED', deletedAt: null },
    });
    return { ...EMPTY, reason: completed > 0 ? 'CLASS_COMPLETE' : 'NO_CLASS' };
  }

  const today = startOfDay(getZonedNow(progress?.timezone || DEFAULT_TIMEZONE));
  const term = activeClass.terms.find((t) => t.status === 'ACTIVE') ?? null;
  const upcoming = activeClass.terms.find((t) => t.status === 'UPCOMING') ?? null;
  const isPaused = activeClass.pausedAt !== null;

  const base = {
    classId: activeClass.id,
    classLabel: activeClass.label,
    isPaused,
    nextTerm: upcoming
      ? { id: upcoming.id, name: upcoming.name, startDate: upcoming.startDate }
      : null,
    nextTermStartDue: Boolean(
      upcoming?.startDate && startOfDay(upcoming.startDate) <= today
    ),
  };

  if (!term) {
    return {
      ...EMPTY,
      ...base,
      reason: 'BETWEEN_TERMS',
      isRunning: false,
    };
  }

  return {
    ...base,
    reason: isPaused ? 'PAUSED' : 'RUNNING',
    isRunning: !isPaused,
    termId: term.id,
    termName: term.name,
    termStartDate: term.startDate,
    termEndDate: term.endDate,
    termEndDue: Boolean(term.endDate && startOfDay(term.endDate) <= today),
  };
});

/**
 * Create the default container for a brand-new account, so a fresh user has a
 * running schedule from their first login rather than a silently dead one.
 * Idempotent: does nothing if the user already has a class.
 */
export async function ensureDefaultClass(userId: string) {
  const existing = await prisma.class.count({ where: { userId, deletedAt: null } });
  if (existing > 0) return;

  await prisma.class.create({
    data: {
      userId,
      label: 'Year 1',
      status: 'ACTIVE',
      terms: {
        create: { userId, name: 'Term 1', index: 1, status: 'ACTIVE' },
      },
    },
  });
}
