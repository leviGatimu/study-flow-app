'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check, Clock3, Coffee, List, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { entryRange, scheduleDuration, scheduleHour, scheduleLayout, scheduleOffset, type ScheduleEntry } from '@/lib/schedule-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import styles from './ScheduleBoard.module.css';

export type ScheduleDay = {
  key: string;
  title: string;
  dateLabel?: string;
  isToday?: boolean;
  isWeekend?: boolean;
  note?: string;
  summary?: string;
  context?: ReactNode;
};

const KIND = { school: 'School lesson', homework: 'Homework', revision: 'Revision', break: 'Break' };
const TONES = ['sky', 'teal', 'amber', 'indigo', 'rose'];

function toneOf(entry: ScheduleEntry) {
  if (entry.kind === 'break') return 'break';
  if (entry.kind === 'revision') return 'amber';
  if (entry.kind === 'homework') return 'sky';
  const hash = [...entry.title.toLowerCase()].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return TONES[hash % TONES.length];
}

function EntryText({ entry, compact = false }: { entry: ScheduleEntry; compact?: boolean }) {
  return (
    <>
      <span className={styles.entryTime}>
        {entry.kind === 'break' && <Coffee aria-hidden="true" className="size-3.5 shrink-0" />}
        {entry.startTime} – {entry.endTime}{entryRange(entry).end >= 1440 && <span> +1 day</span>}
      </span>
      <span className={cn(styles.entryTitle, entry.state === 'done' && 'line-through')}>
        {entry.title}
      </span>
      {entry.kind !== 'break' && !compact && (
        <span className={styles.entryMeta}>
          {entry.state === 'active' ? 'In progress' : entry.state === 'done' ? <><Check className="size-3" /> Done</> : entry.state === 'missed' ? 'Missed' : entry.kind === 'school' ? scheduleDuration(entry) : KIND[entry.kind]}
        </span>
      )}
    </>
  );
}

export function ScheduleBoard({
  title,
  description,
  days,
  entries,
  emptyLabel = 'Nothing planned',
  nowMinutes,
  schoolWeek = false,
  renderActions,
}: {
  title: string;
  description?: string;
  days: ScheduleDay[];
  entries: ScheduleEntry[];
  emptyLabel?: string;
  nowMinutes?: number;
  schoolWeek?: boolean;
  renderActions?: (entry: ScheduleEntry) => ReactNode;
}) {
  const id = useId();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [showWeekend, setShowWeekend] = useState(() => !schoolWeek || days.some((day) => day.isWeekend && entries.some((entry) => entry.day === day.key)));
  const [activeDay, setActiveDay] = useState(() => days.find((day) => day.isToday)?.key ?? days.find((day) => entries.some((entry) => entry.day === day.key))?.key ?? days[0]?.key);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selected = entries.find((entry) => entry.id === selectedId);
  const selectedDay = days.find((day) => day.key === selected?.day);
  const day = days.find((item) => item.key === activeDay) ?? days[0];
  const dayEntries = useMemo(() => entries.filter((entry) => entry.day === day?.key).sort((a, b) => a.startTime.localeCompare(b.startTime)), [entries, day?.key]);
  const layout = useMemo(() => scheduleLayout(entries), [entries]);
  const rowTemplate = layout.heights.map((height) => `${height}px`).join(' ');
  const totalHeight = layout.heights.reduce((sum, height) => sum + height, 0);
  const visibleDays = showWeekend ? days : days.filter((day) => !day.isWeekend);

  const eventButton = (entry: ScheduleEntry, agenda = false) => (
    <button
      key={entry.id}
      type="button"
      data-tone={toneOf(entry)}
      data-state={entry.state}
      data-kind={entry.kind}
      className={cn(styles.entry, agenda && styles.agendaEntry)}
      aria-label={`${entry.title}, ${days.find((item) => item.key === entry.day)?.title}, ${entry.startTime} to ${entry.endTime}, ${KIND[entry.kind]}${entry.state ? `, ${entry.state}` : ''}`}
      onClick={(event) => { trigger.current = event.currentTarget; setSelectedId(entry.id); }}
    >
      <EntryText entry={entry} />
    </button>
  );

  return (
    <section className={styles.board} aria-labelledby={`${id}-title`}>
      <div className={styles.toolbar}>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description ?? 'Select a block to see its details'}</p>
        </div>
        <div className={styles.toolbarControls}>
        {schoolWeek && <button type="button" className={styles.weekendToggle} aria-pressed={showWeekend} onClick={() => setShowWeekend((value) => !value)}>{showWeekend ? 'Hide weekend' : 'Show weekend'}</button>}
        <div className={styles.viewToggle} role="group" aria-label="Schedule view">
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}><CalendarDays /> Week</button>
          <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}><List /> Day</button>
        </div>
        </div>
      </div>

      <div className={cn(styles.weekView, view === 'day' && styles.hiddenView)}>
        <div className={styles.weekScroller} role="region" aria-label={`${title}, weekly timetable`} tabIndex={0}>
          <div className={styles.weekHeader} style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
            <div className={styles.timeHeading}><Clock3 aria-hidden="true" className="size-4" /><span className="sr-only">Time</span></div>
            {visibleDays.map((item) => (
              <div key={item.key} className={cn(styles.dayHeading, item.isToday && styles.todayHeading)}>
                <button type="button" onClick={() => { setActiveDay(item.key); setView('day'); }} aria-label={`View ${item.title}`}>
                  <span>{schoolWeek && !showWeekend ? item.title : item.title.slice(0, 3)}{item.isToday && <span className={styles.todayDot} aria-label="Today" />}</span>
                  {item.dateLabel && <span className={styles.dateLabel}>{item.dateLabel}</span>}
                </button>
                {item.summary && <span className={styles.daySummary}>{item.summary}</span>}
                {item.note && <span className={styles.holiday}>{item.note}</span>}
                {item.context && <div className={styles.dayContext}>{item.context}</div>}
              </div>
            ))}
          </div>
          {entries.length === 0 ? <p className="px-6 py-16 text-center text-sm text-muted-foreground">No study blocks scheduled for this week</p> : <div className={styles.timeCanvas} style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
            <div className={styles.timeAxis} style={{ height: totalHeight }} aria-hidden="true">
              {layout.points.filter((point) => point % 60 === 0).map((point) => (
                <span key={point} className={styles.hourLabel} style={{ top: scheduleOffset(point, layout.points, layout.heights) }}>{scheduleHour(point)}</span>
              ))}
            </div>
            {visibleDays.map((item) => {
              const groups = layout.groups.filter((group) => group.day === item.key);
              const showNow = item.isToday && nowMinutes !== undefined && nowMinutes >= layout.start && nowMinutes < layout.end;
              return (
                <div key={item.key} className={cn(styles.dayTrack, item.isToday && styles.todayTrack)} style={{ gridTemplateRows: rowTemplate }} aria-label={item.title}>
                  {layout.points.slice(0, -1).map((point, index) => <div aria-hidden="true" key={point} className={cn(styles.gridLine, point % 60 !== 0 && styles.minorLine)} style={{ gridRow: index + 1 }} />)}
                  {groups.map((group) => (
                    <div key={group.entries[0].id} className={styles.eventGroup} style={{ gridRow: `${layout.points.indexOf(group.start) + 1} / ${layout.points.indexOf(group.end) + 1}` }}>
                      {group.entries.length > 1 && <span className={styles.overlapLabel}>Overlapping blocks</span>}
                      {group.entries.map((entry) => eventButton(entry))}
                    </div>
                  ))}
                  {groups.length === 0 && <p className={styles.emptyDay}>{item.note ? 'Day off' : emptyLabel}</p>}
                  {showNow && <div aria-label={`Now ${scheduleHour(nowMinutes)}`} className={styles.nowLine} style={{ top: scheduleOffset(nowMinutes, layout.points, layout.heights) }}><span>{scheduleHour(nowMinutes)}</span></div>}
                </div>
              );
            })}
          </div>}
        </div>
      </div>

      <div className={cn(styles.agendaView, view === 'day' && styles.forceAgenda)}>
        <div className={styles.dayPicker} role="group" aria-label="Choose a day">
          {days.map((item) => <button key={item.key} type="button" aria-pressed={item.key === day?.key} onClick={() => setActiveDay(item.key)}><span>{item.title.slice(0, 3)}</span>{item.dateLabel ? <strong>{item.dateLabel}</strong> : <span className={cn(styles.pickerDot, item.isToday && styles.pickerToday)} />}</button>)}
        </div>
        {day && <div className={styles.agendaBody}>
          <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{day.title}{day.isToday && <span className="ml-2 text-xs font-medium text-primary">Today</span>}</h3>
            <span className="text-xs text-muted-foreground">{day.summary}</span>
          </header>
          {day.note && <p className="mb-4 text-sm text-muted-foreground">{day.note}</p>}
          {day.context && <div className={styles.agendaContext}>{day.context}</div>}
          {dayEntries.length ? <div className={styles.agendaList}>{dayEntries.map((entry) => eventButton(entry, true))}</div> : <p className="py-12 text-center text-sm text-muted-foreground">{day.note ? 'Day off' : emptyLabel}</p>}
        </div>}
      </div>

      <div className={styles.boardFooter}><span><span className={styles.footerDot} /> {entries.filter((entry) => entry.kind !== 'break').length} scheduled blocks</span><span>Times shown in your timezone</span></div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className={cn(styles.details, 'top-0 right-0 left-auto translate-x-0 translate-y-0')} showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
          {selected && <>
            <div className="flex items-center justify-between gap-4">
              <span className={styles.detailKind} data-tone={toneOf(selected)}><span />{KIND[selected.kind]}</span>
              <Button variant="ghost" size="icon" aria-label="Close block details" onClick={() => setSelectedId(null)}><X /></Button>
            </div>
            <DialogHeader>
              <DialogTitle className="mt-4 text-2xl font-semibold leading-tight">{selected.title}</DialogTitle>
              <DialogDescription>{selectedDay?.title}{selectedDay?.dateLabel ? ` · ${selectedDay.dateLabel}` : ''}{selectedDay?.isToday ? ' · Today' : ''}</DialogDescription>
            </DialogHeader>
            <dl className={styles.detailList}>
              <div><dt>Time</dt><dd>{selected.startTime} – {selected.endTime}{entryRange(selected).end >= 1440 && ' (next day)'}</dd></div>
              <div><dt>Duration</dt><dd>{scheduleDuration(selected)}</dd></div>
              {selected.state && <div><dt>Status</dt><dd>{selected.state === 'active' ? 'In progress' : selected.state === 'done' ? 'Done' : 'Missed'}</dd></div>}
              {selected.detail && <div><dt>Details</dt><dd>{selected.detail}</dd></div>}
            </dl>
            {renderActions && <div className={styles.detailActions}>{renderActions(selected)}</div>}
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
