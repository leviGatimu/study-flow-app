"use client";

import { useState, useEffect, useMemo } from 'react';
import { Zap, Play, ArrowRight, Clock, Target, Flame, Pause, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { TaskWithTemplate } from '@/lib/types';
import { cn, getRwandaTime } from '@/lib/utils';
import { useFocus } from '@/lib/FocusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SCHOOL_DATA, Lesson } from './SchoolTimetable';
import { format } from 'date-fns';

export function LiveFocusCard({ 
  todayTasks,
  tomorrowTasks = [],
  yesterdayTasks = []
}: { 
  todayTasks: TaskWithTemplate[],
  tomorrowTasks?: TaskWithTemplate[],
  yesterdayTasks?: TaskWithTemplate[]
}) {
  const { activeTask, isPaused, step, timeLeft: contextTime, isActive, resetFocus } = useFocus();
  const [isTimetableSynced, setIsTimetableSynced] = useState(true);

  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('isTimetableSynced');
        if (stored !== null) {
          setIsTimetableSynced(stored === 'true');
        }
      }
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleToggleSync = (checked: boolean) => {
    setIsTimetableSynced(checked);
    localStorage.setItem('isTimetableSynced', String(checked));
    window.dispatchEvent(new Event('storage'));
  };

  const [currentScheduledTask, setCurrentScheduledTask] = useState<TaskWithTemplate | null>(null);
  const [activeSchoolLesson, setActiveSchoolLesson] = useState<Lesson | null>(null);
  const [nextSchoolLesson, setNextSchoolLesson] = useState<Lesson | null>(null);
  const [nextTask, setNextTask] = useState<TaskWithTemplate | null>(null);
  const [localTimeLeft, setLocalTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [breakTimeLeft, setBreakTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [schoolTimeLeft, setSchoolTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  // 0. Search Pool: Check today's tasks and yesterday's tasks (for midnight crossing)
  const searchPool = useMemo(() => [...todayTasks, ...yesterdayTasks], [todayTasks, yesterdayTasks]);

  // Update current scheduled task, school lesson and timers
  useEffect(() => {
    const updateTaskAndTimer = () => {
      const now = getRwandaTime();
      const currentTimeInMins = now.getHours() * 60 + now.getMinutes();
      const currentDayName = format(now, 'EEEE');

      // 1. Find School Lesson scheduled for RIGHT NOW
      const dayLessons = SCHOOL_DATA.filter(l => l.day === currentDayName);
      const activeLesson = isTimetableSynced ? dayLessons.find(l => {
        const [sH, sM] = l.start.split(':').map(Number);
        const [eH, eM] = l.end.split(':').map(Number);
        const start = sH * 60 + sM;
        const end = eH * 60 + eM;
        return currentTimeInMins >= start && currentTimeInMins < end;
      }) : null;
      setActiveSchoolLesson(activeLesson || null);

      // 2. Find task scheduled for RIGHT NOW (including 5m prep window)
      // Prioritize tasks WITHOUT a templateId (Quick Tasks) first
      const current = searchPool.find(t => {
        const [sH, sM] = t.startTime.split(':').map(Number);
        const [eH, eM] = t.endTime.split(':').map(Number);
        const start = sH * 60 + sM;
        let end = eH * 60 + eM;
        let cur = currentTimeInMins;

        // Determine if this task is from today or yesterday
        const isFromToday = todayTasks.some(tt => tt.id === t.id);

        if (end < start) {
          if (isFromToday) end += 1440;
          else { cur += 1440; end += 1440; }
        } else if (!isFromToday) return false;

        const isCurrentlyActive = cur >= (start - 5) && cur <= end && !t.isDone && !t.isMissed;
        return isCurrentlyActive && !t.templateId;
      }) || searchPool.find(t => {
        const [sH, sM] = t.startTime.split(':').map(Number);
        const [eH, eM] = t.endTime.split(':').map(Number);
        const start = sH * 60 + sM;
        let end = eH * 60 + eM;
        let cur = currentTimeInMins;
        const isFromToday = todayTasks.some(tt => tt.id === t.id);

        if (end < start) {
          if (isFromToday) end += 1440;
          else { cur += 1440; end += 1440; }
        } else if (!isFromToday) return false;

        return cur >= (start - 5) && cur <= end && !t.isDone && !t.isMissed;
      });
      setCurrentScheduledTask(current || null);

      // 3. Find NEXT School Lesson today
      const nextLesson = isTimetableSynced ? dayLessons.find(l => {
        const [sH, sM] = l.start.split(':').map(Number);
        const start = sH * 60 + sM;
        return start > currentTimeInMins;
      }) : null;
      setNextSchoolLesson(nextLesson || null);

      // 4. Find NEXT study task (Homework or Revision)
      const sortedToday = [...todayTasks].sort((a, b) => {
        const [ah, am] = a.startTime.split(':').map(Number);
        const [bh, bm] = b.startTime.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

      const upcomingToday = sortedToday
        .filter(t => !t.isDone && !t.isMissed && (t.type === 'HOMEWORK' || t.type === 'REVISION'))
        .find(t => {
          const [sH, sM] = t.startTime.split(':').map(Number);
          return (sH * 60 + sM) > currentTimeInMins;
        });
      
      const next = upcomingToday || tomorrowTasks.find(t => t.type === 'HOMEWORK' || t.type === 'REVISION');
      setNextTask(next || null);

      // 5. Calculate timer for current scheduled task
      if (current && !isActive) {
        const [eH, eM] = current.endTime.split(':').map(Number);
        const [sH, sM] = current.startTime.split(':').map(Number);
        const end = new Date(now);
        end.setHours(eH, eM, 0, 0);
        
        let diff = end.getTime() - now.getTime();
        if (diff < 0 && (eH * 60 + eM < sH * 60 + sM)) {
           end.setDate(end.getDate() + 1);
           diff = end.getTime() - now.getTime();
        }

        if (diff > 0) {
          setLocalTimeLeft({
            h: Math.floor(diff / (1000 * 60 * 60)),
            m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            s: Math.floor((diff % (1000 * 60)) / 1000)
          });
        }
      }

      // 6. Calculate timer for active school lesson
      if (activeLesson) {
        const [eH, eM] = activeLesson.end.split(':').map(Number);
        const end = new Date(now);
        end.setHours(eH, eM, 0, 0);
        const diff = end.getTime() - now.getTime();
        if (diff > 0) {
          setSchoolTimeLeft({
            h: Math.floor(diff / (1000 * 60 * 60)),
            m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            s: Math.floor((diff % (1000 * 60)) / 1000)
          });
        }
      }

      // 7. If in school break, calculate time until next lesson
      if (!activeLesson && nextLesson) {
        const [sH, sM] = nextLesson.start.split(':').map(Number);
        const start = new Date(now);
        start.setHours(sH, sM, 0, 0);
        const diff = start.getTime() - now.getTime();
        if (diff > 0) {
          setSchoolTimeLeft({
            h: Math.floor(diff / (1000 * 60 * 60)),
            m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            s: Math.floor((diff % (1000 * 60)) / 1000)
          });
        }
      }

      // 8. Calculate timer for break (until next study task)
      if (!current && !isActive && next && !activeLesson && !nextLesson) {
        const [sH, sM] = next.startTime.split(':').map(Number);
        const isToday = todayTasks.some(t => t.id === next.id);
        const targetDate = isToday ? new Date(now) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
        targetDate.setHours(sH, sM, 0, 0);
        const diff = targetDate.getTime() - now.getTime();
        if (diff > 0) {
          setBreakTimeLeft({
            h: Math.floor(diff / (1000 * 60 * 60)),
            m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            s: Math.floor((diff % (1000 * 60)) / 1000)
          });
        }
      }
    };

    updateTaskAndTimer();
    const interval = setInterval(updateTaskAndTimer, 1000);
    return () => clearInterval(interval);
  }, [searchPool, todayTasks, tomorrowTasks, isActive, isTimetableSynced]);

  const isActuallyRunning = !!activeTask && step === 'FOCUS';

  const hudState = isActuallyRunning
    ? (isPaused ? 'paused' : 'studying')
    : activeSchoolLesson ? 'school'
    : currentScheduledTask ? 'scheduled'
    : nextSchoolLesson ? 'schoolBreak'
    : 'break';

  const hudLabel = {
    studying: isActuallyRunning ? `Studying: ${activeTask.subject}` : '',
    paused: isActuallyRunning ? `Paused: ${activeTask.subject}` : '',
    school: activeSchoolLesson ? `School Session: ${activeSchoolLesson.subject}` : '',
    scheduled: currentScheduledTask ? `Scheduled: ${currentScheduledTask.subject}` : '',
    schoolBreak: nextSchoolLesson ? `Next School Lesson: ${nextSchoolLesson.subject}` : '',
    break: 'Self-Guided Mode',
  }[hudState];

  const renderCardContent = () => {
    // 1. HIGHEST PRIORITY: MANUALLY STARTED FOCUS SESSION
    if (isActuallyRunning) {
      const displayTime = contextTime;
      return (
        <motion.div key="running-session" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full">
          <Card className={cn(
            "relative overflow-hidden border-none transition-all duration-500 rounded-[40px] p-8 md:p-10 shadow-2xl",
            isPaused ? "bg-amber-500 shadow-amber-500/20" : "bg-primary shadow-primary/20"
          )}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
               <div className="space-y-6 flex-1 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        {isPaused ? 'SESSION PAUSED' : 'SESSION ACTIVE'}
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{activeTask.startTime} — {activeTask.endTime}</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter leading-[0.9]">
                        {activeTask.subject}
                     </h2>
                     <p className="text-white/80 text-lg font-medium max-w-xl">
                        Your focus session is in progress. Every minute counts towards your mastery.
                     </p>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-8 min-w-[300px]">
                  <div className="flex flex-col items-center gap-6">
                     <div className={cn("flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white", isPaused ? "opacity-60" : "opacity-100")}>
                        <span className="text-7xl md:text-8xl">
                           {displayTime.h > 0 && `${displayTime.h.toString().padStart(2, '0')}:`}
                           {displayTime.m.toString().padStart(2, '0')}
                        </span>
                        <span className="text-4xl md:text-5xl opacity-40 mx-1">:</span>
                        <span className="text-4xl md:text-5xl opacity-60">{displayTime.s.toString().padStart(2, '0')}</span>
                     </div>
                     <div className="flex items-center gap-3 w-full">
                        <Link href={`/focus/${activeTask.id}`} className="flex-1">
                            <Button className="w-full h-16 rounded-3xl font-black text-xl gap-3 bg-white text-black hover:bg-white/90 shadow-2xl">
                               RESUME SESSION <Zap className="w-5 h-5 fill-current" />
                            </Button>
                        </Link>
                        <Button 
                          onClick={resetFocus}
                          className="h-16 px-6 rounded-3xl font-black text-xs uppercase tracking-widest bg-white/10 text-white border border-white/20 hover:bg-destructive hover:text-white transition-all shadow-xl"
                        >
                           CANCEL
                        </Button>
                     </div>
                  </div>
               </div>
            </div>
          </Card>
        </motion.div>
      );
    }

    // 2. SECOND PRIORITY: SCHOOL LESSON (DURING SCHOOL HOURS)
    if (activeSchoolLesson) {
      return (
        <motion.div key="school-lesson" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
          <Card className="relative overflow-hidden border-none rounded-[40px] p-8 md:p-10 shadow-2xl bg-blue-600 shadow-blue-600/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
               <div className="space-y-6 flex-1 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        SCHOOL IN SESSION
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{activeSchoolLesson.start} — {activeSchoolLesson.end}</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter leading-[0.9]">
                        {activeSchoolLesson.subject}
                     </h2>
                     <p className="text-white/80 text-lg font-medium max-w-xl">
                        You are currently in a school session. Stay focused and take good notes!
                     </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-5 py-3 rounded-2xl w-fit backdrop-blur-md">
                     <School className="w-5 h-5 text-white" />
                     <span className="font-black text-sm uppercase tracking-widest">School Timetable Sync Active</span>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-4 min-w-[300px]">
                  <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Session Ends In</div>
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-7xl md:text-8xl">
                        {schoolTimeLeft.h > 0 && `${schoolTimeLeft.h.toString().padStart(2, '0')}:`}
                        {schoolTimeLeft.m.toString().padStart(2, '0')}
                     </span>
                     <span className="text-4xl md:text-5xl opacity-40 mx-1">:</span>
                     <span className="text-4xl md:text-5xl opacity-60">{schoolTimeLeft.s.toString().padStart(2, '0')}</span>
                  </div>
                  <Link href="/school" className="w-full mt-4">
                    <Button className="w-full h-14 rounded-2xl bg-white text-blue-600 hover:bg-white/90 font-black tracking-widest text-xs uppercase gap-2">
                       VIEW FULL TIMETABLE <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
               </div>
            </div>
          </Card>
        </motion.div>
      );
    }

    // 3. THIRD PRIORITY: SCHEDULED STUDY TASK
    if (currentScheduledTask) {
      const displayTime = localTimeLeft;
      return (
        <motion.div key="scheduled-task" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full">
          <Card className="relative overflow-hidden border-none transition-all duration-500 rounded-[40px] p-8 md:p-10 shadow-2xl bg-orange-500 shadow-orange-500/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
               <div className="space-y-6 flex-1 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        SCHEDULED NOW
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{currentScheduledTask.startTime} — {currentScheduledTask.endTime}</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter leading-[0.9]">
                        {currentScheduledTask.subject}
                     </h2>
                     <p className="text-white/80 text-lg font-medium max-w-xl">
                        It's time for your scheduled session. Dive in and crush your goals!
                     </p>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-8 min-w-[300px]">
                  <div className="flex flex-col items-center gap-6">
                     <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white opacity-90">
                        <span className="text-7xl md:text-8xl">
                           {displayTime.h > 0 && `${displayTime.h.toString().padStart(2, '0')}:`}
                           {displayTime.m.toString().padStart(2, '0')}
                        </span>
                        <span className="text-4xl md:text-5xl opacity-40 mx-1">:</span>
                        <span className="text-4xl md:text-5xl opacity-60">{displayTime.s.toString().padStart(2, '0')}</span>
                     </div>
                     <Link href={`/focus/${currentScheduledTask.id}`} className="w-full">
                        <Button className="w-full h-16 rounded-3xl font-black text-xl gap-4 bg-white text-orange-600 hover:bg-white/90 shadow-2xl group transition-all">
                           START FOCUSING <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
                        </Button>
                     </Link>
                  </div>
               </div>
            </div>
          </Card>
        </motion.div>
      );
    }

    // 4. FOURTH PRIORITY: SCHOOL BREAK
    if (nextSchoolLesson) {
      return (
        <motion.div key="school-break" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
          <Card className="relative overflow-hidden border-none rounded-[40px] p-8 md:p-10 shadow-2xl bg-indigo-500 shadow-indigo-500/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
               <div className="space-y-6 flex-1 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        SCHOOL BREAK
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Next: {nextSchoolLesson.start}</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter leading-[0.9]">
                        Time to Recharge
                     </h2>
                     <p className="text-white/80 text-lg font-medium max-w-xl">
                        Your next lesson "{nextSchoolLesson.subject}" starts soon. Use this time to prepare.
                     </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-5 py-3 rounded-2xl w-fit backdrop-blur-md">
                     <Zap className="w-5 h-5 text-white animate-pulse" />
                     <span className="font-black text-sm uppercase tracking-widest">Upcoming: {nextSchoolLesson.subject}</span>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-4 min-w-[300px]">
                  <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Next Lesson In</div>
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-7xl md:text-8xl">
                        {schoolTimeLeft.h > 0 && `${schoolTimeLeft.h.toString().padStart(2, '0')}:`}
                        {schoolTimeLeft.m.toString().padStart(2, '0')}
                     </span>
                     <span className="text-4xl md:text-5xl opacity-40 mx-1">:</span>
                     <span className="text-4xl md:text-5xl opacity-60">{schoolTimeLeft.s.toString().padStart(2, '0')}</span>
                  </div>
                  <Link href="/school" className="w-full mt-4">
                    <Button className="w-full h-14 rounded-2xl bg-white text-indigo-600 hover:bg-white/90 font-black tracking-widest text-xs uppercase gap-2">
                       VIEW FULL TIMETABLE <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
               </div>
            </div>
          </Card>
        </motion.div>
      );
    }

    // 5. FINAL FALLBACK: BREAK CARD
    return (
      <motion.div key="fallback-break" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
        <Card className="relative overflow-hidden border-none bg-emerald-500 rounded-[40px] p-8 md:p-10 shadow-2xl shadow-emerald-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
             <div className="space-y-6 flex-1 text-white">
                <div className="flex items-center gap-3">
                   <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                      CURRENT STATUS: BREAK
                   </div>
                   <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                   <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Recharging...</span>
                   </div>
                </div>
                <div className="space-y-3">
                   <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter leading-[0.9]">
                      Time for a Break!
                   </h2>
                   <p className="text-white/80 text-lg font-medium max-w-xl">
                      Take a moment to relax. You've been working hard! Stretch, hydrate, and get ready for your next session.
                   </p>
                </div>
                {nextTask && (
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-5 py-3 rounded-2xl w-fit backdrop-blur-md">
                     <Target className="w-5 h-5 text-white animate-pulse" />
                     <span className="font-black text-sm uppercase tracking-widest">
                       Next Up: {nextTask.subject} ({nextTask.type})
                     </span>
                  </div>
                )}
             </div>
             <div className="flex flex-col items-center gap-4 min-w-[300px]">
                <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Next Session In</div>
                <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                   <span className="text-7xl md:text-8xl">
                      {breakTimeLeft.h > 0 && `${breakTimeLeft.h.toString().padStart(2, '0')}:`}
                      {breakTimeLeft.m.toString().padStart(2, '0')}
                   </span>
                   <span className="text-4xl md:text-5xl opacity-40 mx-1">:</span>
                   <span className="text-4xl md:text-5xl opacity-60">{breakTimeLeft.s.toString().padStart(2, '0')}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-white/60 font-bold text-sm bg-black/10 px-4 py-2 rounded-full border border-white/5">
                   <Flame className="w-4 h-4 text-orange-400" /> Keep that momentum going!
                </div>
             </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Sync Control Header / HUD */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/40 px-5 py-3 rounded-[20px] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            hudState === 'studying' ? "bg-primary/10 text-primary" :
            hudState === 'paused' ? "bg-amber-500/10 text-amber-600" :
            hudState === 'school' ? "bg-blue-600/10 text-blue-600" :
            hudState === 'scheduled' ? "bg-orange-500/10 text-orange-600" :
            hudState === 'schoolBreak' ? "bg-indigo-500/10 text-indigo-600" :
            "bg-emerald-500/10 text-emerald-600"
          )}>
            <School className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  hudState === 'studying' ? "bg-primary" :
                  hudState === 'paused' ? "bg-amber-500" :
                  hudState === 'school' ? "bg-blue-600" :
                  hudState === 'scheduled' ? "bg-orange-500" :
                  hudState === 'schoolBreak' ? "bg-indigo-500" :
                  "bg-emerald-500"
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-1.5 w-1.5",
                  hudState === 'studying' ? "bg-primary" :
                  hudState === 'paused' ? "bg-amber-500" :
                  hudState === 'school' ? "bg-blue-600" :
                  hudState === 'scheduled' ? "bg-orange-500" :
                  hudState === 'schoolBreak' ? "bg-indigo-500" :
                  "bg-emerald-500"
                )} />
              </span>
              Dashboard HUD
            </span>
            <span className="block text-xs font-bold text-foreground truncate">
              {hudLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="h-8 w-px bg-border/60" />
          <div className="flex flex-col text-right select-none">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Timetable Sync</span>
            <span className="text-[11px] font-bold text-foreground leading-none">
              {isTimetableSynced ? 'Synced (Active)' : 'Unsynced (Off-School)'}
            </span>
          </div>
          <Switch
            checked={isTimetableSynced}
            onCheckedChange={handleToggleSync}
            aria-label="Toggle Timetable Sync"
          />
        </div>
      </div>

      {/* Card Content */}
      <AnimatePresence mode="wait">
        {renderCardContent()}
      </AnimatePresence>
    </div>
  );
}

