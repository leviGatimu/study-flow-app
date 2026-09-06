'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';

import { getTodayTasks } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { getZonedNow, DEFAULT_TIMEZONE } from '@/lib/utils';

/**
 * Desktop notification a few minutes before each study block starts.
 *
 * Deliberately a control in the header rather than something that runs on its
 * own: the previous version popped a "Enable Reminders?" modal on first paint
 * and, because a dismissed browser prompt leaves permission at "default", it
 * re-appeared on every single page load. Permission is now only ever requested
 * from a click, which is also what browsers want - an unprompted request is
 * increasingly auto-denied.
 *
 * It also used to call getTodayTasks() every 30 seconds, i.e. 120 database
 * round trips an hour per open tab, against a database ~165ms away. The task
 * list is now fetched when reminders are switched on and refreshed every ten
 * minutes; the 30-second tick only re-reads what is already in memory.
 */

const STORAGE_KEY = 'study-flow-reminders';
const LEAD_MINUTES = 5;
const TICK_MS = 30_000;
const REFRESH_MS = 10 * 60_000;

type Block = { id: string; subject: string; startTime: string; isDone: boolean; isMissed: boolean };

export function ReminderManager({ timezone }: { timezone?: string | null }) {
  const zone = timezone || DEFAULT_TIMEZONE;

  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState<Block[]>([]);

  // A ref, not state: recording a sent notification must not re-create the
  // interval, which would reset the tick and let a reminder slip through.
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setSupported(true);
    setPermission(Notification.permission);
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Private mode, or storage blocked. Reminders stay off; nothing breaks.
    }
  }, []);

  const active = supported && enabled && permission === 'granted';

  // Load today's blocks while reminders are on, and keep them fresh.
  useEffect(() => {
    if (!active) {
      setTasks([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const today = await getTodayTasks();
        if (!cancelled) setTasks(today);
      } catch {
        // A failed refresh must not kill reminders - the previous list stands
        // and the next refresh tries again.
      }
    };

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  // Fire the reminders, reading only what is already in memory.
  useEffect(() => {
    if (!active || tasks.length === 0) return;

    const check = () => {
      // The user's timezone, not the browser's: someone travelling must not
      // get their blocks announced on the wrong clock.
      const now = getZonedNow(zone);
      const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

      for (const task of tasks) {
        if (task.isDone || task.isMissed || notified.current.has(task.id)) continue;

        const [h, m] = task.startTime.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;

        const minutesUntil = h * 60 + m - minutesNow;
        if (minutesUntil > 0 && minutesUntil <= LEAD_MINUTES) {
          notified.current.add(task.id);
          try {
            new Notification('Study Flow', {
              body: `${task.subject} starts in ${Math.max(1, Math.round(minutesUntil))} minutes. Get your notes ready.`,
              icon: '/favicon.ico',
              tag: `study-flow-${task.id}`,
            });
          } catch {
            // Some browsers throw when constructing a Notification outside a
            // service worker. The task is already marked notified, so a
            // failure here does not turn into a loop.
          }
        }
      }
    };

    check();
    const id = setInterval(check, TICK_MS);
    return () => clearInterval(id);
  }, [active, tasks, zone]);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      try {
        localStorage.setItem(STORAGE_KEY, '0');
      } catch {
        // ignore
      }
      return;
    }

    let result = permission;
    if (permission === 'default') {
      result = await Notification.requestPermission();
      setPermission(result);
    }
    if (result !== 'granted') return; // Blocked: leave the control showing why.

    setEnabled(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, [enabled, permission]);

  if (!supported) return null;

  const blocked = permission === 'denied';
  const label = blocked
    ? 'Reminders are blocked in your browser settings'
    : active
      ? 'Reminders on - turn off'
      : 'Remind me before each study block';

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={blocked ? undefined : toggle}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`[&_svg]:size-[18px] ${blocked ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {blocked ? <BellOff /> : active ? <BellRing className="text-primary" /> : <Bell />}
    </Button>
  );
}
