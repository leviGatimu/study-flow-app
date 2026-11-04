'use server';

/**
 * What the guided tour knows about the person taking it, so it can talk about
 * their week ("your first block today is Physics at 19:00") instead of a
 * generic one, and skip or redirect steps for things they have not set up.
 * Reads only.
 */

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getViewScope, byClass } from '@/lib/scope';
import { getZonedNow, DEFAULT_TIMEZONE } from '@/lib/utils';
import type { TourContext } from '@/components/onboarding/tour-steps';

export async function getTourContext(): Promise<TourContext | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const progress = await prisma.userProgress.findUnique({
    where: { userId },
    select: { name: true, timezone: true, geminiApiKey: true, openaiApiKey: true },
  });
  const scope = byClass(await getViewScope(userId));
  const today = getZonedNow(progress?.timezone || DEFAULT_TIMEZONE).getDay();

  const [subjects, templateCount, lessonCount, todayBlocks] = await Promise.all([
    prisma.subject.count({ where: { userId, ...scope } }),
    prisma.scheduleTemplate.count({ where: { userId, ...scope } }),
    prisma.schoolLesson.count({ where: { userId, ...scope, isBreak: false } }),
    prisma.scheduleTemplate.findMany({
      where: { userId, ...scope, dayOfWeek: today },
      select: { subject: true, startTime: true },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return {
    firstName: (progress?.name || '').trim().split(/\s+/)[0] || '',
    subjectCount: subjects,
    templateCount,
    lessonCount,
    todayCount: todayBlocks.length,
    todayFirst: todayBlocks[0] ?? null,
    aiKey: Boolean(progress?.geminiApiKey || progress?.openaiApiKey),
  };
}
