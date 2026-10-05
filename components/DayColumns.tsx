import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The Schedule section's week layout, shared by Week, Study routine and
 * School lessons: Monday to Sunday, each day listing its blocks in time order
 * with the day's total underneath.
 *
 * The number of columns follows the width the schedule ACTUALLY has (a
 * container query), not the window: seven only when each day gets enough room
 * to read a subject name (about 1216px of content - wide laptops and up),
 * otherwise the days wrap into four, three or two columns, and a phone stacks
 * them. Nothing scrolls sideways, so Sunday is never cut off.
 *
 * Deliberately flat: a day is an open column under a thin rule, not a box,
 * and its blocks are light rows - one level of surface, small corners.
 */
export type DayColumn = {
  key: string;
  /** "Monday" */
  title: string;
  /** "5 Oct" - Week shows dates, the recurring timetables do not. */
  subtitle?: string;
  isToday?: boolean;
  /** A line under the heading, e.g. a public holiday. */
  note?: React.ReactNode;
  /** Shown when the day has no items. */
  empty?: string;
  /** Footer, left and right: "3 blocks" · "2h 30m". */
  summary?: { label: string; value: string } | null;
  items: React.ReactNode[];
};

export function DayColumns({ days, label }: { days: DayColumn[]; label: string }) {
  return (
    <div className="@container" role="group" aria-label={label}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-7 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[76rem]:grid-cols-7 @min-[76rem]:gap-x-3">
        {days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`} className="flex min-w-0 flex-col">
            <header
              className={cn(
                'mb-2 flex items-baseline justify-between gap-2 border-t-2 pt-2',
                day.isToday ? 'border-primary' : 'border-border'
              )}
            >
              <h3 id={`day-${day.key}`} className="min-w-0 font-heading text-[15px] font-bold leading-tight text-foreground">
                {day.title}
                {day.subtitle && (
                  <span className="ml-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">{day.subtitle}</span>
                )}
              </h3>
              {day.isToday && <span className="shrink-0 text-xs font-semibold text-primary">Today</span>}
            </header>

            {day.note && <div className="mb-2">{day.note}</div>}

            {day.items.length > 0 ? (
              <ul className="flex flex-col gap-1.5">{day.items}</ul>
            ) : (
              <p className="py-1 text-sm text-muted-foreground">{day.empty ?? 'Free'}</p>
            )}

            {day.summary && (
              <footer className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-border/50 pt-1.5 text-xs">
                <span className="text-muted-foreground">{day.summary.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{day.summary.value}</span>
              </footer>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The kind of block, shown by its left edge only: solid blue for homework,
 * dashed orange for revision (the app-wide convention), grey for school.
 */
export type BlockAccent = 'homework' | 'revision' | 'school' | 'plain';
export type BlockState = 'open' | 'done' | 'missed' | 'active';

const ACCENT: Record<BlockAccent, string> = {
  homework: 'border-solid border-primary',
  revision: 'border-dashed border-orange-500',
  school: 'border-solid border-muted-foreground/40',
  plain: 'border-solid border-border',
};

const STATE: Record<BlockState, string> = {
  open: 'bg-muted/50',
  done: 'bg-success/5',
  missed: 'bg-destructive/5',
  active: 'bg-primary/10',
};

/**
 * One block: the time and any controls on the first line, the subject in full
 * (wrapping at word boundaries, never truncated - it is what you are reading
 * for), then a quiet meta line.
 */
export function DayBlock({
  time,
  title,
  meta,
  actions,
  accent = 'plain',
  state = 'open',
  href,
  srLabel,
  className,
  titleClassName,
}: {
  time: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Controls (edit/delete) on the time line. Stay focusable at all times. */
  actions?: React.ReactNode;
  accent?: BlockAccent;
  state?: BlockState;
  /** Makes the block's text a link (e.g. School -> /school-timetable). */
  href?: string;
  /** What the left edge says visually, for screen readers ("Homework"). */
  srLabel?: string;
  className?: string;
  titleClassName?: string;
}) {
  const timeLine = (
    <span className="flex min-h-5 items-start justify-between gap-1">
      <span className="text-xs leading-5 tabular-nums text-muted-foreground">{time}</span>
      {actions && (
        <span className="-mr-1 -mt-0.5 flex shrink-0 items-center opacity-70 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100 [&_button]:size-7 [&_svg]:size-3.5">
          {actions}
        </span>
      )}
    </span>
  );
  const rest = (
    <>
      <span className={cn('block text-sm font-semibold leading-snug text-foreground [overflow-wrap:break-word]', titleClassName)}>
        {srLabel && <span className="sr-only">{srLabel}: </span>}
        {title}
      </span>
      {meta && <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">{meta}</span>}
    </>
  );

  return (
    <li
      className={cn(
        'group/block min-w-0 rounded-md border-0 border-l-[3px] py-1.5 pl-2.5 pr-1.5',
        state === 'done'
          ? 'border-solid border-success'
          : state === 'missed'
            ? 'border-solid border-destructive'
            : state === 'active'
              ? 'border-solid border-primary'
              : ACCENT[accent],
        STATE[state],
        className
      )}
    >
      {href ? (
        // A linked block has no controls, so the whole block is the link.
        <Link href={href} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {timeLine}
          {rest}
        </Link>
      ) : (
        <>
          {timeLine}
          {rest}
        </>
      )}
    </li>
  );
}

export function formatMinutes(mins: number): string {
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  return `${rem}m`;
}

/** Length of a block in minutes; an end before the start runs past midnight. */
export function blockMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Number.isFinite(mins) ? mins : 0;
}
