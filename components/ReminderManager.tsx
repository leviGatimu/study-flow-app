'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Bell, BellOff, BellRing, CalendarClock, CheckCircle2, Info, Inbox, TriangleAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { getTodayTasks } from '@/lib/actions';
import { Switch } from '@/components/ui/switch';
import { cn, getZonedNow, DEFAULT_TIMEZONE } from '@/lib/utils';

/**
 * The bell in the header: the notification centre.
 *
 * Click it for a panel with (1) the study-block reminders switch and what is
 * coming up today, and (2) the notifications shown this session, newest first
 * (sonner's own history), so a missed pop-up can be read again. A dot on the
 * bell marks anything new since the panel was last opened, and the bell rings
 * when it arrives.
 *
 * Reminders, unchanged in spirit from before: permission is only ever asked
 * from a click (an unprompted request reappeared on every load and is often
 * auto-denied), today's blocks are fetched when reminders are on and every ten
 * minutes, and a 30-second tick only reads what is already in memory. A
 * reminder now also pops up inside the app, with Open, as well as from Windows.
 */

const STORAGE_KEY = 'study-flow-reminders';
const LEAD_MINUTES = 5;
const TICK_MS = 30_000;
const REFRESH_MS = 10 * 60_000;

type Block = { id: string; subject: string; startTime: string; isDone: boolean; isMissed: boolean };
type Shown = { id: string | number; title: string; description?: string; type: string };

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};
const asClock = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
const ago = (since: number | undefined, now: number) => {
  if (!since) return '';
  const mins = Math.floor((now - since) / 60_000);
  return mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
};
const textOf = (v: unknown): string | undefined => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);

/** What sonner has shown this session, newest first, as plain text rows. */
function readHistory(): Shown[] {
  try {
    return (toast.getHistory() as unknown as Array<Record<string, unknown>>)
      .filter((t) => !t.dismissible || textOf(t.title))
      .map((t) => ({ id: t.id as string | number, title: textOf(t.title) ?? '', description: textOf(t.description), type: textOf(t.type) ?? 'default' }))
      .filter((t) => t.title)
      .reverse();
  } catch {
    return [];
  }
}

const KIND = {
  success: { icon: CheckCircle2, tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, tone: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  warning: { icon: TriangleAlert, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  info: { icon: Info, tone: 'bg-primary/15 text-primary' },
  default: { icon: Bell, tone: 'bg-muted text-muted-foreground' },
} as const;

export function ReminderManager({ timezone }: { timezone?: string | null }) {
  const zone = timezone || DEFAULT_TIMEZONE;
  const router = useRouter();

  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState<Block[]>([]);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Shown[]>([]);
  const [seen, setSeen] = useState(0);
  // How many of the rows were new when the panel was opened, to highlight them.
  const [freshCount, setFreshCount] = useState(0);
  const [ringKey, setRingKey] = useState(0);
  // When each notification first appeared (sonner does not record it).
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(0);

  // A ref, not state: recording a sent reminder must not re-create the
  // interval, which would reset the tick and let a reminder slip through.
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      if (!('Notification' in window)) return;
      setSupported(true);
      setPermission(Notification.permission);
      try {
        setEnabled(localStorage.getItem(STORAGE_KEY) === '1');
      } catch {
        // Private mode, or storage blocked. Reminders stay off; nothing breaks.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const active = supported && enabled && permission === 'granted';

  const load = useCallback(async () => {
    try {
      setTasks(await getTodayTasks());
    } catch {
      // A failed refresh must not kill reminders - the previous list stands.
    }
  }, []);

  // Today's blocks while reminders are on (and when the panel opens).
  useEffect(() => {
    if (!active && !open) return;
    const first = setTimeout(load, 0);
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active, open, load]);

  // Fire the reminders, reading only what is already in memory.
  useEffect(() => {
    if (!active || tasks.length === 0) return;
    const check = () => {
      // The user's timezone, not the browser's.
      const now = getZonedNow(zone);
      const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      for (const task of tasks) {
        if (task.isDone || task.isMissed || notified.current.has(task.id)) continue;
        const start = minutesOf(task.startTime);
        if (start === null) continue;
        const minutesUntil = start - minutesNow;
        if (minutesUntil > 0 && minutesUntil <= LEAD_MINUTES) {
          notified.current.add(task.id);
          const mins = Math.max(1, Math.round(minutesUntil));
          toast.info(`${task.subject} starts in ${mins} minute${mins === 1 ? '' : 's'}`, {
            description: 'Get your notes ready.',
            duration: 15_000,
            action: { label: 'Open', onClick: () => router.push(`/focus/${task.id}`) },
          });
          try {
            new Notification('Study Flow', {
              body: `${task.subject} starts in ${mins} minutes. Get your notes ready.`,
              icon: '/favicon.ico',
              tag: `study-flow-${task.id}`,
            });
          } catch {
            // Some browsers only allow notifications from a service worker. The
            // in-app pop-up above still showed, and the task is marked notified.
          }
        }
      }
    };
    check();
    const id = setInterval(check, TICK_MS);
    return () => clearInterval(id);
  }, [active, tasks, zone, router]);

  // Watch what has been shown, for the panel, the dot and the ring.
  useEffect(() => {
    const stamp = (list: Shown[]) => {
      const t = Date.now();
      setSeenAt((prev) => {
        const missing = list.filter((n) => !(String(n.id) in prev));
        if (missing.length === 0) return prev;
        const next = { ...prev };
        for (const n of missing) next[String(n.id)] = t;
        return next;
      });
      setClock(t);
    };
    let count = readHistory().length;
    const id = setInterval(() => {
      const next = readHistory();
      stamp(next);
      if (next.length > count) setRingKey((k) => k + 1);
      count = next.length;
      setHistory(next);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      try {
        localStorage.setItem(STORAGE_KEY, '0');
      } catch {}
      return;
    }
    let result = permission;
    if (permission === 'default') {
      result = await Notification.requestPermission();
      setPermission(result);
    }
    if (result !== 'granted') return;
    setEnabled(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  }, [enabled, permission]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Everything on screen is listed in the panel, so clear the pop-ups:
      // they would otherwise sit on top of it.
      toast.dismiss();
      const h = readHistory();
      setHistory(h);
      setFreshCount(Math.max(0, h.length - seen));
      setSeen(h.length);
    }
  };

  const unread = Math.max(0, history.length - seen);
  const blocked = permission === 'denied';

  const now = getZonedNow(zone);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const upcoming = tasks
    .filter((t) => !t.isDone && !t.isMissed && (minutesOf(t.startTime) ?? -1) > nowMins)
    .sort((a, b) => (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0))
    .slice(0, 4);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
          title="Notifications"
          className="titlebar-no-drag relative grid size-10 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted"
        >
          <span key={ringKey} className={cn('grid place-items-center', ringKey > 0 && 'bell-ring')}>
            {blocked ? <BellOff className="size-[18px]" /> : active ? <BellRing className="size-[18px] text-primary" /> : <Bell className="size-[18px]" />}
          </span>
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid size-2.5 place-items-center">
              <span className="absolute inset-0 rounded-full bg-red-500 motion-safe:animate-ping opacity-60" />
              <span className="relative size-2.5 rounded-full bg-red-500 ring-2 ring-sidebar" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="notif-panel z-[120] w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-border/60 bg-card/95 text-card-foreground shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <h2 className="font-heading text-lg font-bold">Notifications</h2>
            {history.length > 0 && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{history.length} this session</span>}
          </div>

          {/* Reminders */}
          {supported && (
            <section className="mx-3 rounded-2xl bg-muted/50 p-3.5">
              <div className="flex items-start gap-3">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', active ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground')}>
                  {active ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Study block reminders</p>
                  <p className="text-xs text-muted-foreground">
                    {blocked
                      ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.'
                      : `A heads-up ${LEAD_MINUTES} minutes before each block starts.`}
                  </p>
                </div>
                <Switch checked={active} disabled={blocked} onCheckedChange={() => void toggle()} aria-label="Study block reminders" />
              </div>

              {upcoming.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
                  {upcoming.map((t, i) => {
                    const start = minutesOf(t.startTime) ?? 0;
                    return (
                      <li key={t.id} className="notif-row flex items-center gap-2.5 text-sm" style={{ animationDelay: `${80 + i * 50}ms` }}>
                        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{t.subject}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{t.startTime}</span>
                        {active && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary">at {asClock(start - LEAD_MINUTES)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* This session */}
          <section className="px-3 pb-3 pt-4">
            <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">Recent</p>
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <span className="float-soft grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Inbox className="size-6" />
                </span>
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">Messages from Study Flow show up here, so you can read one you missed.</p>
              </div>
            ) : (
              <ul className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto">
                {history.slice(0, 12).map((n, i) => {
                  const kind = KIND[(n.type in KIND ? n.type : 'default') as keyof typeof KIND];
                  const Icon = kind.icon;
                  const fresh = i < freshCount;
                  return (
                    <li
                      key={`${n.id}-${i}`}
                      className={cn('notif-row flex items-start gap-3 rounded-2xl p-2.5 transition-colors hover:bg-muted/60', fresh && 'bg-primary/[0.06]')}
                      style={{ animationDelay: `${120 + i * 40}ms` }}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', kind.tone)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.description}</p>}
                      </div>
                      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                        <span className="text-[11px] tabular-nums text-muted-foreground">{ago(seenAt[String(n.id)], clock)}</span>
                        {fresh && <span className="size-2 rounded-full bg-primary" aria-label="New" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
