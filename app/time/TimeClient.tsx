'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Globe, Play } from 'lucide-react';

import { TaskWithTemplate } from '@/lib/types';
import { cn, getZonedNow, formatTimeZoneLabel, DEFAULT_TIMEZONE } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * A block's [start, end) in minutes. An end at or before the start ("22:30 -
 * 00:00") runs past midnight, so it is pushed into the next day rather than
 * treated as ending before it began.
 */
function span(task: TaskWithTemplate): [number, number] {
  const start = toMinutes(task.startTime);
  let end = toMinutes(task.endTime);
  if (end <= start) end += 24 * 60;
  return [start, end];
}

type Snapshot = {
  time: string;
  period: string;
  date: string;
  current: TaskWithTemplate | null;
  next: TaskWithTemplate | null;
};

function snapshot(tasks: TaskWithTemplate[], timezone: string): Snapshot {
  const now = getZonedNow(timezone);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = tasks
    .filter((t) => !t.isDone)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const current =
    open.find((t) => {
      const [start, end] = span(t);
      return minutes >= start && minutes < end;
    }) ?? null;
  const next = open.find((t) => !t.isMissed && toMinutes(t.startTime) > minutes) ?? null;

  return {
    time: format(now, 'h:mm:ss'),
    period: format(now, 'a'),
    date: format(now, 'EEEE, d MMMM yyyy'),
    current,
    next,
  };
}

/**
 * The full-screen clock reached from the header clock: the time where the
 * student lives, what they should be doing now, and what comes next.
 * Deliberately still - the seconds tick, nothing else moves.
 */
export function TimeClient({
  todayTasks,
  timezone = DEFAULT_TIMEZONE,
}: {
  todayTasks: TaskWithTemplate[];
  timezone?: string;
}) {
  // Null until mounted: the server cannot know the viewer's current second,
  // and rendering one would mismatch on hydration.
  const [now, setNow] = useState<Snapshot | null>(null);
  const tzLabel = formatTimeZoneLabel(timezone);

  useEffect(() => {
    const tick = () => setNow(snapshot(todayTasks, timezone));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [todayTasks, timezone]);

  return (
    <Page className="min-h-[80vh] px-4 md:px-8">
      <div className="pt-6">
        <Button variant="ghost" asChild className="gap-1.5">
          <Link href="/">
            <ArrowLeft className="size-4" /> Back to Today
          </Link>
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-12 py-12">
        <div className="space-y-4 text-center">
          <h1 className="sr-only">Clock</h1>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Globe className="size-4" /> {tzLabel} time
          </p>
          <p
            className="font-heading text-6xl font-black leading-none tracking-tight text-foreground tabular-nums sm:text-8xl lg:text-9xl"
            aria-live="off"
          >
            {now ? now.time : '--:--:--'}
            <span className="ml-3 text-2xl font-bold text-muted-foreground sm:text-4xl">
              {now?.period}
            </span>
          </p>
          <p className="text-lg font-medium text-muted-foreground sm:text-2xl">
            {now ? now.date : ' '}
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <Panel className={cn(now?.current && 'border-primary/40')}>
            <PanelTitle icon={<Play />}>Now</PanelTitle>
            {now?.current ? (
              <div className="space-y-1">
                <p className="font-heading text-2xl font-bold text-foreground">{now.current.subject}</p>
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground tabular-nums">
                  <Clock className="size-4" /> {now.current.startTime} &ndash; {now.current.endTime}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled right now.</p>
            )}
          </Panel>

          <Panel>
            <PanelTitle icon={<ArrowRight />}>Next</PanelTitle>
            {now?.next ? (
              <div className="space-y-1">
                <p className="font-heading text-2xl font-bold text-foreground">{now.next.subject}</p>
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground tabular-nums">
                  <Clock className="size-4" /> Starts at {now.next.startTime}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Nothing else is scheduled today.</p>
                <Button variant="outline" asChild className="gap-1.5">
                  <Link href="/timetable">
                    <CalendarDays className="size-4" /> See the week
                  </Link>
                </Button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
