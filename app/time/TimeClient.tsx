'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, CalendarDays, Check, Globe, Play, Timer, X } from 'lucide-react';

import { TaskWithTemplate } from '@/lib/types';
import { cn, getZonedNow, formatTimeZoneLabel, DEFAULT_TIMEZONE } from '@/lib/utils';
import { dayWindow, duration, timeSnapshot, type DayBlock, type PlacedBlock } from '@/lib/time-view';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Panel } from '@/components/ui/panel';

type Clock = { now: Date; minutes: number };

const hhmm = (m: number) => {
  const wrapped = ((Math.floor(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

/**
 * The full-screen clock reached from the header clock: the time where the
 * student lives, the block on now (how far through, how long left), the next
 * one counting down, and today's blocks on one line with a marker for now.
 * Still on purpose: the seconds tick and the marker moves, nothing else.
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
  const [clock, setClock] = useState<Clock | null>(null);
  const tzLabel = formatTimeZoneLabel(timezone);

  useEffect(() => {
    const tick = () => {
      const now = getZonedNow(timezone);
      setClock({ now, minutes: now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  const blocks: DayBlock[] = todayTasks.map((t) => ({
    id: t.id,
    subject: t.subject,
    type: t.type,
    startTime: t.startTime,
    endTime: t.endTime,
    isDone: t.isDone,
    isMissed: t.isMissed,
  }));
  const s = clock ? timeSnapshot(blocks, clock.minutes) : null;

  return (
    <Page className="min-h-[80vh] px-4 md:px-8">
      <div className="flex items-center justify-between gap-3 pt-6">
        <Button variant="ghost" asChild className="gap-1.5">
          <Link href="/">
            <ArrowLeft className="size-4" /> Back to Today
          </Link>
        </Button>
        <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="size-4" /> {tzLabel}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 py-10 md:py-14">
        <h1 className="sr-only">Clock</h1>

        {/* The clock */}
        <div className="text-center" style={{ containerType: 'inline-size' }}>
          <p className="text-sm font-semibold text-muted-foreground sm:text-base">{clock ? format(clock.now, 'EEEE d MMMM yyyy') : ' '}</p>
          <p
            aria-live="off"
            className="mt-2 flex items-baseline justify-center font-heading font-black leading-none tracking-tight text-foreground tabular-nums"
            style={{ fontSize: 'clamp(4.5rem, 22cqw, 13rem)' }}
          >
            <span>{clock ? format(clock.now, 'h') : '--'}</span>
            <span className="mx-[0.04em] -translate-y-[0.06em] font-sans font-extralight text-muted-foreground/40">:</span>
            <span>{clock ? format(clock.now, 'mm') : '--'}</span>
            <span className="ml-[0.12em] flex flex-col items-start gap-[0.1em] text-[0.22em] font-bold">
              <span className="text-muted-foreground tabular-nums">{clock ? format(clock.now, 'ss') : '--'}</span>
              <span className="text-[0.7em] text-muted-foreground/70">{clock ? format(clock.now, 'a') : ''}</span>
            </span>
          </p>
          {s && (
            <p className="mt-5 text-sm text-muted-foreground">
              {s.total === 0
                ? 'Nothing is planned for today.'
                : `${s.done} of ${s.total} blocks done${s.plannedLeft > 0 ? ` · ${duration(s.plannedLeft)} of study left today` : ''}`}
            </p>
          )}
        </div>

        {/* Now and next */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel className={cn('relative overflow-hidden', s?.current && 'border-primary/40')}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className={cn('size-2 rounded-full', s?.current ? 'animate-pulse bg-primary motion-reduce:animate-none' : 'bg-muted-foreground/40')} />
              Now
            </p>
            {s?.current ? (
              <div className="space-y-4">
                <div>
                  <p className="font-heading text-3xl font-bold text-foreground">{s.current.subject}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {s.current.startTime} – {s.current.endTime} · {s.current.type === 'REVISION' ? 'Revision' : 'Homework'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${s.currentProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-medium tabular-nums text-muted-foreground">
                    <span>{Math.floor(s.currentProgress)}% through</span>
                    <span>{duration(s.currentLeft)} left</span>
                  </div>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/focus/${s.current.id}`}>
                    <Timer /> Focus on it
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-heading text-2xl font-bold text-foreground">Free time</p>
                <p className="text-sm text-muted-foreground">No block is on right now.</p>
              </div>
            )}
          </Panel>

          <Panel>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Play className="size-3.5" /> Next
            </p>
            {s?.next ? (
              <div className="space-y-4">
                <div>
                  <p className="font-heading text-3xl font-bold text-foreground">{s.next.subject}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {s.next.startTime} – {s.next.endTime} · {s.next.type === 'REVISION' ? 'Revision' : 'Homework'}
                  </p>
                </div>
                <p className="font-heading text-2xl font-bold tabular-nums text-primary">Starts in {duration(s.untilNext)}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-heading text-2xl font-bold text-foreground">Nothing else today</p>
                <Button variant="outline" asChild className="gap-1.5">
                  <Link href="/timetable">
                    <CalendarDays className="size-4" /> See the week
                  </Link>
                </Button>
              </div>
            )}
          </Panel>
        </div>

        {s && clock && s.total > 0 && <DayLine placed={s.placed} now={clock.minutes} />}
      </div>
    </Page>
  );
}

const STATE_STYLE: Record<PlacedBlock['state'], string> = {
  done: 'bg-success/80 text-white',
  missed: 'bg-destructive/70 text-white',
  past: 'bg-muted-foreground/30 text-foreground',
  now: 'bg-primary text-primary-foreground ring-2 ring-primary/30',
  later: 'bg-primary/15 text-foreground',
};

/** Today on one line: each block where it falls, and a marker for now. */
function DayLine({ placed, now }: { placed: PlacedBlock[]; now: number }) {
  const { from, to } = dayWindow(placed, now);
  const pos = (m: number) => `${((Math.min(Math.max(m, from), to) - from) / (to - from)) * 100}%`;
  const hours: number[] = [];
  for (let h = Math.ceil(from / 60) * 60; h <= to; h += 60) hours.push(h);
  const step = hours.length > 12 ? 2 : 1;

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Today</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Legend className="bg-success/80" label="Done" />
          <Legend className="bg-primary" label="Now" />
          <Legend className="bg-primary/15" label="Later" />
          <Legend className="bg-destructive/70" label="Missed" />
        </div>
      </div>

      <div className="relative h-16">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {placed.map((b) => (
          <Link
            key={b.id}
            href={`/focus/${b.id}`}
            title={`${b.subject} ${b.startTime}–${b.endTime}`}
            className={cn(
              'absolute top-2 flex h-12 items-center overflow-hidden rounded-lg px-2 text-xs font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              STATE_STYLE[b.state]
            )}
            style={{ left: pos(b.start), width: `max(6px, calc(${pos(b.end)} - ${pos(b.start)} - 2px))` }}
          >
            <span className="truncate">{b.subject}</span>
          </Link>
        ))}
        {now >= from && now <= to && (
          <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pos(now) }}>
            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-foreground" />
          </div>
        )}
      </div>
      <div className="relative mt-2 h-4 text-[10px] tabular-nums text-muted-foreground">
        {hours
          .filter((_, i) => i % step === 0)
          .map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(h) }}>
              {hhmm(h)}
            </span>
          ))}
      </div>

      <ol className="mt-6 divide-y divide-border/60 border-t border-border/60">
        {placed.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                b.state === 'done'
                  ? 'bg-success text-white'
                  : b.state === 'missed'
                    ? 'bg-destructive/15 text-destructive'
                    : b.state === 'now'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border'
              )}
            >
              {b.state === 'done' ? <Check className="size-3.5" /> : b.state === 'missed' ? <X className="size-3.5" /> : null}
            </span>
            <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
              {b.startTime} – {b.endTime}
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-sm', b.state === 'now' ? 'font-bold text-foreground' : 'font-medium text-foreground/90')}>
              {b.subject}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {b.state === 'now'
                ? 'On now'
                : b.state === 'later'
                  ? `in ${duration(b.start - now)}`
                  : b.state === 'done'
                    ? 'Done'
                    : b.state === 'missed'
                      ? 'Missed'
                      : 'Not ticked'}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm', className)} /> {label}
    </span>
  );
}
