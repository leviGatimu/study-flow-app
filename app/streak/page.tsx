import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { getZonedNow } from '@/lib/utils';

import { syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { StreakBreakBanner } from '@/components/StreakBreakBanner';
import { RankRoadmap } from '@/components/RankRoadmap';
import { StreakCalendar } from './StreakCalendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Streak: consistency (the streak and the calendar of active days) and what it
 * earns (level, XP and rank). The old Ranks page lives here now.
 */
export default async function StreakPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let userProgress: Awaited<ReturnType<typeof syncStreak>>;
  let activeDays: string[];
  try {
    const [progress, scope] = await Promise.all([syncStreak(), getViewScope(userId)]);
    userProgress = progress;

    // Days with finished work, scoped to the year on screen. Sent as
    // calendar-date keys formatted HERE, in the frame the task dates were
    // written in: a raw timestamp re-bucketed by the browser lands on the
    // wrong day whenever the server and the student are in different zones.
    const completedTasks = await prisma.task.findMany({
      where: { userId, ...byTerm(scope), isDone: true, isDeleted: false },
      select: { date: true },
    });
    activeDays = Array.from(new Set(completedTasks.map((t) => format(t.date, 'yyyy-MM-dd'))));
  } catch (error) {
    console.error('Streak failed to load', error);
    return (
      <Page>
        <PageHeader title="Streak" description="A record of your study days, focus time and progress." />
        <PageBody className="space-y-6 pt-6">
          <ErrorState
            title="Your streak could not be loaded"
            description="Something went wrong while reading your progress. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }
  if (!userProgress) redirect('/welcome');

  const current = userProgress.currentStreak ?? 0;
  const best = userProgress.longestStreak ?? 0;
  const focusMinutes = userProgress.totalFocusMinutes ?? 0;
  const paused = 'streakPaused' in userProgress && Boolean(userProgress.streakPaused);

  return (
    <Page>
      <PageHeader
        title="Streak"
        description="A record of your study days, focus time and progress."
        className="pt-7 pb-5 [&_h1]:text-3xl [&_h1]:font-semibold"
        actions={
          <Button asChild size="lg">
            <Link href="/history?view=completed">
              <History />
              View history
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-6 pt-6">
        <StreakBreakBanner paused={paused} currentStreak={current} />

        <section className="grid gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_2fr] lg:items-center" aria-label="Your consistency">
          <div>
            <p className="text-sm text-muted-foreground">{paused?'Current streak · paused':'Current streak'}</p>
            <p className="my-3 flex items-baseline gap-3"><span className="text-6xl font-medium tabular-nums">{current}</span><span className="text-lg text-muted-foreground">{current===1?'day':'days'}</span></p>
            <p className="max-w-sm text-sm text-muted-foreground">Active days in Study Flow, at your pace. The calendar below records completed study blocks.</p>
          </div>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:border-l lg:border-border lg:pl-8">
            <div><dt className="text-xs text-muted-foreground">Best streak</dt><dd className="mt-2 text-2xl font-medium tabular-nums">{plural(best,'day')}</dd><p className="mt-1 text-xs text-muted-foreground">All-time record</p></div>
            <div><dt className="text-xs text-muted-foreground">Study days</dt><dd className="mt-2 text-2xl font-medium tabular-nums">{activeDays.length}</dd><p className="mt-1 text-xs text-muted-foreground">In this academic year</p></div>
            <div><dt className="text-xs text-muted-foreground">Time focused</dt><dd className="mt-2 text-2xl font-medium tabular-nums">{Math.floor(focusMinutes/60)}h {focusMinutes%60}m</dd><p className="mt-1 text-xs text-muted-foreground">{plural(userProgress.focusSessions??0,'session')}</p></div>
          </dl>
        </section>
        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <StreakCalendar activeDays={activeDays} today={format(getZonedNow(userProgress.timezone),'yyyy-MM-dd')} />
          <RankRoadmap userProgress={userProgress} />
        </div>
      </PageBody>
    </Page>
  );
}
