'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';

import { clashesWithin } from '@/lib/schedule-clash';
import { entryRange, scheduleDuration, type ScheduleEntry } from '@/lib/schedule-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type BoardDay = {
  key: string;
  /** "Monday". */
  title: string;
  /** Day of the month, when the board shows real dates. */
  dateLabel?: string;
  isToday?: boolean;
  isWeekend?: boolean;
  /** A holiday's name. */
  note?: string;
  summary?: string;
  /** The school day band. */
  context?: ReactNode;
};

const KIND_LABEL: Record<ScheduleEntry['kind'], string> = { school: 'School lesson', homework: 'Homework', revision: 'Revision', break: 'Break' };
const describe = (entry: ScheduleEntry, day?: BoardDay) =>
  `${entry.title}, ${day?.title ?? ''}, ${entry.startTime} to ${entry.endTime}, ${KIND_LABEL[entry.kind]}${entry.state ? `, ${entry.state}` : ''}`;

function BlockCard({ entry, label, clashing, compact, onOpen }: { entry: ScheduleEntry; label: string; clashing: boolean; compact?: boolean; onOpen: (target: HTMLButtonElement) => void }) {
  const revision = entry.kind === 'revision';
  const isBreak = entry.kind === 'break';
  const finished = entry.state === 'done' || entry.state === 'missed';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => onOpen(event.currentTarget)}
      className={cn(
        'flex w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'h-16 justify-center gap-0.5 px-3 py-1.5' : 'h-32 justify-between gap-1.5 p-3',
        isBreak ? 'border-border/60 bg-muted/30 shadow-none' : revision ? 'border-dashed border-orange-500/60' : 'border-primary/50',
        finished && 'border-border/60 bg-card/50 shadow-none',
        entry.state === 'active' && 'ring-2 ring-primary'
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn('font-heading font-bold leading-none tabular-nums', compact ? 'text-sm' : 'text-lg', finished || isBreak ? 'text-muted-foreground' : 'text-foreground')}>{entry.startTime}</span>
        {compact && !entry.state && !clashing && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{scheduleDuration(entry)}</span>}
        {entry.state === 'done' && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check aria-hidden="true" className="size-3" />
          </span>
        )}
        {entry.state === 'missed' && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <X aria-hidden="true" className="size-3" />
          </span>
        )}
        {entry.state === 'active' && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">On now</span>}
        {clashing && entry.state !== 'active' && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground dark:text-warning">
            <TriangleAlert aria-hidden="true" className="size-3" /> Clash
          </span>
        )}
      </span>
      <span className={cn('hyphens-auto break-words text-sm font-semibold leading-snug', compact ? 'line-clamp-1' : 'line-clamp-2', finished || isBreak ? 'text-muted-foreground' : 'text-foreground')}>{entry.title}</span>
      {!compact && <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={cn('truncate font-medium', !finished && (revision ? 'text-orange-600 dark:text-orange-400' : 'text-primary'))}>{KIND_LABEL[entry.kind]}</span>
        <span className="shrink-0 tabular-nums">{scheduleDuration(entry)}</span>
      </span>}
    </button>
  );
}

/**
 * The week as seven full-height columns, each day a stack of equal-size cards
 * in time order. A block's length is written on it rather than drawn as its
 * height, so no card is ever a big empty box. On a phone: one day at a time.
 */
export function WeekBoard({
  label,
  days,
  entries,
  emptyLabel = 'Nothing planned',
  compact = false,
  renderActions,
}: {
  label: string;
  days: BoardDay[];
  entries: ScheduleEntry[];
  emptyLabel?: string;
  /** Shorter cards, for a day with many entries such as a full school day. */
  compact?: boolean;
  renderActions?: (entry: ScheduleEntry) => ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phoneDay, setPhoneDay] = useState(() => days.find((d) => d.isToday)?.key ?? days.find((d) => entries.some((e) => e.day === d.key))?.key ?? days[0]?.key);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const blocksOn = (key: string) => entries.filter((e) => e.day === key).sort((a, b) => entryRange(a).start - entryRange(b).start);
  // Reserved on every day, so the first cards line up across the week.
  const hasBand = days.some((d) => d.context || d.note);
  // Blocks that overlapped before this check existed, or arrived by sync. Shown
  // rather than removed: which one to keep is the student's call.
  const clashes = new Map(
    days.flatMap((d) => [...clashesWithin(blocksOn(d.key).filter((e) => e.state !== 'done' && e.state !== 'missed'))])
  );
  const selected = entries.find((e) => e.id === selectedId);
  const selectedDay = days.find((d) => d.key === selected?.day);
  const open = (entry: ScheduleEntry, target: HTMLButtonElement) => {
    trigger.current = target;
    setSelectedId(entry.id);
  };
  const activePhoneDay = days.find((d) => d.key === phoneDay);
  const phoneEntries = phoneDay ? blocksOn(phoneDay) : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tablet and up: seven columns. */}
      <div className="hidden min-h-0 flex-1 overflow-y-auto md:block" role="region" aria-label={label}>
        <div className="grid min-h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const blocks = blocksOn(day.key);
            return (
              <section key={day.key} aria-label={day.title} className={cn('flex min-w-0 flex-col border-l border-border/40 first:border-l-0', day.isToday && 'bg-primary/[0.05]', day.isWeekend && !day.isToday && 'bg-muted/20')}>
                <header className="sticky top-0 z-10 shrink-0 border-b border-border/40 bg-background px-3 py-2">
                  <div className="flex items-center gap-2">
                    {day.dateLabel && (
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-base font-bold tabular-nums', day.isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                        {day.dateLabel}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className={cn('truncate text-sm font-semibold leading-tight', day.isToday ? 'text-primary' : 'text-foreground')}>{day.title.slice(0, 3)}</p>
                      {day.summary && <p className="truncate text-[11px] leading-tight text-muted-foreground">{day.summary}</p>}
                    </div>
                  </div>
                  {hasBand && (
                    <div className="mt-1.5 h-6">
                      {day.note ? <p className="truncate text-[11px] font-semibold leading-6 text-emerald-600 dark:text-emerald-400">{day.note}</p> : day.context}
                    </div>
                  )}
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {blocks.map((entry) => (
                    <BlockCard key={entry.id} entry={entry} label={describe(entry, day)} clashing={clashes.has(entry.id)} compact={compact} onOpen={(target) => open(entry, target)} />
                  ))}
                  {blocks.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{day.note ? 'Day off' : emptyLabel}</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Phone: one day at a time. */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="grid shrink-0 grid-cols-7 gap-1 border-b border-border/60 p-2" role="group" aria-label="Choose a day">
          {days.map((day) => {
            const active = day.key === phoneDay;
            return (
              <button
                key={day.key}
                type="button"
                aria-pressed={active}
                onClick={() => setPhoneDay(day.key)}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center rounded-lg text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active ? 'bg-primary text-primary-foreground' : day.isToday ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {day.title.slice(0, 3)}
                {day.dateLabel && <span className="font-heading text-sm font-bold tabular-nums">{day.dateLabel}</span>}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {activePhoneDay?.summary && <p className="text-xs text-muted-foreground">{activePhoneDay.summary}</p>}
          {activePhoneDay?.note && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{activePhoneDay.note}</p>}
          {activePhoneDay?.context}
          {phoneEntries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{activePhoneDay?.note ? 'Day off' : emptyLabel}</p>
          ) : (
            phoneEntries.map((entry) => (
              <BlockCard key={entry.id} entry={entry} label={describe(entry, activePhoneDay)} clashing={clashes.has(entry.id)} onOpen={(target) => open(entry, target)} />
            ))
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(next) => !next && setSelectedId(null)}>
        <DialogContent
          className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-4 rounded-none p-6 sm:max-w-md sm:rounded-l-2xl data-open:zoom-in-100 data-open:slide-in-from-right-8 data-closed:zoom-out-100 data-closed:slide-out-to-right-8"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          {selected && (
            <>
              <DialogHeader>
                <p className="text-xs font-semibold text-muted-foreground">{KIND_LABEL[selected.kind]}</p>
                <DialogTitle className="font-heading text-2xl font-bold leading-tight">{selected.title}</DialogTitle>
                <DialogDescription>
                  {selectedDay?.title}
                  {selectedDay?.dateLabel ? ` ${selectedDay.dateLabel}` : ''}
                  {selectedDay?.isToday ? ' · Today' : ''}
                </DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-border/60 border-y border-border/60 text-sm">
                <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Time</dt><dd className="font-medium tabular-nums">{selected.startTime} – {selected.endTime}{entryRange(selected).end >= 1440 && ' (next day)'}</dd></div>
                <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Length</dt><dd className="font-medium">{scheduleDuration(selected)}</dd></div>
                {selected.state && <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{selected.state === 'active' ? 'On now' : selected.state === 'done' ? 'Done' : 'Missed'}</dd></div>}
                {clashes.has(selected.id) && (
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">Clashes with</dt>
                    <dd className="text-right font-medium">{clashes.get(selected.id)?.map((other) => `${other.title} ${other.startTime} – ${other.endTime}`).join(', ')}</dd>
                  </div>
                )}
                {selected.detail && <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Details</dt><dd className="text-right font-medium">{selected.detail}</dd></div>}
              </dl>
              {renderActions && <div className="flex flex-wrap gap-2">{renderActions(selected)}</div>}
              <Button variant="outline" onClick={() => setSelectedId(null)} className="mt-auto">Close</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
