import { getTodayTasks, syncStreak, getEvents, getTomorrowTasks, getYesterdayTasks } from '@/lib/actions';
import { getDueTutorModules } from '@/lib/tutor-actions';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TaskList } from '@/components/TaskList';
import { getSubjects } from '@/lib/subject-actions';
import { ProgressWidget } from '@/components/ProgressWidget';
import { MemoryGuard } from '@/components/MemoryGuard';
import { LiveFocusCard } from '@/components/LiveFocusCard';
import { LiveFocusBanner } from '@/components/LiveFocusBanner';
import { RwandaClock } from '@/components/RwandaClock';
import { DailyQuote } from '@/components/DailyQuote';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { ExamCountdown } from '@/components/ExamCountdown';
import { QuickAddForm } from '@/components/QuickAddForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';
import { format, differenceInDays } from 'date-fns';
import { Flame, Trophy, Target, History, CheckCircle2, Clock } from 'lucide-react';
import { RankBadge } from '@/components/RankBadge';
import { TaskWithTemplate, ExamEvent } from '@/lib/types';
import { DashboardClient } from './DashboardClient';
import { StreakBreakBanner } from '@/components/StreakBreakBanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component
export default async function Dashboard() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [todayTasks, tomorrowTasks, yesterdayTasks, streakData, events, dueModules, subjects] = await Promise.all([
    getTodayTasks(),
    getTomorrowTasks(),
    getYesterdayTasks(),
    syncStreak(),
    getEvents(),
    getDueTutorModules(),
    getSubjects()
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
      <div className="flex flex-col space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
        {/* Hero Section */}
      <section className="bg-background/80 backdrop-blur-md flex flex-col xl:flex-row xl:items-center justify-between gap-8 px-4 md:px-8 pt-10 pb-6 border-b border-border/40 mb-2 relative z-20">
        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between w-full">
             <div className="flex items-center gap-6 flex-wrap">
               <div className="space-y-1">
                 <DynamicGreeting name={streakData?.name || 'Student'} />
                 <div className="flex items-center gap-3 ml-1">
                   <div data-tour="command-palette" className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                     <span>Press</span>
                     <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground opacity-100">
                       <span className="text-xs">⌘</span>E
                     </kbd>
                     <span>for Command Palette</span>
                   </div>
                   <button
                     data-tour-start
                     className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                   >
                     ✨ Take a tour
                   </button>
                 </div>
               </div>
               
               <div className="h-10 w-px bg-border/60 hidden md:block" />

               {/* Duolingo-style Streak Widget */}
               <Link href="/streak" data-tour="streak" className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 px-5 py-2.5 rounded-2xl animate-in zoom-in duration-500 delay-200 shadow-sm shadow-orange-500/5 hover:scale-105 active:scale-95 transition-all group">
                 <div className="relative">
                   <Flame className="w-7 h-7 text-orange-500 fill-orange-500 animate-pulse group-hover:scale-110 transition-transform" />
                   <div className="absolute inset-0 bg-orange-500 blur-lg opacity-20" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-2xl font-heading font-black text-orange-600 leading-none">
                     {streakData?.currentStreak || 0}
                   </span>
                   <span className="text-[10px] font-bold text-orange-600/80 uppercase tracking-widest leading-none mt-1">
                     Day Streak
                   </span>
                 </div>
               </Link>

               {/* Longest Streak / Trophy Widget */}
               <Link href="/streak" className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-5 py-2.5 rounded-2xl animate-in zoom-in duration-500 delay-300 shadow-sm shadow-blue-500/5 hover:scale-105 active:scale-95 transition-all group">
                 <Trophy className="w-7 h-7 text-blue-600 fill-blue-500/20 group-hover:scale-110 transition-transform" />
                 <div className="flex flex-col">
                   <span className="text-2xl font-heading font-black text-blue-700 leading-none">
                     {streakData?.longestStreak || 0}
                   </span>
                   <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest leading-none mt-1">
                     All-Time Best
                   </span>
                 </div>
               </Link>
             </div>

             
             {/* Animated Theme Toggle in Dashboard Header */}
             <div className="xl:hidden bg-card border border-border/60 p-2 rounded-2xl shadow-sm">
                <ThemeToggle />
             </div>
          </div>
          <p className="text-xl text-muted-foreground font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary/60" />
            {format(new Date(), "EEEE, MMMM do, yyyy")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
          {/* XP & Rank Dashboard Widget */}
          {streakData && (
            <Link href="/ranks" className="bg-card border border-border/60 p-5 rounded-[28px] shadow-sm min-w-[280px] hover:shadow-md transition-all hover:scale-[1.02] active:scale-95">
               <RankBadge level={streakData.level} xp={streakData.xp} showProgress={true} />
            </Link>
          )}
          
          <Link href="/time" className="bg-card border border-border/60 p-5 rounded-[28px] shadow-sm min-w-[220px] hover:shadow-md transition-all hover:scale-[1.02] active:scale-95">
            <RwandaClock />
          </Link>

          <div className="hidden xl:flex bg-card border border-border/60 p-5 rounded-[28px] shadow-sm items-center justify-center min-w-[80px]">
             <ThemeToggle />
          </div>
        </div>
      </section>

      <div className="px-4 md:px-8 space-y-12">
        {/* Streak paused (school break) banner */}
        <StreakBreakBanner paused={!!(streakData as any)?.streakPaused} currentStreak={streakData?.currentStreak || 0} />

        {/* Live Focus Card (Auto-detects current task) */}
        <LiveFocusCard
          todayTasks={todayTasks as TaskWithTemplate[]} 
          tomorrowTasks={tomorrowTasks as TaskWithTemplate[]}
          yesterdayTasks={yesterdayTasks as TaskWithTemplate[]}
        />

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Left Column: Today's Focus & Bible Verse */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between" data-tour="todays-focus">
                <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Today&apos;s Focus</h2>
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
            <div className="bg-card border border-border/60 shadow-sm rounded-[32px] p-8 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary rounded-full blur-3xl -z-0 opacity-20 translate-x-1/2 -translate-y-1/2" />
              
              <h3 className="font-heading font-bold text-xl mb-6 relative z-10 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-secondary" />
                Tomorrow&apos;s Plan
              </h3>
              
              <div className="relative z-10">
                {tomorrowTasks.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">Nothing scheduled for tomorrow.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tomorrowTasks.map(task => (
                      <div key={task.id} className="flex justify-between items-center bg-muted/40 px-5 py-4 rounded-2xl border border-border/40 group hover:bg-white dark:hover:bg-black transition-colors shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <DeleteTaskButton taskId={task.id} className="h-8 w-8" />
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate mr-4">{task.subject}</span>
                        </div>
                        <span className="text-xs font-black text-muted-foreground bg-background px-3 py-1 rounded-full border shrink-0">{task.startTime}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Next Exam Focus Widget */}
            <div className="bg-card border border-border/60 shadow-sm rounded-[32px] p-8 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -z-0 opacity-20 translate-x-1/2 -translate-y-1/2" />
              
              <h3 className="font-heading font-bold text-xl mb-6 relative z-10 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Exam Timeline
              </h3>
              
              <div className="relative z-10">
                {nextExam ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex flex-col flex-1">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">
                        NEXT EXAM: {nextExam.title}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-heading font-black text-foreground tracking-tighter">
                          {daysToNext}
                        </span>
                        <span className="text-2xl font-bold text-muted-foreground">
                          {daysToNext === 1 ? 'day' : 'days'} left
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground mt-1">
                        Scheduled for {format(new Date(nextExam.date), 'EEEE, MMMM do')}
                      </span>
                    </div>

                    {nextNextExam && (
                      <div className="pt-6 md:pt-0 md:pl-8 border-t md:border-t-0 md:border-l border-border/40 flex flex-col flex-1">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                          FOLLOWED BY
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
          <div className="lg:col-span-4 space-y-8">
            
            <MemoryGuard dueModules={dueModules as any} />

            <ProgressWidget 
              percentage={progressPercentage} 
              completed={completedTasks} 
              total={totalTasks} 
            />

            <ExamCountdown events={events as ExamEvent[]} />

            {/* Yesterday's Review (Positioned under Exams, besides Plan) */}
            <div className="bg-card border border-border/60 shadow-sm rounded-[32px] p-8 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-3xl -z-0 opacity-10 translate-x-1/2 -translate-y-1/2" />
              
              <h3 className="font-heading font-bold text-xl mb-6 relative z-10 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Yesterday&apos;s Review
              </h3>
              
              <div className="relative z-10">
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
                        <span className="text-[10px] font-black text-primary bg-background px-3 py-1 rounded-full border border-primary/20 shrink-0">DONE</span>
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
