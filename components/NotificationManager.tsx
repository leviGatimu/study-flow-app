"use client";

import { useEffect, useCallback, useState, useRef } from 'react';
import { useFocus } from '@/lib/FocusContext';
import { TaskWithTemplate } from '@/lib/types';
import { SCHOOL_DATA } from './SchoolTimetable';
import { format } from 'date-fns';
import { playNotificationSound } from '@/lib/sound';

export function NotificationManager({ todayTasks }: { todayTasks: TaskWithTemplate[] }) {
  const { isActive, isPaused, activeTask, step } = useFocus();
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);
  const lastNotifiedSubject = useRef<string | null>(null);

  // Request permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico", 
      });
    }
  }, []);

  // Monitor School Timetable for changes
  useEffect(() => {
    const checkSchoolTimetable = () => {
      if (typeof window !== 'undefined') {
        const storedSync = localStorage.getItem('isTimetableSynced');
        const isSynced = storedSync === null ? true : storedSync === 'true';

        if (!isSynced) {
          // If sync is disabled, do not track school lessons
          lastNotifiedSubject.current = null;
          return;
        }
      }

      const now = new Date();
      const currentTimeStr = format(now, 'HH:mm');
      const currentDayName = format(now, 'EEEE');

      const active = SCHOOL_DATA.find(l => 
        l.day === currentDayName && 
        currentTimeStr >= l.start && 
        currentTimeStr < l.end
      );

      const subjectName = active ? active.subject : "Break";
      
      if (subjectName !== lastNotifiedSubject.current) {
        if (active) {
           sendNotification(
             "School Subject Change 🔔",
             `Your next lesson: ${active.subject} is starting now (${active.start} - ${active.end}).`
           );
        } else if (lastNotifiedSubject.current && lastNotifiedSubject.current !== "Break") {
           sendNotification(
             "Lesson Finished ☕",
             "Time for a break! Check your dashboard for what's next."
           );
        }
        lastNotifiedSubject.current = subjectName;
      }
    };

    const interval = setInterval(checkSchoolTimetable, 30000); // Check every 30 seconds
    checkSchoolTimetable(); // Initial check
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', checkSchoolTimetable);
    }
    
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', checkSchoolTimetable);
      }
    };
  }, [sendNotification]);

  // 1. Schedule "Session Starting" notifications
  useEffect(() => {
    if (Notification.permission !== "granted") return;

    const timeouts: NodeJS.Timeout[] = [];

    todayTasks.forEach(task => {
      if (task.isDone || task.isMissed) return;

      const [h, m] = task.startTime.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(h, m, 0, 0);

      const now = new Date();
      const msUntilStart = startTime.getTime() - now.getTime();

      // If task is in the future (within next 24h)
      if (msUntilStart > 0) {
        // Notify 1 minute before
        const t1 = setTimeout(() => {
          sendNotification(
            "Session Starting Soon! ⏱️",
            `Your ${task.subject} session starts in 1 minute. Get ready!`
          );
        }, msUntilStart - 60000);

        // Notify at start
        const t2 = setTimeout(() => {
          sendNotification(
            "Time to focus! 🚀",
            `Your ${task.subject} session is starting now. Enter Focus Mode!`
          );
        }, msUntilStart);

        timeouts.push(t1, t2);
      }
    });

    return () => timeouts.forEach(t => clearTimeout(t));
  }, [todayTasks, sendNotification]);

  // 2. Periodic encouragement during Focus Mode
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && !isPaused && activeTask) {
      // Send a nudge every 15 minutes
      interval = setInterval(() => {
        const nudges = [
          "Keep pushing! You're doing great. 💪",
          "Focus check! You're making real progress. 🧠",
          "Stay in the zone. Elite mastery awaits! 🏆",
          "One block at a time. You've got this! ✨"
        ];
        const randomNudge = nudges[Math.floor(Math.random() * nudges.length)];
        sendNotification(`Deep Focus: ${activeTask.subject}`, randomNudge);
      }, 15 * 60 * 1000); 
    }

    return () => clearInterval(interval);
  }, [isActive, isPaused, activeTask, sendNotification]);

  // 3. Session Complete notification
  useEffect(() => {
    if (step === 'DONE' && activeTask) {
      sendNotification(
        "Mission Accomplished! 🏆",
        `You finished your ${activeTask.subject} focus session. Great job!`
      );
      
      const soundEnabled = localStorage.getItem('study-flow-sound-enabled') !== 'false';
      if (soundEnabled) {
        const soundType = (localStorage.getItem('study-flow-sound-effect') || 'chime') as any;
        const volumeStr = localStorage.getItem('study-flow-sound-volume') || '0.5';
        const volume = parseFloat(volumeStr);
        playNotificationSound(soundType, volume);
      }
    }
  }, [step, activeTask, sendNotification]);

  return null; // This is a headless logic component
}
