"use client";

import { useState, useEffect, useMemo } from 'react';
import { Zap, ArrowRight, Clock, School, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { TaskWithTemplate } from '@/lib/types';
import { cn, getRwandaTime } from '@/lib/utils';
import { useFocus } from '@/lib/FocusContext';
import { useTimetableSync } from '@/components/useTimetableSync';
import { motion, AnimatePresence } from 'framer-motion';
import {
  lessonAt,
  nextLessonAfter,
  schoolDayBounds,
  type SchoolLesson,
} from '@/lib/school';

/** "HH:MM" as minutes past midnight, for ordering blocks within a day. */
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * School subject names run long ("Maintain Professional Conversation in Upper
 * Technical English"). At the hero size the other states use, a name that long
 * wrapped to two lines and ran across into the countdown column. Step the size
 * down as the name grows so it keeps the family's look without crowding what
 * sits beside it.
 */
const headlineSize = (text: string) =>
  text.length > 34
    ? 'text-xl md:text-2xl'
    : text.length > 20
      ? 'text-2xl md:text-3xl'
      : 'text-3xl md:text-4xl';

/**
 * Every state renders into this one slot, one after another, so they share a
 * shell AND a footprint. Without the min-height the page jumped ~70px the
 * moment school ended and the break card took over, and a card with a chip sat
 * visibly taller than one without.
 */
const CARD_SHELL =
  'relative overflow-hidden border-none rounded-[32px] p-5 md:p-7 shadow-2xl lg:min-h-[19rem]';

/** The content row inside the shell, grown so the footer stays at the bottom. */
const CARD_ROW =
  'relative z-10 flex flex-1 flex-col lg:flex-row lg:items-center justify-between gap-5';

export function LiveFocusCard({ 
  todayTasks,
  tomorrowTasks = [],
  yesterdayTasks = [],
  schoolLessons = []
}: { 
  todayTasks: TaskWithTemplate[],
  tomorrowTasks?: TaskWithTemplate[],
  yesterdayTasks?: TaskWithTemplate[],
  /**
   * The user's OWN school day. Empty for an account that has not set one up,
   * and the school states below then never render - which is the point. This
   * used to be a hardcoded array imported from SchoolTimetable, so every user's
   * dashboard announced one particular student's lessons.
   */
  schoolLessons?: SchoolLesson[]
}) {
  const { activeTask, isPaused, step, timeLeft: contextTime, isActive, resetFocus } = useFocus();
  // The same flag the portal's toggle writes. Shared through one hook so the
  // two cannot disagree about what "unset" means.
  const [isTimetableSynced, setIsTimetableSynced] = useTimetableSync();

  const [currentScheduledTask, setCurrentScheduledTask] = useState<TaskWithTemplate | null>(null);
  const [activeSchoolLesson, setActiveSchoolLesson] = useState<SchoolLesson | null>(null);
  const [nextSchoolLesson, setNextSchoolLesson] = useState<SchoolLesson | null>(null);
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

      // 1. Find School Lesson scheduled for RIGHT NOW
      const activeLesson = isTimetableSynced
        ? lessonAt(schoolLessons, now.getDay(), currentTimeInMins)
        : null;
      setActiveSchoolLesson(activeLesson);

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
      const nextLesson = isTimetableSynced
        ? nextLessonAfter(schoolLessons, now.getDay(), currentTimeInMins)
        : null;
      setNextSchoolLesson(nextLesson);

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
      
      // Tomorrow arrives unordered, so take its earliest block rather than
      // whichever one the query happened to return first - the card labels this
      // as "up next", so it has to actually be next.
      const firstTomorrow = [...tomorrowTasks]
        .filter(t => t.type === 'HOMEWORK' || t.type === 'REVISION')
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];
      const next = upcomingToday || firstTomorrow;
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
        const [eH, eM] = activeLesson.endTime.split(':').map(Number);
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
        const [sH, sM] = nextLesson.startTime.split(':').map(Number);
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
  }, [searchPool, todayTasks, tomorrowTasks, isActive, isTimetableSynced, schoolLessons]);

  const isActuallyRunning = !!activeTask && step === 'FOCUS';

  const hudState = isActuallyRunning
    ? (isPaused ? 'paused' : 'studying')
    : activeSchoolLesson ? 'school'
    : currentScheduledTask ? 'scheduled'
    : nextSchoolLesson ? 'schoolBreak'
    : 'break';

  /**
   * The status card owns its controls now: timetable sync on every state, plus
   * the self-guided session starter when nothing is scheduled.
   *
   * These used to live on a separate strip above the card, which repeated the
   * status the card was already showing in much larger type. One card, one
   * status, and the controls that belong to it.
   */
  /**
   * The timetable-sync toggle, sized to sit inline in a card header.
   *
   * It used to live in a footer strip below a divider, next to a session-length
   * slider and a Start button. Those are gone from this card - starting a
   * session belongs on the task itself, not buried under a status readout -
   * which leaves sync as the one control here, so it sits with the status
   * rather than in a bar of its own.
   */
  const syncToggle = (
    <label className="flex shrink-0 cursor-pointer items-center gap-2.5">
      <span className="text-xs font-medium text-white/70">Timetable sync</span>
      <Switch
        checked={isTimetableSynced}
        onCheckedChange={setIsTimetableSynced}
        aria-label="Follow your school timetable"
        className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/25 [&_[data-slot=switch-thumb]]:bg-primary"
      />
    </label>
  );

  const cardControls = (
    <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-3">
      <span className="text-xs font-medium text-white/60">
        {isTimetableSynced ? 'Following your school timetable' : 'School timetable off'}
      </span>
      {syncToggle}
    </div>
  );

  const renderCardContent = () => {
    // 1. HIGHEST PRIORITY: MANUALLY STARTED FOCUS SESSION
    if (isActuallyRunning) {
      const displayTime = contextTime;
      return (
        <motion.div key="running-session" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full">
          <Card className={cn(
            CARD_SHELL, "transition-all duration-500",
            isPaused ? "bg-amber-500 shadow-amber-500/20" : "bg-primary shadow-primary/20"
          )}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className={CARD_ROW}>
               <div className="space-y-4 flex-1 text-white">
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
                  <div className="space-y-2">
                     <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tighter leading-[0.95]">
                        {activeTask.subject}
                     </h2>
                     <p className="text-white/75 text-sm font-medium max-w-xl">
                        Your focus session is in progress. Every minute counts towards your mastery.
                     </p>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-4 min-w-[240px]">
                  <div className="flex flex-col items-center gap-6">
                     <div className={cn("flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white", isPaused ? "opacity-60" : "opacity-100")}>
                        <span className="text-5xl md:text-6xl">
                           {displayTime.h > 0 && `${displayTime.h.toString().padStart(2, '0')}:`}
                           {displayTime.m.toString().padStart(2, '0')}
                        </span>
                        <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
                        <span className="text-2xl md:text-3xl opacity-60">{displayTime.s.toString().padStart(2, '0')}</span>
                     </div>
                     <div className="flex items-center gap-3 w-full">
                        <Link href={`/focus/${activeTask.id}`} className="flex-1">
                            <Button className="w-full h-12 rounded-xl font-black text-base gap-3 bg-white text-black hover:bg-white/90 shadow-2xl">
                               RESUME SESSION <Zap className="w-5 h-5 fill-current" />
                            </Button>
                        </Link>
                        <Button 
                          onClick={resetFocus}
                          className="h-12 px-4 rounded-xl font-black text-xs uppercase tracking-widest bg-white/10 text-white border border-white/20 hover:bg-destructive hover:text-white transition-all shadow-xl"
                        >
                           CANCEL
                        </Button>
                     </div>
                  </div>
               </div>
            </div>
            {cardControls}
          </Card>
        </motion.div>
      );
    }

    // 2. SECOND PRIORITY: SCHOOL LESSON (DURING SCHOOL HOURS)
    //
    // Levi pointed at this state and asked for it to look like the break card
    // below, so the three things that set it apart are gone:
    //
    //   - bg-blue-600 was a second, more saturated blue sitting next to the
    //     app's own blue. Two near-identical blues read as a mistake rather
    //     than as a status colour, so this uses bg-primary like its siblings.
    //   - the "School Timetable Sync Active" chip said exactly what the footer
    //     under it already says, next to the sync toggle itself. The chip slot
    //     now carries what the break card's carries: what comes next.
    //   - the blurb ("Stay focused and take good notes!") told you nothing you
    //     could act on. It now says when the school day releases you.
    if (activeSchoolLesson) {
      const schoolDayEnd = schoolDayBounds(schoolLessons, getRwandaTime().getDay())?.end ?? null;

      return (
        <motion.div key="school-lesson" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
          <Card className={cn(CARD_SHELL, "bg-primary shadow-primary/20")}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className={CARD_ROW}>
               <div className="space-y-4 flex-1 min-w-0 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        SCHOOL IN SESSION
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{activeSchoolLesson.startTime} — {activeSchoolLesson.endTime}</span>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <h2 className={cn(
                       "font-heading font-black tracking-tighter leading-[0.95] text-balance max-w-2xl",
                       headlineSize(activeSchoolLesson.subject)
                     )}>
                        {activeSchoolLesson.subject}
                     </h2>
                     <p className="text-white/75 text-sm font-medium max-w-xl">
                        {schoolDayEnd
                          ? `You are in class right now. Your own study blocks pick up once the school day ends at ${schoolDayEnd}.`
                          : 'You are in class right now. Your own study blocks pick up once the school day ends.'}
                     </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl w-fit max-w-xl backdrop-blur-md">
                     <School className="w-4 h-4 shrink-0 text-white" />
                     <span className="truncate font-black text-xs uppercase tracking-widest">
                        {nextSchoolLesson
                          ? `Then ${nextSchoolLesson.subject} at ${nextSchoolLesson.startTime}`
                          : 'Last lesson of the school day'}
                     </span>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-3 min-w-[240px]">
                  <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Session Ends In</div>
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-5xl md:text-6xl">
                        {schoolTimeLeft.h > 0 && `${schoolTimeLeft.h.toString().padStart(2, '0')}:`}
                        {schoolTimeLeft.m.toString().padStart(2, '0')}
                     </span>
                     <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
                     <span className="text-2xl md:text-3xl opacity-60">{schoolTimeLeft.s.toString().padStart(2, '0')}</span>
                  </div>
                  <Link href="/school-timetable" className="w-full mt-4">
                    <Button className="w-full h-12 rounded-xl bg-white text-primary hover:bg-white/90 font-black tracking-widest text-xs uppercase gap-2">
                       VIEW FULL TIMETABLE <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
               </div>
            </div>
            {cardControls}
          </Card>
        </motion.div>
      );
    }

    // 3. THIRD PRIORITY: SCHEDULED STUDY TASK
    if (currentScheduledTask) {
      const displayTime = localTimeLeft;
      return (
        <motion.div key="scheduled-task" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full">
          <Card className={cn(CARD_SHELL, "transition-all duration-500 bg-orange-500 shadow-orange-500/20")}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className={CARD_ROW}>
               <div className="space-y-4 flex-1 text-white">
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
                  <div className="space-y-2">
                     <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tighter leading-[0.95]">
                        {currentScheduledTask.subject}
                     </h2>
                     <p className="text-white/75 text-sm font-medium max-w-xl">
                        It's time for your scheduled session. Dive in and crush your goals!
                     </p>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-4 min-w-[240px]">
                  <div className="flex flex-col items-center gap-6">
                     <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white opacity-90">
                        <span className="text-5xl md:text-6xl">
                           {displayTime.h > 0 && `${displayTime.h.toString().padStart(2, '0')}:`}
                           {displayTime.m.toString().padStart(2, '0')}
                        </span>
                        <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
                        <span className="text-2xl md:text-3xl opacity-60">{displayTime.s.toString().padStart(2, '0')}</span>
                     </div>
                     <Link href={`/focus/${currentScheduledTask.id}`} className="w-full">
                        <Button className="w-full h-12 rounded-xl font-black text-base gap-4 bg-white text-orange-600 hover:bg-white/90 shadow-2xl group transition-all">
                           START FOCUSING <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
                        </Button>
                     </Link>
                  </div>
               </div>
            </div>
            {cardControls}
          </Card>
        </motion.div>
      );
    }

    // 4. FOURTH PRIORITY: SCHOOL BREAK
    //
    // The other half of the timetable-sync pair, recoloured with it - on its
    // own, bg-indigo-500 was a third blue in a row of blue cards.
    if (nextSchoolLesson) {
      return (
        <motion.div key="school-break" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
          <Card className={cn(CARD_SHELL, "bg-primary shadow-primary/20")}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            <div className={CARD_ROW}>
               <div className="space-y-4 flex-1 min-w-0 text-white">
                  <div className="flex items-center gap-3">
                     <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                        SCHOOL BREAK
                     </div>
                     <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                     <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Next: {nextSchoolLesson.startTime}</span>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tighter leading-[0.95]">
                        Time to Recharge
                     </h2>
                     <p className="text-white/75 text-sm font-medium max-w-xl">
                        Your next lesson "{nextSchoolLesson.subject}" starts soon. Use this time to prepare.
                     </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl w-fit max-w-xl backdrop-blur-md">
                     <Zap className="w-4 h-4 shrink-0 text-white animate-pulse" />
                     <span className="truncate font-black text-xs uppercase tracking-widest">Upcoming: {nextSchoolLesson.subject}</span>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-3 min-w-[240px]">
                  <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Next Lesson In</div>
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-5xl md:text-6xl">
                        {schoolTimeLeft.h > 0 && `${schoolTimeLeft.h.toString().padStart(2, '0')}:`}
                        {schoolTimeLeft.m.toString().padStart(2, '0')}
                     </span>
                     <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
                     <span className="text-2xl md:text-3xl opacity-60">{schoolTimeLeft.s.toString().padStart(2, '0')}</span>
                  </div>
                  <Link href="/school-timetable" className="w-full mt-4">
                    <Button className="w-full h-12 rounded-xl bg-white text-primary hover:bg-white/90 font-black tracking-widest text-xs uppercase gap-2">
                       VIEW FULL TIMETABLE <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
               </div>
            </div>
            {cardControls}
          </Card>
        </motion.div>
      );
    }

    // 5. FINAL FALLBACK: BREAK CARD
    //
    // Built to match its siblings above, on Levi's instruction - he pointed at
    // the school-in-session card and said "this is how i want it to look
    // generally".
    //
    // That is also the whole explanation for why this one state kept reading
    // as broken. An earlier pass rebuilt ONLY the break card against
    // docs/ui-contract.md - rounded-2xl, sentence case, font-semibold, quiet
    // type - while every other state in this same component kept the loud
    // treatment. They render into the same slot one after another, so the
    // restrained one did not read as restrained; it read as unfinished. Same
    // shell, same type scale, same footer as the rest now.
    const hasCountdown =
      nextTask !== null && (breakTimeLeft.h > 0 || breakTimeLeft.m > 0 || breakTimeLeft.s > 0);

    // nextTask falls back to tomorrow's first block (step 4), and this card used
    // to render that exactly like a block an hour away, with nothing saying
    // which day it meant.
    const nextIsToday = nextTask !== null && todayTasks.some((t) => t.id === nextTask.id);

    const doneToday = todayTasks.filter((t) => t.isDone).length;
    const totalToday = todayTasks.length;

    const byStart = [...todayTasks].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
    );
    const dayWindow = byStart.length > 0
      ? `${byStart[0].startTime} — ${byStart[byStart.length - 1].endTime}`
      : null;

    // What follows the next block, for the chip that mirrors the school-break
    // card's "Upcoming: ..." line.
    const afterNext = nextTask && nextIsToday
      ? byStart.find((t) =>
          !t.isDone && !t.isMissed && t.id !== nextTask.id &&
          toMinutes(t.startTime) > toMinutes(nextTask.startTime))
      : undefined;

    const headline = hasCountdown
      ? nextTask!.subject
      : totalToday === 0
        ? 'Nothing scheduled'
        : doneToday === totalToday
          ? 'Everything is done'
          : 'Nothing left today';

    const blurb = hasCountdown
      ? `Up next ${nextIsToday ? 'today' : 'tomorrow'} — ${nextTask!.type === 'REVISION' ? 'revision' : 'homework'}. The time until then is yours.`
      : totalToday === 0
        ? 'Nothing is on your timetable for today or tomorrow. Add a block whenever you are ready.'
        : doneToday === totalToday
          ? 'Every block you planned for today is behind you. Rest up — you earned it.'
          : 'Nothing is left for the rest of today, and tomorrow is clear.';

    const action = hasCountdown
      ? nextIsToday
        ? { href: `/focus/${nextTask!.id}`, label: 'Open the block' }
        : { href: '/calendar', label: "See tomorrow's plan" }
      : { href: '/timetable', label: 'View full timetable' };

    return (
      <motion.div key="fallback-break" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
        <Card className={cn(CARD_SHELL, "bg-primary shadow-primary/20")}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
          <div className={CARD_ROW}>
             <div className="space-y-4 flex-1 text-white">
                <div className="flex items-center gap-3">
                   <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 border border-white/20 backdrop-blur-md text-white">
                      On a break
                   </div>
                   {(hasCountdown || dayWindow) && (
                     <>
                       <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                       <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {hasCountdown
                              ? `${nextTask!.startTime} — ${nextTask!.endTime}`
                              : dayWindow}
                          </span>
                       </div>
                     </>
                   )}
                </div>
                <div className="space-y-2">
                   <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tighter leading-[0.95]">
                      {headline}
                   </h2>
                   <p className="text-white/75 text-sm font-medium max-w-xl">
                      {blurb}
                   </p>
                </div>
                {hasCountdown ? (
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl w-fit backdrop-blur-md">
                     <Zap className="w-4 h-4 shrink-0 text-white" />
                     <span className="font-black text-xs uppercase tracking-widest">
                        {afterNext
                          ? `Then ${afterNext.subject} at ${afterNext.startTime}`
                          : nextIsToday ? 'Last block of the day' : 'First block tomorrow'}
                     </span>
                  </div>
                ) : totalToday > 0 ? (
                  <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl w-fit backdrop-blur-md">
                     <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                     <span className="font-black text-xs uppercase tracking-widest">
                        {doneToday === totalToday
                          ? `All ${totalToday} blocks done`
                          : `${doneToday} of ${totalToday} blocks done`}
                     </span>
                  </div>
                ) : null}
             </div>
             <div className="flex flex-col items-center gap-3 min-w-[240px]">
                <div className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">
                   {hasCountdown ? 'Starts in' : totalToday > 0 ? "Today's progress" : 'Your timetable'}
                </div>
                {hasCountdown ? (
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-5xl md:text-6xl">
                        {breakTimeLeft.h > 0 && `${breakTimeLeft.h.toString().padStart(2, '0')}:`}
                        {breakTimeLeft.m.toString().padStart(2, '0')}
                     </span>
                     <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
                     <span className="text-2xl md:text-3xl opacity-60">{breakTimeLeft.s.toString().padStart(2, '0')}</span>
                  </div>
                ) : totalToday > 0 ? (
                  <div className="flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white">
                     <span className="text-5xl md:text-6xl">{doneToday}</span>
                     <span className="text-2xl md:text-3xl opacity-40 mx-1">/</span>
                     <span className="text-2xl md:text-3xl opacity-60">{totalToday}</span>
                  </div>
                ) : null}
                <Link href={action.href} className="w-full mt-4">
                  <Button className="w-full h-12 rounded-xl bg-white text-primary hover:bg-white/90 font-black tracking-widest text-xs uppercase gap-2">
                     {action.label} <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
             </div>
          </div>
          {cardControls}
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="w-full">
      {/* Card Content */}
      <AnimatePresence mode="wait">
        {renderCardContent()}
      </AnimatePresence>
    </div>
  );
}

