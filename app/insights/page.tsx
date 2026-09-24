import { redirect } from 'next/navigation';
import { addDays, endOfDay, startOfDay, startOfWeek } from 'date-fns';

import { getInsightsData, type InsightsData, type InsightsScope } from '@/lib/insights-actions';
import { getUserId } from '@/lib/auth';
import { getScheduleState } from '@/lib/term';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { syncStreak } from '@/lib/actions';
import { DEFAULT_TIMEZONE, getZonedNow } from '@/lib/utils';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { InsightsClient, type WeekSnapshot } from './InsightsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function taskMinutes(startTime: string, endTime: string): number {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let mins = eH * 60 + eM - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // crosses midnight
  return Number.isFinite(mins) ? Math.max(0, mins) : 0;
}

/**
 * Insights: the Progress section's landing page. A few headline numbers
 * (streak, this week, marks, goals), then which subjects need attention and
 * what to do about each.
 *
 * The scope lives in the URL rather than in client state so the whole page
 * stays server-rendered - the data is computed on the server either way, and a
 * client toggle would mean shipping both datasets or a round trip on click.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { scope: raw } = await searchParams;
  const scope: InsightsScope = raw === 'lifetime' ? 'lifetime' : 'class';

  let data: InsightsData | null;
  let classLabel: string | null;
  let week: WeekSnapshot;
  try {
    const [insights, schedule, progress, viewScope] = await Promise.all([
      getInsightsData(scope),
      getScheduleState(userId),
      syncStreak(),
      getViewScope(userId),
    ]);
    data = insights;
    classLabel = schedule.classLabel;

    // "This week" always means the calendar week you are in, in the year on
    // screen - a week is too short to mean anything summed across years.
    const tz = progress?.timezone || DEFAULT_TIMEZONE;
    const weekStart = startOfWeek(startOfDay(getZonedNow(tz)), { weekStartsOn: 1 });
    const weekTasks = await prisma.task.findMany({
      where: {
        userId,
        ...byTerm(viewScope),
        isDeleted: false,
        date: { gte: weekStart, lte: endOfDay(addDays(weekStart, 6)) },
      },
      select: { startTime: true, endTime: true, isDone: true },
    });
    const done = weekTasks.filter((t) => t.isDone);
    week = {
      done: done.length,
      scheduled: weekTasks.length,
      minutes: done.reduce((acc, t) => acc + taskMinutes(t.startTime, t.endTime), 0),
      streakPaused: Boolean(progress && 'streakPaused' in progress && progress.streakPaused),
    };
  } catch (error) {
    console.error('Insights failed to load', error);
    return (
      <Page>
        <PageHeader title="Insights" description="How your year is going, and what to work on next." />
        <PageBody>
          <ErrorState
            title="Your insights could not be loaded"
            description="Something went wrong while adding up your study data. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }
  if (!data) redirect('/welcome');

  return <InsightsClient data={data} scope={scope} classLabel={classLabel} week={week} />;
}
