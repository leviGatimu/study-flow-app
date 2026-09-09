import { getTodayTasks, syncStreak, getEvents, getTomorrowTasks, getYesterdayTasks } from '@/lib/actions';
import { getCurrentScheduleState } from '@/lib/term-actions';
import { getDueTutorModules } from '@/lib/tutor-actions';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TaskList } from '@/components/TaskList';
import { listSubjects } from '@/lib/subject-actions';
import { getSchoolLessons } from '@/lib/school-actions';
import { ProgressWidget } from '@/components/ProgressWidget';
import { MemoryGuard } from '@/components/MemoryGuard';
import { LiveFocusCard } from '@/components/LiveFocusCard';
import { DailyQuote } from '@/components/DailyQuote';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { ExamCountdown } from '@/components/ExamCountdown';
import { QuickAddForm } from '@/components/QuickAddForm';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';
import { format, differenceInDays } from 'date-fns';
import { CalendarDays, History, CheckCircle2, Clock } from 'lucide-react';
import { TaskWithTemplate, ExamEvent } from '@/lib/types';
import { DashboardClient } from './DashboardClient';
import { TermStatusBanner, PauseScheduleButton } from '@/components/TermStatusBanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component
export default async function Dashboard() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [todayTasks, tomorrowTasks, yesterdayTasks, streakData, events, dueModules, subjects, schedule, schoolLessons] = await Promise.all([
    getTodayTasks(),
    getTomorrowTasks(),
    getYesterdayTasks(),
    syncStreak(),
    getEvents(),
    getDueTutorModules(),
    listSubjects(),
    getCurrentScheduleState(),
    getSchoolLessons()
  ]);
  
  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter((t) => t.isDone).length;
  const progressPercentage = totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);

  const upcomingEvents = (events || [])
    .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextExam = upcomingEvents[0];
  const nextNextExam = upcomingEvents[1];

  const daysToNext = nextExam 
    ? differenceInDays(new Date(nextExam.date), new Date(new Date().setHours(0,0,0,0))) 
    : null;
  const daysToNextNext = nextNextExam 
    ? differenceInDays(new Date(nextNextExam.date), new Date(new Date().setHours(0,0,0,0))) 
    : null;

  return (
    <>
      <DashboardClient streakData={streakData as any} />
      <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
        {/* Hero. Streak, all-time best, level/XP, the clock and the theme
          toggle all live in the app header now, so they are not repeated here. */}
      <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4 md:px-8 pt-10 pb-6 border-b border-border/40 mb-2">
        <div className="space-y-2">
          <DynamicGreeting name={streakData?.name || 'Student'} timezone={(streakData as any)?.timezone} />
          <p className="text-base text-muted-foreground font-medium">
            {format(new Date(), "EEEE, MMMM do, yyyy")}
          </p>
          <button
            data-tour-start
            className="text-xs font-bold text-primary/80 hover:text-primary transition-colors"
          >
            Take a tour
          </button>
        </div>

        {schedule?.classLabel && (
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm min-w-[280px]">
            <p className="text-xs font-bold text-muted-foreground">Currently in</p>
            {/* Pause sits with the term it pauses, not off in a corner. */}
            <div className="flex items-center justify-between gap-5 mt-1">
              <p className="font-heading font-black text-2xl leading-tight">
                {schedule.classLabel}
                {schedule.termName && (
                  <span className="text-muted-foreground font-bold text-lg"> · {schedule.termName}</span>
                )}
              </p>
              <PauseScheduleButton state={schedule} />
            </div>
          </div>
        )}
      </section>

      <div className="px-4 md:px-8 space-y-8">
        {/* Pause, end-of-term prompt, start next term, new year. Silent while a
            term is simply running. */}
        <TermStatusBanner state={schedule} />

        {/* Live Focus Card (Auto-detects current task) */}
        <LiveFocusCard
          todayTasks={todayTasks as TaskWithTemplate[]} 
          tomorrowTasks={tomorrowTasks as TaskWithTemplate[]}
          yesterdayTasks={yesterdayTasks as TaskWithTemplate[]}
          schoolLessons={schoolLessons}
        />

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Today's Focus & Bible Verse */}
          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between" data-tour="todays-focus">
                <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">Today&apos;s Focus</h2>
                <div className="flex items-center gap-4">
                  <span data-tour="quick-add">
                    <QuickAddForm subjects={subjects} />
                  </span>
                  <div className="text-sm font-semibold bg-muted px-4 py-1.5 rounded-full text-muted-foreground border">
                    {completedTasks} / {totalTasks} Tasks
                  </div>
                </div>
              </div>
              
              <TaskList tasks={todayTasks as TaskWithTemplate[]} />
            </div>

            {/* Daily Quote / Bible Verse */}
            <DailyQuote />

            {/* Tomorrow's Plan (Original Size/Location) */}
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 hover:shadow-md transition-shadow duration-200">
              
              <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Tomorrow&apos;s Plan
              </h3>
              
              <div>
                {tomorrowTasks.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">Nothing scheduled for tomorrow.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tomorrowTasks.map(task => (
                      <div key={task.id} className="flex justify-between items-center bg-muted/40 px-5 py-4 rounded-2xl border border-border/40 group hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <DeleteTaskButton taskId={task.id} className="h-8 w-8" />
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate mr-4">{task.subject}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-muted-foreground bg-background px-2.5 py-1 rounded-full border shrink-0">{task.startTime}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Next Exam Focus Widget */}
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 hover:shadow-md transition-shadow duration-200">
              
              <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Exam Timeline
              </h3>
              
              <div>
                {nextExam ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex flex-col flex-1">
                      <span className="text-xs font-bold text-orange-500 mb-1">
                        Next exam · {nextExam.title}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-heading font-black text-foreground tracking-tight">
                          {daysToNext}
                        </span>
                        <span className="text-xl font-bold text-muted-foreground">
                          {daysToNext === 1 ? 'day' : 'days'} left
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground mt-1">
                        Scheduled for {format(new Date(nextExam.date), 'EEEE, MMMM do')}
                      </span>
                    </div>

                    {nextNextExam && (
                      <div className="pt-6 md:pt-0 md:pl-8 border-t md:border-t-0 md:border-l border-border/40 flex flex-col flex-1">
                        <span className="text-xs font-bold text-muted-foreground mb-1">
                          Followed by
                        </span>
                        <span className="text-lg font-black text-foreground">
                          {nextNextExam.title}
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground mt-1">
                          in {daysToNextNext} {daysToNextNext === 1 ? 'day' : 'days'} ({format(new Date(nextNextExam.date), 'MMM d, yyyy')})
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                    No upcoming exams scheduled.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Quick Overview & Events & Yesterday */}
          <div className="lg:col-span-4 space-y-6">
            
            <MemoryGuard dueModules={dueModules as any} />

            <ProgressWidget 
              percentage={progressPercentage} 
              completed={completedTasks} 
              total={totalTasks} 
            />

            <ExamCountdown events={events as ExamEvent[]} />

            {/* Yesterday's Review (Positioned under Exams, besides Plan) */}
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 hover:shadow-md transition-shadow duration-200">
              
              <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Yesterday&apos;s Review
              </h3>
              
              <div>
                {yesterdayTasks.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground text-center py-8 bg-muted/50 rounded-2xl border border-border/50">No completed tasks recorded for yesterday.</p>
                ) : (
                  <div className="space-y-3">
                    {yesterdayTasks.slice(0, 6).map(task => (
                      <div key={task.id} className="flex justify-between items-center bg-primary/5 px-5 py-4 rounded-2xl border border-primary/10 group hover:bg-primary/10 transition-colors shadow-sm">
                        <div className="flex items-center gap-3 truncate">
                          <DeleteTaskButton taskId={task.id} className="h-8 w-8" />
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{task.subject}</span>
                        </div>
                        <span className="text-xs font-bold text-primary bg-background px-2.5 py-1 rounded-full border border-primary/20 shrink-0">Done</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
