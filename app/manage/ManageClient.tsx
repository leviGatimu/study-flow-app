'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, BookOpen, CalendarDays, Coffee, Layers } from 'lucide-react';

import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { ManageForm } from '@/components/ManageForm';
import { DeleteTemplateButton } from '@/components/DeleteTemplateButton';
import { EditTemplateForm } from '@/components/EditTemplateForm';
import { useIsArchived } from '@/components/ArchiveContext';
import { cn, getZonedNow } from '@/lib/utils';
import { DAY_NAMES, toMinutes } from '@/lib/school';

import { StudyTypeIcon } from '../timetable/study-block';
import {
  WEEK,
  blockMinutes,
  formatMinutes,
  isRevision,
  subjectKey,
  subjectLabel,
  totalMinutes,
  type RoutineBlock,
} from './routine-hours';

/**
 * Study routine: the week as hours. A chart of hours per day (which doubles as
 * the day picker), the picked day as a timeline, and hours per subject - so
 * the page answers "how much am I studying, and where" before it lists blocks.
 */
export function ManageClient({
  initialTemplates,
  subjects,
  timezone,
}: {
  initialTemplates: RoutineBlock[];
  subjects: { id: string; name: string }[];
  /** The user's timezone, so "today" is their day and not the server's. */
  timezone: string;
}) {
  const archived = useIsArchived();
  const [today] = useState(() => getZonedNow(timezone).getDay());

  const byDay = useMemo(() => {
    const map = new Map<number, RoutineBlock[]>(WEEK.map((day) => [day, []]));
    for (const t of initialTemplates) map.get(t.dayOfWeek)?.push(t);
    for (const list of map.values()) {
      list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    }
    return map;
  }, [initialTemplates]);

  // Today, or the next day that has study on it - never a blank day by default.
  const [activeDay, setActiveDay] = useState(() => {
    const from = WEEK.indexOf(today);
    for (let i = 0; i < 7; i++) {
      const day = WEEK[(from + i) % 7];
      if (initialTemplates.some((t) => t.dayOfWeek === day)) return day;
    }
    return today;
  });

  if (initialTemplates.length === 0) {
    return (
      <EmptyState
        icon={<Layers />}
        title="No study routine yet"
        description={
          archived
            ? 'This academic year finished without a study routine recorded.'
            : 'Add the blocks you study every week - "Maths, Thursday 19:00 to 21:30". Each one appears on its weekday in your Week and Month, ready to tick off.'
        }
        action={archived ? undefined : <ManageForm subjects={subjects} variant="outline" />}
        className="py-12"
      />
    );
  }

  return (
    <>
      <WeekChart byDay={byDay} today={today} activeDay={activeDay} onPick={setActiveDay} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <DayPanel
            day={activeDay}
            blocks={byDay.get(activeDay) ?? []}
            isToday={activeDay === today}
            subjects={subjects}
          />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <SubjectHours blocks={initialTemplates} />
        </div>
      </div>
    </>
  );
}

function Swatch({ revision }: { revision?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-3 shrink-0 rounded-sm', revision ? 'bg-orange-500' : 'bg-primary')}
    />
  );
}

/** Hours on each weekday, homework and revision stacked. Each column picks its day. */
function WeekChart({
  byDay,
  today,
  activeDay,
  onPick,
}: {
  byDay: Map<number, RoutineBlock[]>;
  today: number;
  activeDay: number;
  onPick: (day: number) => void;
}) {
  const days = WEEK.map((day) => {
    const blocks = byDay.get(day) ?? [];
    const revision = totalMinutes(blocks.filter(isRevision));
    const homework = totalMinutes(blocks) - revision;
    return { day, homework, revision, total: homework + revision, count: blocks.length };
  });
  const max = Math.max(...days.map((d) => d.total), 1);
  const homeworkTotal = days.reduce((sum, d) => sum + d.homework, 0);
  const revisionTotal = days.reduce((sum, d) => sum + d.revision, 0);

  return (
    <Panel>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-heading font-bold text-lg flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-primary">
          <BarChart3 aria-hidden="true" /> Hours each day
        </h3>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <Swatch /> Homework
            <span className="font-bold tabular-nums text-foreground">{formatMinutes(homeworkTotal)}</span>
          </span>
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <Swatch revision /> Revision
            <span className="font-bold tabular-nums text-foreground">{formatMinutes(revisionTotal)}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-3" role="group" aria-label="Pick a day">
        {days.map(({ day, homework, revision, total, count }) => {
          const selected = day === activeDay;
          const isToday = day === today;
          const summary =
            total === 0
              ? `${DAY_NAMES[day]}: free`
              : `${DAY_NAMES[day]}: ${formatMinutes(total)} - ${[
                  homework && `${formatMinutes(homework)} homework`,
                  revision && `${formatMinutes(revision)} revision`,
                ]
                  .filter(Boolean)
                  .join(', ')}, ${count} ${count === 1 ? 'block' : 'blocks'}`;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              aria-pressed={selected}
              aria-label={summary}
              title={summary}
              className={cn(
                'group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-0.5 pb-2 pt-3 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'font-heading text-[11px] font-bold tabular-nums whitespace-nowrap sm:text-sm',
                  total === 0 ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {total === 0 ? (
                  'Free'
                ) : (
                  <>
                    {/* Seven columns on a phone leave no room for "4h 30m". */}
                    <span className="sm:hidden">{Math.round((total / 60) * 10) / 10}h</span>
                    <span className="hidden sm:inline">{formatMinutes(total)}</span>
                  </>
                )}
              </span>
              <span className="flex h-32 w-full max-w-16 flex-col justify-end gap-0.5 border-b border-border px-1.5 sm:h-44 sm:px-2">
                {revision > 0 && (
                  <span
                    className="w-full rounded-t-[4px] bg-orange-500"
                    style={{ height: `${(revision / max) * 100}%` }}
                  />
                )}
                {homework > 0 && (
                  <span
                    className={cn('w-full bg-primary', revision === 0 && 'rounded-t-[4px]')}
                    style={{ height: `${(homework / max) * 100}%` }}
                  />
                )}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold sm:text-sm',
                  selected || isToday ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {DAY_NAMES[day].slice(0, 3)}
              </span>
              <span
                aria-hidden="true"
                className={cn('-mt-1 size-1.5 rounded-full', isToday ? 'bg-primary' : 'bg-transparent')}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        Tap a day to see its blocks. The dot marks today.
      </p>
    </Panel>
  );
}

/** Other blocks that day which run at the same time as `block`. */
function clashesWith(block: RoutineBlock, all: RoutineBlock[]) {
  const start = toMinutes(block.startTime);
  const end = start + blockMinutes(block.startTime, block.endTime);
  return all.filter((other) => {
    if (other.id === block.id) return false;
    const oStart = toMinutes(other.startTime);
    const oEnd = oStart + blockMinutes(other.startTime, other.endTime);
    return start < oEnd && oStart < end;
  });
}

function DayPanel({
  day,
  blocks,
  isToday,
  subjects,
}: {
  day: number;
  blocks: RoutineBlock[];
  isToday: boolean;
  subjects: { id: string; name: string }[];
}) {
  const archived = useIsArchived();
  const minutes = totalMinutes(blocks);
  const addButton = !archived && (
    <ManageForm subjects={subjects} variant="outline" size="sm" label="Add" defaultDay={day} />
  );

  return (
    <Panel>
      <PanelTitle
        icon={<CalendarDays />}
        action={
          <>
            {isToday && <Pill tone="primary">Today</Pill>}
            {addButton}
          </>
        }
      >
        {DAY_NAMES[day]}
      </PanelTitle>

      {blocks.length === 0 ? (
        <EmptyState
          icon={<Coffee />}
          title={`Nothing on ${DAY_NAMES[day]}`}
          description={archived ? undefined : 'A free day - or one you have not planned yet.'}
        />
      ) : (
        <>
          <p className="-mt-2 mb-5 text-sm font-medium text-muted-foreground">
            <span className="font-bold text-foreground">{formatMinutes(minutes)}</span> of study in{' '}
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}, {blocks[0].startTime} –{' '}
            {blocks[blocks.length - 1].endTime}
          </p>
          <ul className="space-y-2.5">
            {blocks.map((block) => (
              <BlockRow key={block.id} block={block} clashes={clashesWith(block, blocks)} subjects={subjects} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function BlockRow({
  block,
  clashes,
  subjects,
}: {
  block: RoutineBlock;
  clashes: RoutineBlock[];
  subjects: { id: string; name: string }[];
}) {
  const revision = isRevision(block);
  const duration = formatMinutes(blockMinutes(block.startTime, block.endTime));

  return (
    <li className="flex items-center gap-2 sm:gap-4">
      <span className="hidden w-14 shrink-0 text-right font-heading text-base font-bold tabular-nums text-foreground sm:block">
        {block.startTime}
      </span>
      <div className="relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-border/40 bg-muted/40 py-3.5 pl-5 pr-1 transition-colors hover:bg-muted sm:gap-3 sm:pr-2">
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-3 left-0 rounded-full border-l-4',
            revision ? 'border-dashed border-orange-500' : 'border-primary'
          )}
        />
        <div className="min-w-0">
          <p className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words font-bold leading-snug text-foreground sm:truncate">{block.subject}</span>
            <span className="shrink-0 font-heading font-bold tabular-nums text-foreground sm:hidden">{duration}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
            <span
              className={cn(
                'flex items-center gap-1 font-semibold',
                revision ? 'text-orange-600 dark:text-orange-400' : 'text-primary'
              )}
            >
              <StudyTypeIcon type={block.type} className="size-3.5" />
              {revision ? 'Revision' : 'Homework'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {block.startTime} – {block.endTime}
              {toMinutes(block.endTime) <= toMinutes(block.startTime) && ' next day'}
            </span>
            {block.deadlineDay && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="basis-full sm:basis-auto">Due {block.deadlineDay}</span>
              </>
            )}
          </p>
          {clashes.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
              Same time as {clashes.map((c) => c.subject).join(', ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-2 hidden font-heading text-lg font-bold tabular-nums text-foreground sm:inline">
            {duration}
          </span>
          <EditTemplateForm template={block} subjects={subjects} />
          <DeleteTemplateButton id={block.id} />
        </div>
      </div>
    </li>
  );
}

/** Weekly hours per subject, revision counted with its subject. */
function SubjectHours({ blocks }: { blocks: RoutineBlock[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; homework: number; revision: number }>();
    for (const b of blocks) {
      const key = subjectKey(b.subject);
      const row = map.get(key) ?? { key, label: subjectLabel(b.subject), homework: 0, revision: 0 };
      // Prefer the plain name ("Physics") over a revision one for the label.
      if (!isRevision(b)) row.label = subjectLabel(b.subject);
      const mins = blockMinutes(b.startTime, b.endTime);
      if (isRevision(b)) row.revision += mins;
      else row.homework += mins;
      map.set(key, row);
    }
    return [...map.values()]
      .map((r) => ({ ...r, total: r.homework + r.revision }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [blocks]);
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Panel>
      <PanelTitle icon={<BookOpen />}>Hours per subject</PanelTitle>
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-semibold text-foreground">{row.label}</span>
              <span className="shrink-0 font-heading font-bold tabular-nums text-foreground">
                {formatMinutes(row.total)}
              </span>
            </div>
            <div
              className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              {row.homework > 0 && (
                <span className="h-full rounded-full bg-primary" style={{ width: `${(row.homework / max) * 100}%` }} />
              )}
              {row.revision > 0 && (
                <span
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${(row.revision / max) * 100}%` }}
                />
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {[
                row.homework > 0 && `${formatMinutes(row.homework)} homework`,
                row.revision > 0 && `${formatMinutes(row.revision)} revision`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
