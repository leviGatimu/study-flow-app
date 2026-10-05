"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TaskWithTemplate } from '@/lib/types';
import { getRwandaTime } from '@/lib/utils';
import { logFocusSession, toggleTaskDone } from '@/lib/actions';

interface FocusContextType {
  activeTask: TaskWithTemplate | null;
  timeLeft: { h: number; m: number; s: number };
  isActive: boolean;
  isPaused: boolean;
  step: 'PREP' | 'FOCUS' | 'DONE';
  sessionXP: number;
  intensity: 'CHILL' | 'INTENSE';
  endTime: number | null;
  initialDurationMinutes: number;
  secondsFocused: number;
  /**
   * No set length: the session runs until the student ends it. `timeLeft`
   * then counts UP (time focused so far) and nothing completes on its own.
   */
  openEnded: boolean;
  /** Pass null for an open-ended session. */
  startFocus: (task: TaskWithTemplate, durationMinutes: number | null) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  completeFocus: () => void;
  resetFocus: () => void;
  setTimeLeft: (time: { h: number; m: number; s: number }) => void;
  setStep: (step: 'PREP' | 'FOCUS' | 'DONE') => void;
  setIntensity: (intensity: 'CHILL' | 'INTENSE') => void;
  addXp: (amount: number) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTask] = useState<TaskWithTemplate | null>(null);
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [step, setStep] = useState<'PREP' | 'FOCUS' | 'DONE'>('PREP');
  const [sessionXP, setSessionXP] = useState(0);
  const [intensity, setIntensity] = useState<'CHILL' | 'INTENSE'>('CHILL');
  const [endTime, setEndTime] = useState<number | null>(null);
  const [initialDurationMinutes, setInitialDurationMinutes] = useState(0);
  const [secondsFocused, setSecondsFocused] = useState(0);
  const [openEnded, setOpenEnded] = useState(false);
  // Open-ended sessions run from a start instant instead of toward an end
  // one. Null while paused, exactly like endTime.
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Refs mirror state the 1s ticker needs, so the interval effect can keep a
  // minimal dependency list. With objects like activeTask in the deps, every
  // cross-window storage sync produced a new identity and reset the interval
  // before it could ever fire — freezing the timer whenever the Electron
  // widget window was open.
  const activeTaskRef = useRef(activeTask);
  const intensityRef = useRef(intensity);
  const secondsFocusedRef = useRef(secondsFocused);
  const sessionXPRef = useRef(sessionXP);
  useEffect(() => { activeTaskRef.current = activeTask; }, [activeTask]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { secondsFocusedRef.current = secondsFocused; }, [secondsFocused]);
  useEffect(() => { sessionXPRef.current = sessionXP; }, [sessionXP]);

  // Load from localStorage on mount and sync changes in other windows
  useEffect(() => {
    const handleStorageChange = (e?: StorageEvent) => {
      // Other keys (now-playing, objectives, presets…) change frequently;
      // only re-read focus state when the focus key itself changed.
      if (e && e.key && e.key !== 'study-flow-focus') return;
      const saved = localStorage.getItem('study-flow-focus');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          
          if (data.activeTask && data.endTime) {
            const now = getRwandaTime().getTime();
            if (data.endTime < now) {
               // The session finished! Save the XP and focus minutes to the database.
               const actualDurationMinutes = data.initialDurationMinutes || 1;
               const finalXP = data.sessionXP || (actualDurationMinutes * 60 * (data.intensity === 'INTENSE' ? 2 : 1));
               
               logFocusSession(actualDurationMinutes, finalXP).catch(console.error);
               if (data.activeTask.id !== 'free') {
                 toggleTaskDone(data.activeTask.id, true).catch(console.error);
               }

               localStorage.removeItem('study-flow-focus');
               setActiveTask(null);
               setIsActive(false);
               setIsPaused(false);
               setStep('PREP');
               setEndTime(null);
               return;
            }
          }

          setActiveTask(data.activeTask);
          setTimeLeft(data.timeLeft);
          setIsActive(data.isActive);
          setIsPaused(data.isPaused);
          setStep(data.step);
          setSessionXP(data.sessionXP || 0);
          setIntensity(data.intensity);
          setEndTime(data.endTime);
          setInitialDurationMinutes(data.initialDurationMinutes || 0);
          setSecondsFocused(data.secondsFocused || 0);
          setOpenEnded(Boolean(data.openEnded));
          setStartedAt(data.startedAt ?? null);
        } catch (e) {
          console.error("Failed to parse focus session", e);
        }
      } else {
        // Clear state if storage was cleared
        setActiveTask(null);
        setIsActive(false);
        setIsPaused(false);
        setStep('PREP');
        setEndTime(null);
      }
    };

    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save to localStorage whenever state changes.
  // IMPORTANT: both window types must serialize with the SAME key order and
  // skip writes when nothing changed — otherwise the main window and the
  // widget window bounce storage events back and forth forever.
  useEffect(() => {
    const isWidget = typeof window !== 'undefined' && window.location.pathname.includes('/focus/widget');

    const persist = (data: Record<string, unknown>) => {
      const payload = JSON.stringify(data);
      if (localStorage.getItem('study-flow-focus') !== payload) {
        localStorage.setItem('study-flow-focus', payload);
      }
    };

    if (isWidget) {
      if (activeTask) {
        try {
          const currentStorage = JSON.parse(localStorage.getItem('study-flow-focus') || '{}');
          persist({
            activeTask,
            // The widget doesn't increment counters itself — prefer the main
            // window's values from storage so they aren't overwritten.
            timeLeft: currentStorage.timeLeft || timeLeft,
            isActive,
            isPaused,
            step,
            sessionXP: currentStorage.sessionXP || sessionXP,
            intensity,
            endTime,
            initialDurationMinutes,
            secondsFocused: currentStorage.secondsFocused || secondsFocused,
            openEnded,
            startedAt
          });
        } catch (e) {
          // Fallback
        }
      }
      return;
    }

    if (activeTask) {
      persist({
        activeTask,
        timeLeft,
        isActive,
        isPaused,
        step,
        sessionXP,
        intensity,
        endTime,
        initialDurationMinutes,
        secondsFocused,
        openEnded,
        startedAt
      });
    } else {
      localStorage.removeItem('study-flow-focus');
    }
  }, [activeTask, timeLeft, isActive, isPaused, step, sessionXP, intensity, endTime, initialDurationMinutes, secondsFocused, openEnded, startedAt]);

  // Main Ticker. Deps must stay minimal and stable — anything that changes
  // every second (or on every storage sync) here would reset the interval
  // before it can fire. Everything else the tick needs comes through refs.
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && !isPaused && startedAt) {
      // Open-ended: count up from the start, never finish on our own.
      const isWidget = typeof window !== 'undefined' && window.location.pathname.includes('/focus/widget');
      interval = setInterval(() => {
        const totalSeconds = Math.max(0, Math.floor((getRwandaTime().getTime() - startedAt) / 1000));
        setTimeLeft({
          h: Math.floor(totalSeconds / 3600),
          m: Math.floor((totalSeconds % 3600) / 60),
          s: totalSeconds % 60
        });
        if (!isWidget) {
          setSecondsFocused(prev => prev + 1);
          setSessionXP(prev => prev + (intensityRef.current === 'INTENSE' ? 2 : 1));
        }
      }, 1000);
    } else if (isActive && !isPaused && endTime) {
      const isWidget = typeof window !== 'undefined' && window.location.pathname.includes('/focus/widget');

      interval = setInterval(() => {
        const now = getRwandaTime().getTime();
        const diff = endTime - now;

        if (diff <= 0) {
          setTimeLeft({ h: 0, m: 0, s: 0 });
          setIsActive(false);
          setStep('DONE');

          // Only the main window talks to the database — if the widget did
          // too, completion would be double-logged.
          const task = activeTaskRef.current;
          if (task && !isWidget) {
            const actualDurationMinutes = Math.ceil(secondsFocusedRef.current / 60) || 1;
            logFocusSession(actualDurationMinutes, sessionXPRef.current).catch(console.error);
            if (task.id !== 'free') {
              toggleTaskDone(task.id, true).catch(console.error);
            }
          }
        } else {
          const totalSeconds = Math.floor(diff / 1000);
          setTimeLeft({
            h: Math.floor(totalSeconds / 3600),
            m: Math.floor((totalSeconds % 3600) / 60),
            s: totalSeconds % 60
          });

          // Only increment tracking counters if this is the main browser window.
          // The widget window will automatically sync these values from storage.
          if (!isWidget) {
            setSecondsFocused(prev => prev + 1);
            setSessionXP(prev => prev + (intensityRef.current === 'INTENSE' ? 2 : 1));
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, endTime, startedAt]);

  const startFocus = useCallback((task: TaskWithTemplate, durationMinutes: number | null) => {
    const now = getRwandaTime().getTime();

    setActiveTask(task);
    setSecondsFocused(0);
    if (durationMinutes === null) {
      setOpenEnded(true);
      setStartedAt(now);
      setEndTime(null);
      setInitialDurationMinutes(0);
      setTimeLeft({ h: 0, m: 0, s: 0 });
    } else {
      setOpenEnded(false);
      setStartedAt(null);
      setEndTime(now + durationMinutes * 60 * 1000);
      setInitialDurationMinutes(durationMinutes);
      setTimeLeft({
        h: Math.floor(durationMinutes / 60),
        m: durationMinutes % 60,
        s: 0
      });
    }
    setStep('FOCUS');
    setIsActive(true);
    setIsPaused(false);
    setSessionXP(0);
  }, []);

  const pauseFocus = useCallback(() => {
    setIsPaused(true);
    if (openEnded) {
      // timeLeft already holds the time focused so far; keep it.
      setStartedAt(null);
      return;
    }
    if (endTime) {
      const remainingMs = endTime - getRwandaTime().getTime();
      const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeft({
        h: Math.floor(totalSeconds / 3600),
        m: Math.floor((totalSeconds % 3600) / 60),
        s: totalSeconds % 60
      });
    }
    setEndTime(null);
  }, [endTime, openEnded]);

  const resumeFocus = useCallback(() => {
    setIsPaused(false);
    const totalSeconds = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
    if (openEnded) {
      // Carry on counting from where the pause left it.
      setStartedAt(getRwandaTime().getTime() - totalSeconds * 1000);
      return;
    }
    setEndTime(getRwandaTime().getTime() + totalSeconds * 1000);
  }, [timeLeft, openEnded]);

  const completeFocus = useCallback(async () => {
    if (isActive && activeTask) {
      const actualDurationMinutes = Math.ceil(secondsFocused / 60) || 1;
      const xpToGrant = sessionXP;
      try {
        if (activeTask.id !== 'free') {
          await toggleTaskDone(activeTask.id, true);
        }
        await logFocusSession(actualDurationMinutes, xpToGrant);
      } catch (e) {
        console.error("Failed to log focus session:", e);
      }
    }
    setIsActive(false);
    setEndTime(null);
    setStartedAt(null);
    setStep('DONE');
  }, [isActive, activeTask, secondsFocused, sessionXP]);

  const resetFocus = useCallback(() => {
    setActiveTask(null);
    setTimeLeft({ h: 0, m: 0, s: 0 });
    setIsActive(false);
    setIsPaused(false);
    setEndTime(null);
    setStartedAt(null);
    setOpenEnded(false);
    setStep('PREP');
    setSessionXP(0);
  }, []);

  const addXp = useCallback((amount: number) => setSessionXP(prev => prev + amount), []);

  return (
    <FocusContext.Provider value={{
      activeTask,
      timeLeft,
      isActive,
      isPaused,
      step,
      sessionXP,
      intensity,
      endTime,
      initialDurationMinutes,
      secondsFocused,
      openEnded,
      startFocus,
      pauseFocus,
      resumeFocus,
      completeFocus,
      resetFocus,
      setTimeLeft,
      setStep,
      setIntensity,
      addXp
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (context === undefined) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}
