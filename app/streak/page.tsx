import { syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Flame, Trophy, ChevronLeft, Zap, BarChart3 } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { StreakCalendar } from './StreakCalendar';
import { StreakBreakBanner } from '@/components/StreakBreakBanner';

export const dynamic = 'force-dynamic';

export default async function StreakPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const userProgress = await syncStreak();
  
  // Get activity history (days with completed tasks). Scoped to the year on
  // screen, so the calendar shows that year's activity rather than every year
  // stacked on top of each other. The streak counters themselves already live
  // on the Class, so they follow the same year.
  const scope = await getViewScope(userId);

  const completedTasks = await prisma.task.findMany({
    where: {
      userId,
      ...byTerm(scope),
      isDone: true,
      isDeleted: false,
    },
    select: {
      date: true,
    },
  });

  const activeTimestamps = Array.from(
    new Set(completedTasks.map((t) => startOfDay(t.date).getTime()))
  );

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pt-10 pb-6 border-b border-border/40 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Streak</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Your consistency record and daily activity calendar.</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group shrink-0"
        >
          <div className="p-2 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </div>
          Back to dashboard
        </Link>
      </div>

      <div>
        <StreakBreakBanner paused={!!(userProgress as any)?.streakPaused} currentStreak={userProgress?.currentStreak || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Left Column: Big Streak Stats */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-card border border-orange-500/20 rounded-2xl p-10 flex flex-col items-center text-center space-y-6 shadow-sm">
            <Flame className="w-24 h-24 text-orange-500 fill-orange-500" />
            <div className="space-y-2">
              <span className="text-8xl font-heading font-black tracking-tighter text-foreground leading-none">
                {userProgress?.currentStreak || 0}
              </span>
              <p className="text-sm font-semibold text-orange-500">Day streak</p>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              You&apos;ve stayed focused for {userProgress?.currentStreak ?? 0} days straight. Keep the fire burning!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/60 rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
              <Trophy className="w-8 h-8 text-blue-500" />
              <div>
                <span className="text-2xl font-black block">{userProgress?.longestStreak || 0}</span>
                <span className="text-xs font-medium text-muted-foreground">All-time best</span>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
              <Zap className="w-8 h-8 text-purple-500" />
              <div>
                <span className="text-2xl font-black block">{userProgress?.xp || 0}</span>
                <span className="text-xs font-medium text-muted-foreground">Total XP</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-8 space-y-6">
            <h3 className="font-heading font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Consistency Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-2xl">
                <span className="text-sm text-muted-foreground">Focus sessions</span>
                <span className="font-black">{userProgress?.focusSessions || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-2xl">
                <span className="text-sm text-muted-foreground">Time focused</span>
                <span className="font-black">
                  {Math.floor((userProgress?.totalFocusMinutes || 0) / 60)}h {(userProgress?.totalFocusMinutes || 0) % 60}m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calendar & Activity */}
        <div className="lg:col-span-7 space-y-8">
          <StreakCalendar activeTimestamps={activeTimestamps} />

          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-10 space-y-3">
            <h3 className="font-heading font-bold text-lg text-foreground">Keep the streak alive!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Consistency is the key to elite performance. Complete at least one task today to maintain your streak and earn bonus XP.
            </p>
            <div className="pt-3">
              <Link href="/">
                <button className="bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm font-medium px-6 py-3 rounded-xl">
                  Go execute tasks
                </button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
