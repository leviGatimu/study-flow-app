import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarCheck, Clock, Flame, ListChecks, Timer, Trophy } from 'lucide-react';

import { syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { Stat } from '@/components/ui/stat';
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
        <PageHeader title="Streak" description="How many days in a row you have studied, and the level it has earned you." />
        <PageBody>
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
        description="How many days in a row you have studied, and the level it has earned you."
        highlight={{ label: paused ? 'Current streak (paused)' : 'Current streak', value: `${current} ${current === 1 ? 'day' : 'days'}` }}
        actions={
          <Button asChild size="lg">
            <Link href="/">
              <ListChecks />
              Today&apos;s tasks
            </Link>
          </Button>
        }
      />

      <PageBody>
        <StreakBreakBanner paused={paused} currentStreak={current} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <Panel className="flex items-center gap-5">
              <Flame className="size-14 shrink-0 fill-orange-500 text-orange-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Current streak</p>
                <p className="font-heading text-6xl font-black leading-none tracking-tight tabular-nums text-foreground">
                  {current}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {current === 0
                    ? 'Finish one block today to start a new streak.'
                    : `${plural(current, 'day')} in a row. Finish a block today to keep it going.`}
                </p>
              </div>
            </Panel>

            <Panel className="grid grid-cols-2 gap-x-4 gap-y-6">
              <Stat icon={<Trophy />} label="Best streak" value={plural(best, 'day')} hint="All-time record" />
              <Stat icon={<CalendarCheck />} label="Study days" value={activeDays.length} hint="This year, any finished block" />
              <Stat
                icon={<Timer />}
                label="Focus sessions"
                value={userProgress.focusSessions ?? 0}
                hint="Timed in Focus"
              />
              <Stat
                icon={<Clock />}
                label="Time focused"
                value={`${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m`}
                hint="Across all sessions"
              />
            </Panel>
          </div>

          <div className="lg:col-span-7">
            <StreakCalendar activeDays={activeDays} />
          </div>
        </div>

        <Section title="Level and rank" description="Everything you finish earns XP. XP raises your level, and levels unlock ranks.">
          <RankRoadmap userProgress={userProgress} />
        </Section>
      </PageBody>
    </Page>
  );
}
