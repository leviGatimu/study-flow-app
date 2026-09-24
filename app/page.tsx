import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format, startOfDay } from 'date-fns';
import { CalendarDays, CheckCircle2, History } from 'lucide-react';

import { getTodayTasks, syncStreak, getEvents, getTomorrowTasks, getYesterdayTasks } from '@/lib/actions';
import { getCurrentScheduleState } from '@/lib/term-actions';
import { getUserId } from '@/lib/auth';
import { listSubjects } from '@/lib/subject-actions';
import { getSchoolLessons } from '@/lib/school-actions';
import { getHomeworks } from '@/lib/homework-actions';
import { getSetupSnapshot } from '@/lib/setup-actions';
import { buildChecklist } from '@/lib/setup';
import { DEFAULT_TIMEZONE, getZonedNow } from '@/lib/utils';
import { TaskWithTemplate, ExamEvent } from '@/lib/types';
import { TaskList } from '@/components/TaskList';
import { ProgressWidget } from '@/components/ProgressWidget';
import { LiveFocusCard } from '@/components/LiveFocusCard';
import { DailyQuote } from '@/components/DailyQuote';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { ExamCountdown } from '@/components/ExamCountdown';
import { DueHomework } from '@/components/DueHomework';
import { QuickAddForm } from '@/components/QuickAddForm';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';
import { TermStatusBanner, PauseScheduleButton } from '@/components/TermStatusBanner';
import { SetupChecklist } from '@/components/onboarding/SetupChecklist';
import { Section } from '@/components/ui/section';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [todayTasks, tomorrowTasks, yesterdayTasks, streakData, events, subjects, schedule, schoolLessons, setup, homework] = await Promise.all([
    getTodayTasks(),
    getTomorrowTasks(),
    getYesterdayTasks(),
    syncStreak(),
    getEvents(),
    listSubjects(),
    getCurrentScheduleState(),
    getSchoolLessons(),
    getSetupSnapshot(),
    getHomeworks(),
  ]);

  // "Today" in the user's own timezone, for everything on this page that
  // counts days.
  const timezone = streakData?.timezone || DEFAULT_TIMEZONE;
  const zonedNow = getZonedNow(timezone);
  const today = startOfDay(zonedNow);
  const todayKey = format(zonedNow, 'yyyy-MM-dd');

  // Only for an account that has never finished (or dismissed) setup. Every
  // account that existed before the wizard was backfilled as done, so this is
  // silent for them - being handed a checklist after a year of use would be an
  // insult, not a help.
  const setupItems =
    setup && setup.setupCompletedAt === null ? buildChecklist(setup) : [];
  
  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter((t) => t.isDone).length;
  const progressPercentage = totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <>
      <DashboardClient streakData={streakData} />
      <div className="flex flex-col max-w-[1600px] mx-auto w-full animate-in fade-in duration-500 pb-16">
        {/* Hero. Streak, all-time best, level/XP, the clock and the theme
          toggle all live in the app header now, so they are not repeated here. */}
      <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4 md:px-8 pt-8 pb-6 border-b border-border/40">
        <div className="space-y-2">
          <DynamicGreeting name={streakData?.name || 'Student'} timezone={timezone} />
          <p className="text-base text-muted-foreground font-medium">
            {format(zonedNow, "EEEE, MMMM do, yyyy")}
          </p>
          <button
            type="button"
            data-tour-start
            className="text-xs font-bold text-primary/80 hover:text-primary transition-colors"
          >
            Take a tour
          </button>
        </div>

        {schedule?.classLabel && (
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm sm:min-w-72">
            <p className="text-xs font-bold text-muted-foreground">Currently in</p>
            {/* Pause sits with the term it pauses, not off in a corner. */}
            <div className="flex items-center justify-between gap-5 mt-1">
              <Link href="/year" className="font-heading font-bold text-2xl leading-tight hover:text-primary transition-colors">
                {schedule.classLabel}
                {schedule.termName && (
                  <span className="text-muted-foreground font-bold text-lg"> · {schedule.termName}</span>
                )}
              </Link>
              <PauseScheduleButton state={schedule} />
            </div>
          </div>
        )}
      </section>

      <div className="px-4 md:px-8 pt-8 space-y-8">
        {/* Everything a new account still needs. Above the fold, above even the
            term banner: on a raw account it is the only thing on this page with
            anything to say. */}
        {setupItems.length > 0 && <SetupChecklist items={setupItems} />}

        {/* Pause, end-of-term prompt, start next term, new year. Silent while a
            term is simply running. */}
        <TermStatusBanner state={schedule} />

        {/* What is happening right now: the block in progress, the next one,
            a school lesson, or the break between. The page's strongest element
            on purpose - it answers "what should I do now". */}
        <LiveFocusCard
          todayTasks={todayTasks as TaskWithTemplate[]}
          tomorrowTasks={tomorrowTasks as TaskWithTemplate[]}
          yesterdayTasks={yesterdayTasks as TaskWithTemplate[]}
          schoolLessons={schoolLessons}
          timezone={timezone}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: the day itself. */}
          <div className="lg:col-span-8 space-y-6">
            <Section
              title="Today's focus"
              actions={
                <>
                  <span data-tour="quick-add">
                    <QuickAddForm subjects={subjects} />
                  </span>
                  <Pill className="px-4 py-1.5 text-sm">
                    {completedTasks} / {totalTasks} done
                  </Pill>
                </>
              }
            >
              <div data-tour="todays-focus">
                <TaskList tasks={todayTasks as TaskWithTemplate[]} />
              </div>
            </Section>

            <Panel interactive>
              <PanelTitle
                icon={<CalendarDays />}
                action={
                  <Link href="/timetable" className="text-sm font-medium text-primary hover:underline">
                    This week
                  </Link>
                }
              >
                Tomorrow&apos;s plan
              </PanelTitle>
              {tomorrowTasks.length === 0 ? (
                <EmptyState
                  title="Nothing scheduled for tomorrow"
                  description="A free day, or a gap in your routine you may want to fill."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tomorrowTasks.map((task) => (
                    <ListRow
                      key={task.id}
                      leading={<DeleteTaskButton taskId={task.id} className="size-8" />}
                      title={task.subject}
                      subtitle={task.type === 'HOMEWORK' ? 'Homework' : 'Revision'}
                      trailing={<Pill>{task.startTime}</Pill>}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <DailyQuote />
          </div>

          {/* Right: how the day is going, and what is coming. */}
          <div className="lg:col-span-4 space-y-6">
            <ProgressWidget
              percentage={progressPercentage}
              completed={completedTasks}
              total={totalTasks}
            />

            <DueHomework homework={homework} todayKey={todayKey} />

            <ExamCountdown events={events as ExamEvent[]} today={today} />

            <Panel interactive>
              <PanelTitle
                icon={<History />}
                action={
                  <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                    History
                  </Link>
                }
              >
                Yesterday
              </PanelTitle>
              {yesterdayTasks.length === 0 ? (
                <EmptyState
                  title="Nothing finished yesterday"
                  description="Blocks you tick off show up here the next day."
                />
              ) : (
                <div className="space-y-3">
                  {yesterdayTasks.slice(0, 6).map((task) => (
                    <ListRow
                      key={task.id}
                      leading={<CheckCircle2 className="size-4 shrink-0 text-success" />}
                      title={task.subject}
                      trailing={<Pill tone="success">Done</Pill>}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
