'use client';

import { useEffect, useState } from 'react';
import { Globe, ChevronLeft, Clock, ArrowRight, Zap, Target } from 'lucide-react';
import Link from 'next/link';
import { TaskWithTemplate } from '@/lib/types';
import { getZonedNow, formatTimeZoneLabel, DEFAULT_TIMEZONE } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export function TimeClient({
  todayTasks,
  timezone = DEFAULT_TIMEZONE
}: {
  todayTasks: TaskWithTemplate[];
  timezone?: string;
}) {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [currentTask, setCurrentTask] = useState<TaskWithTemplate | null>(null);
  const [nextTask, setNextTask] = useState<TaskWithTemplate | null>(null);
  const tzLabel = formatTimeZoneLabel(timezone);

  useEffect(() => {
    const update = () => {
      const now = getZonedNow(timezone);
      
      // Update Clock
      setTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
      setDate(format(now, 'EEEE, MMMM do, yyyy'));

      const currentTimeInMins = now.getHours() * 60 + now.getMinutes();

      // Find current task
      const current = todayTasks.find(t => {
        const [sH, sM] = t.startTime.split(':').map(Number);
        const [eH, eM] = t.endTime.split(':').map(Number);
        const start = sH * 60 + sM;
        const end = eH * 60 + eM;
        return currentTimeInMins >= start && currentTimeInMins <= end && !t.isDone;
      });
      setCurrentTask(current || null);

      // Find next task
      const next = todayTasks
        .filter(t => !t.isDone && !t.isMissed)
        .find(t => {
          const [sH, sM] = t.startTime.split(':').map(Number);
          return (sH * 60 + sM) > currentTimeInMins;
        });
      setNextTask(next || null);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [todayTasks, timezone]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 md:p-12 animate-in fade-in duration-700">
      
      {/* Back Button */}
      <div className="absolute top-10 left-10">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all group font-bold uppercase tracking-widest text-xs"
        >
          <div className="p-3 rounded-2xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
      </div>

      {/* Main Clock Display */}
      <div className="flex flex-col items-center space-y-8 text-center">
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary animate-pulse">
          <Globe className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">{tzLabel} Time</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-[8rem] md:text-[12rem] lg:text-[15rem] font-heading font-black tracking-tighter leading-none text-foreground tabular-nums">
            {time.split(' ')[0]}
          </h1>
          <div className="flex items-center justify-center gap-4">
            <span className="text-4xl md:text-5xl font-heading font-black text-primary uppercase tracking-widest">
              {time.split(' ')[1]}
            </span>
            <div className="h-10 w-px bg-border/60" />
            <span className="text-2xl md:text-3xl font-medium text-muted-foreground">
              {date}
            </span>
          </div>
        </div>
      </div>

      {/* Tasks Footer */}
      <div className="mt-24 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Current Task */}
        <div className={cn(
          "relative overflow-hidden rounded-[40px] p-8 transition-all duration-500 border-2",
          currentTask ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/40"
        )}>
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Zap className="w-16 h-16" />
          </div>
          <div className="relative z-10 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Current Mission</span>
            {currentTask ? (
              <div className="space-y-2">
                <h3 className="text-3xl font-heading font-black text-foreground">{currentTask.subject}</h3>
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {currentTask.startTime} — {currentTask.endTime}
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-muted-foreground/40">No active mission right now.</p>
            )}
          </div>
        </div>

        {/* Next Task */}
        <div className={cn(
          "relative overflow-hidden rounded-[40px] p-8 transition-all duration-500 border-2",
          nextTask ? "bg-secondary/5 border-secondary/20" : "bg-muted/20 border-border/40"
        )}>
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Target className="w-16 h-16" />
          </div>
          <div className="relative z-10 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Coming Next</span>
            {nextTask ? (
              <div className="space-y-2">
                <h3 className="text-3xl font-heading font-black text-foreground">{nextTask.subject}</h3>
                <p className="text-sm font-bold text-secondary flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" /> Starts at {nextTask.startTime}
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-muted-foreground/40">Schedule clear for today.</p>
            )}
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
