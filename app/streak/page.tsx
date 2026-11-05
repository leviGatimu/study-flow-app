import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays, Check, Clock, Flame, History, Lock, Trophy } from 'lucide-react';
import { cn, getZonedNow } from '@/lib/utils';

import { syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { blockMinutes, formatMinutes } from '@/lib/schedule-layout';
import { buildHeatmap, milestones, nextMilestone, thisWeek } from '@/lib/streak-heatmap';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { StreakBreakBanner } from '@/components/StreakBreakBanner';
import { RankRoadmap } from '@/components/RankRoadmap';
import { YearHeatmap } from './YearHeatmap';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DESCRIPTION = 'The days in a row you studied, a year of study days, and what they have earned.';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Streak: the run of days (and how to keep it), a year of study days as a
 * heatmap, milestones, and the level and rank they earn. The old Ranks page
 * lives here too.
 */
export default async function StreakPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let userProgress: Awaited<ReturnType<typeof syncStreak>>;
  const minutesByDay: Record<string, number> = {};
  try {
    const [progress, scope] = await Promise.all([syncStreak(), getViewScope(userId)]);
    userProgress = progress;

    // Finished blocks in the year on screen, keyed by calendar date formatted
    // HERE, in the frame the task dates were written in: a raw timestamp
    // re-bucketed by the browser lands on the wrong day across time zones.
    const completed = await prisma.task.findMany({
      where: { userId, ...byTerm(scope), isDone: true, isDeleted: false },
      select: { date: true, startTime: true, endTime: true },
    });
    for (const t of completed) {
      const key = format(t.date, 'yyyy-MM-dd');
      minutesByDay[key] = (minutesByDay[key] ?? 0) + Math.max(0, blockMinutes(t.startTime, t.endTime));
    }
  } catch (error) {
    console.error('Streak failed to load', error);
    return (
      <Page>
        <PageHeader title="Streak" description={DESCRIPTION} />
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

  const activeDays = Object.keys(minutesByDay);
  const current = userProgress.currentStreak ?? 0;
  const best = userProgress.longestStreak ?? 0;
  const focusMinutes = userProgress.totalFocusMinutes ?? 0;
  const paused = 'streakPaused' in userProgress && Boolean(userProgress.streakPaused);

  const today = format(getZonedNow(userProgress.timezone), 'yyyy-MM-dd');
  const weeks = buildHeatmap(minutesByDay, activeDays, today);
  const week = thisWeek(activeDays, today);
  const studiedToday = activeDays.includes(today);
  const next = nextMilestone(current);
  const shown = weeks.flatMap((w) => w.cells).filter((c) => !c.future);
  const yearDays = shown.filter((c) => c.level > 0).length;
  const yearMinutes = shown.reduce((sum, c) => sum + c.minutes, 0);
  const weekDone = week.filter((d) => d.studied).length;
  const lit = current > 0 && !paused;

  const nudge = paused
    ? 'Your streak is paused for the school break. Resume it when you are back.'
    : studiedToday
      ? `Today counts. Come back tomorrow to make it ${current + 1}.`
      : current > 0
        ? `Finish a block today to make it ${current + 1}.`
        : 'Finish one study block today to start a new streak.';

  return (
    <Page>
      <PageHeader
        title="Streak"
        description={DESCRIPTION}
        actions={
          <Button asChild variant="outline">
            <Link href="/history?view=completed">
              <History /> View history
            </Link>
          </Button>
        }
      />

      <PageBody>
        <StreakBreakBanner paused={paused} currentStreak={current} />

        <Panel padded={false} className="overflow-hidden">
          <div className="grid lg:grid-cols-12">
            <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:col-span-5">
              <div className="flex items-center gap-5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-20 shrink-0 items-center justify-center rounded-3xl',
                    lit ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/25' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Flame className="size-10" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{paused ? 'Current streak · paused' : 'Current streak'}</p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-heading text-6xl font-black tabular-nums tracking-tight text-foreground">{current}</span>
                    <span className="text-lg font-semibold text-muted-foreground">{current === 1 ? 'day' : 'days'}</span>
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground">{nudge}</p>
              {next && !paused && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                    <span>Next milestone: {next.days} days</span>
                    <span className="tabular-nums">{plural(next.left, 'day')} to go</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Progress to the ${next.days}-day milestone`}
                    aria-valuemin={0}
                    aria-valuemax={next.days}
                    aria-valuenow={current}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      style={{ width: `${Math.round((current / next.days) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 lg:col-span-7 lg:border-l lg:border-t-0">
              <Tile icon={<Trophy />} label="Best streak" value={plural(best, 'day')} note={best > 0 && best === current ? 'You are on it now' : 'All-time record'} />
              <Tile icon={<CalendarDays />} label="Study days" value={String(yearDays)} note="In the last 12 months" />
              <Tile icon={<Clock />} label="Time focused" value={formatMinutes(focusMinutes)} note={plural(userProgress.focusSessions ?? 0, 'focus session')} />
              <div className="bg-card p-5 sm:p-6">
                <p className="text-xs font-medium text-muted-foreground">This week</p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground">{weekDone} / 7</p>
                <ol className="mt-3 flex gap-1.5" aria-label="Days studied this week">
                  {week.map((d) => (
                    <li key={d.key} className="flex flex-1 flex-col items-center gap-1">
                      <span
                        aria-label={`${d.label}: ${d.future ? 'still to come' : d.studied ? 'studied' : 'not studied'}`}
                        className={cn(
                          'flex h-7 w-full max-w-8 items-center justify-center rounded-md border',
                          d.studied ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-muted/40',
                          d.isToday && !d.studied && 'border-dashed border-primary',
                          d.future && 'opacity-50'
                        )}
                      >
                        {d.studied && <Check className="size-3.5" />}
                      </span>
                      <span className={cn('text-[10px] font-medium', d.isToday ? 'text-primary' : 'text-muted-foreground')}>{d.label[0]}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            icon={<CalendarDays />}
            action={
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {plural(yearDays, 'day')} · {formatMinutes(yearMinutes)}
              </span>
            }
          >
            Your year
          </PanelTitle>
          <YearHeatmap weeks={weeks} />
        </Panel>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel>
            <PanelTitle icon={<Flame />}>Milestones</PanelTitle>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {milestones(best).map((m) => (
                <li
                  key={m.days}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 text-center',
                    m.reached ? 'border-orange-500/25 bg-orange-500/5' : 'border-border/60 bg-muted/30'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full',
                      m.reached ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {m.reached ? <Flame className="size-5" /> : <Lock className="size-4" />}
                  </span>
                  <span className="font-heading text-lg font-bold tabular-nums text-foreground">{m.days} days</span>
                  <span className="text-xs text-muted-foreground">{m.reached ? 'Reached' : `${m.days - best} to go`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Milestones count your best streak, so a break never takes one away.</p>
          </Panel>
          <RankRoadmap userProgress={userProgress} />
        </div>
      </PageBody>
    </Page>
  );
}

function Tile({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="bg-card p-5 sm:p-6">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-primary">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
