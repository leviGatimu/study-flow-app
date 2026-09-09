"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useFocus } from '@/lib/FocusContext';
import { TaskWithTemplate } from '@/lib/types';
import { lessonAt, minutesOf, type SchoolLesson } from '@/lib/school';
import { getRwandaTime } from '@/lib/utils';
import { playNotificationSound } from '@/lib/sound';

export function NotificationManager({
  todayTasks,
  schoolLessons = [],
}: {
  todayTasks: TaskWithTemplate[];
  /**
   * The user's own lessons. Empty means no school alerts at all - this used to
   * read a hardcoded array, so it would have announced one particular student's
   * lessons to everyone.
   */
  schoolLessons?: SchoolLesson[];
}) {
  const { isActive, isPaused, activeTask, step } = useFocus();
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

      // getRwandaTime, not new Date: the dashboard card decides which lesson is
      // running in the user's configured timezone, and an alert disagreeing
      // with the card on the same screen is worse than no alert.
      const now = getRwandaTime();
      const active = lessonAt(schoolLessons, now.getDay(), minutesOf(now));

      const subjectName = active ? active.subject : "Break";
      
      if (subjectName !== lastNotifiedSubject.current) {
        if (active) {
           sendNotification(
             "School Subject Change 🔔",
             `Your next lesson: ${active.subject} is starting now (${active.startTime} - ${active.endTime}).`
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
  }, [sendNotification, schoolLessons]);

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
