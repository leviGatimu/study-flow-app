import { syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Flame, Trophy, ChevronLeft, Zap, Target, BarChart3 } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { StreakCalendar } from './StreakCalendar';
import { StreakBreakBanner } from '@/components/StreakBreakBanner';

export const dynamic = 'force-dynamic';

export default async function StreakPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const userProgress = await syncStreak();
  
  // Get activity history (days with completed tasks)
  const completedTasks = await prisma.task.findMany({
    where: {
      userId,
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
    <div className="min-h-screen bg-background text-foreground pb-20 px-4 md:px-8 max-w-6xl mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <header className="py-10 flex items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group font-bold uppercase tracking-widest text-xs"
        >
          <div className="p-2 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-all">
            <ChevronLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </Link>
        <h1 className="text-xl font-black uppercase tracking-[0.3em] opacity-20 hidden md:block">Mastery Engine</h1>
      </header>

      <div className="mb-8">
        <StreakBreakBanner paused={!!(userProgress as any)?.streakPaused} currentStreak={userProgress?.currentStreak || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Left Column: Big Streak Stats */}
        <div className="lg:col-span-5 space-y-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-[40px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-card border border-orange-500/20 rounded-[40px] p-10 flex flex-col items-center text-center space-y-6 shadow-2xl">
              <div className="relative">
                <Flame className="w-24 h-24 text-orange-500 fill-orange-500 animate-pulse" />
                <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-20 animate-pulse" />
              </div>
              <div className="space-y-2">
                <span className="text-8xl font-heading font-black tracking-tighter text-foreground leading-none">
                  {userProgress?.currentStreak || 0}
                </span>
                <p className="text-xl font-black uppercase tracking-[0.2em] text-orange-500">Day Streak</p>
              </div>
              <p className="text-muted-foreground font-medium max-w-xs leading-relaxed">
                You&apos;ve stayed focused for {userProgress?.currentStreak ?? 0} days straight. Keep the fire burning!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/60 rounded-[32px] p-6 flex flex-col items-center text-center space-y-3 hover:border-blue-500/30 transition-colors">
              <Trophy className="w-8 h-8 text-blue-500" />
              <div>
                <span className="text-2xl font-black block">{userProgress?.longestStreak || 0}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">All-Time Best</span>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-[32px] p-6 flex flex-col items-center text-center space-y-3 hover:border-purple-500/30 transition-colors">
              <Zap className="w-8 h-8 text-purple-500" />
              <div>
                <span className="text-2xl font-black block">{userProgress?.xp || 0}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total XP</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-[32px] p-8 space-y-6">
            <h3 className="font-heading font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Consistency Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-2xl">
                <span className="text-sm font-bold text-muted-foreground">Focus Sessions</span>
                <span className="font-black">{userProgress?.focusSessions || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-2xl">
                <span className="text-sm font-bold text-muted-foreground">Time Focused</span>
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

          <div className="bg-primary/5 border border-primary/10 rounded-[40px] p-10 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
               <Target className="w-32 h-32" />
            </div>
            <h3 className="text-2xl font-heading font-black relative z-10">Keep the streak alive!</h3>
            <p className="text-muted-foreground font-medium leading-relaxed max-w-lg relative z-10">
              Consistency is the key to elite performance. Complete at least one task today to maintain your streak and earn bonus XP.
            </p>
            <div className="pt-4 relative z-10">
              <Link href="/">
                <button className="bg-foreground text-background font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                  Go Execute Tasks
                </button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
