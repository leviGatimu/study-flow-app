'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import Link from 'next/link';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfWeek,
} from 'date-fns';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  PartyPopper,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlockKey, ScheduleFrame } from '@/components/schedule/ScheduleFrame';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { ModeBar, TaskTick } from '@/components/TaskCheckbox';
import { QuickAddForm } from '@/components/QuickAddForm';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { toggleMarkedDay, updateTask, deleteTask } from '@/lib/actions';
import { extendActiveTerm } from '@/lib/term-actions';
import { cn } from '@/lib/utils';
import { subscribeOnMount } from '@/lib/use-client-value';
import {
  StudyTypeIcon,
} from '@/app/timetable/study-block';
import { dayKey, monthHref, parseDayKey, weekHref } from '@/app/timetable/schedule-dates';
import { ClashDialog } from '@/components/schedule/ClashDialog';
import type { ClashInfo, ClashResolution } from '@/lib/schedule-clash';

export type CalendarTask = {
  id: string;
  subject: string;
  type: string;
  startTime: string;
  endTime: string;
  isDone: boolean;
  isMissed: boolean;
  hasProof: boolean;
  dateKey: string;
};

export type CalendarData = {
  tasks: CalendarTask[];
  exams: { id: string; title: string; startTime: string | null; priority: string; dateKey: string }[];
  homework: { id: string; subject: string; title: string; isCompleted: boolean; dateKey: string }[];
  markedDays: string[];
  /** Public holidays in view, date key -> name. The routine is off on these. */
  holidays: Record<string, string>;
  /** The running term of the active year, or null (none, or an archive is open). */
  term: { name: string | null; start: string | null; end: string | null } | null;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function groupByDay<T extends { dateKey: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.dateKey);
    if (list) list.push(item);
    else map.set(item.dateKey, [item]);
  }
  return map;
}

/**
 * The month grid, Monday first like the rest of the Schedule section. The
 * month it shows lives in the URL (?month=yyyy-MM) and is read on the server,
 * so the arrows are links and only that month's rows are ever loaded.
 *
 * Under `sm` the seven-column grid is unreadable, so it becomes a day list.
 */
/** Minutes in a block, wrapping past midnight (22:30 - 00:00 is 90). */
function blockMinutes(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m;
}

const hoursLabel = (minutes: number) => {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// Wide screens show the day beside the grid; narrower ones open it in a dialog.
const WIDE = '(min-width: 1024px)';
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  // The server assumes wide; re-read once mounted so a phone switches to the dialog.
  const stopMount = subscribeOnMount(onChange);
  return () => {
    query.removeEventListener('change', onChange);
    stopMount();
  };
};

export function CalendarGrid({
  monthKey,
  todayKey,
  data,
  subjects,
  actions,
}: {
  monthKey: string;
  todayKey: string;
  data: CalendarData;
  subjects: { id: string; name: string }[];
  /** The toolbar's Add task. */
  actions?: React.ReactNode;
}) {
  const isWide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
  const isCurrentMonth = todayKey.startsWith(monthKey);
  // The panel always shows a day: today in the current month, else the 1st.
  const [selectedKey, setSelectedKey] = useState<string>(isCurrentMonth ? todayKey : `${monthKey}-01`);
  const [dialogOpen, setDialogOpen] = useState(false);

  const month = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [monthKey]);

  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(month, { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month]
  );
  const monthDays = gridDays.filter((d) => isSameMonth(d, month));

  const tasksByDay = useMemo(() => groupByDay(data.tasks), [data.tasks]);
  const examsByDay = useMemo(() => groupByDay(data.exams), [data.exams]);
  const homeworkByDay = useMemo(() => groupByDay(data.homework), [data.homework]);
  const marked = useMemo(() => new Set(data.markedDays), [data.markedDays]);
  const termEndKey = data.term?.end ? dayKey(new Date(data.term.end)) : null;

  const summaryOf = (key: string): DaySummary => {
    const tasks = tasksByDay.get(key) ?? [];
    return {
      tasks,
      exams: examsByDay.get(key) ?? [],
      homework: homeworkByDay.get(key) ?? [],
      hasHomework: tasks.some((t) => t.type !== 'REVISION'),
      hasRevision: tasks.some((t) => t.type === 'REVISION'),
      minutes: tasks.reduce((sum, t) => sum + blockMinutes(t.startTime, t.endTime), 0),
      isMarked: marked.has(key),
      isTermEnd: key === termEndKey,
      isToday: key === todayKey,
      holiday: data.holidays[key] ?? null,
    };
  };

  // Month totals for the header line, counted over this month's days only.
  const totals = monthDays.reduce(
    (acc, d) => {
      const s = summaryOf(dayKey(d));
      acc.blocks += s.tasks.length;
      acc.done += s.tasks.filter((t) => t.isDone).length;
      acc.exams += s.exams.length;
      acc.minutes += s.minutes;
      return acc;
    },
    { blocks: 0, done: 0, exams: 0, minutes: 0 }
  );

  const select = (key: string) => {
    setSelectedKey(key);
    if (!isWide) setDialogOpen(true);
  };

  const selected = summaryOf(selectedKey);

  const meta =
    totals.blocks === 0
      ? 'Nothing planned this month yet.'
      : [
          `${totals.blocks} ${totals.blocks === 1 ? 'block' : 'blocks'}`,
          hoursLabel(totals.minutes) && `${hoursLabel(totals.minutes)} planned`,
          `${totals.done} done`,
          totals.exams > 0 && `${totals.exams} ${totals.exams === 1 ? 'exam' : 'exams'}`,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <ScheduleFrame
      title={format(month, 'MMMM yyyy')}
      meta={meta}
      controls={
        <>
          <Button asChild variant="outline" size="icon-sm" aria-label="Previous month">
            <Link href={monthHref(addMonths(month, -1))}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-label="Next month">
            <Link href={monthHref(addMonths(month, 1))}>
              <ChevronRight />
            </Link>
          </Button>
          {!isCurrentMonth && (
            <Button asChild variant="outline" size="sm">
              <Link href="/calendar">Today</Link>
            </Button>
          )}
        </>
      }
      legend={
        <BlockKey>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-4 rounded-[3px] bg-orange-500" /> Exam
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen aria-hidden="true" className="size-3" /> Due
          </span>
        </BlockKey>
      }
      actions={actions}
    >
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone: a list of the month's days. */}
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto sm:hidden">
            {monthDays.map((date) => {
              const key = dayKey(date);
              const s = summaryOf(key);
              const count = s.tasks.length + s.exams.length + s.homework.length;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => select(key)}
                    className={cn(
                      'flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                      s.isToday && 'bg-primary/5'
                    )}
                  >
                    <DayNumber date={date} isToday={s.isToday} isMarked={s.isMarked} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{format(date, 'EEEE')}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <DayDots summary={s} />
                        {count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Nothing planned'}
                        {s.isTermEnd && <Pill tone="warning">Term ends</Pill>}
                        {s.holiday && <Pill tone="success">{s.holiday}</Pill>}
                      </span>
                    </span>
                    {hoursLabel(s.minutes) && (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">{hoursLabel(s.minutes)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Tablet and up: one edge-to-edge sheet that fills the screen. */}
          <div className="hidden min-h-0 flex-1 flex-col sm:flex">
            <div className="grid shrink-0 grid-cols-7 border-b border-border/60">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={cn('border-l border-border/40 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground first:border-l-0', i >= 5 && 'bg-muted/20')}>
                  {d}
                </div>
              ))}
            </div>
            <div
              className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto"
              style={{ gridTemplateRows: `repeat(${gridDays.length / 7}, minmax(6.5rem, 1fr))` }}
              role="grid"
              aria-label={format(month, 'MMMM yyyy')}
            >
              {gridDays.map((date, index) => {
                const key = dayKey(date);
                const s = summaryOf(key);
                const inMonth = isSameMonth(date, month);
                const isSelected = key === selectedKey;
                const weekend = index % 7 >= 5;
                const chips = [
                  ...s.exams.map((e) => ({ id: e.id, kind: 'exam' as const, text: e.title })),
                  ...s.tasks.map((t) => ({ id: t.id, kind: 'task' as const, text: t.subject, task: t })),
                ];
                const shown = chips.slice(0, 3);
                const hidden = chips.length - shown.length;
                const count = s.tasks.length + s.exams.length + s.homework.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => select(key)}
                    aria-pressed={isSelected}
                    aria-label={`${format(date, 'EEEE d MMMM')}${s.holiday ? `, ${s.holiday}` : ''}, ${count} ${count === 1 ? 'item' : 'items'}`}
                    className={cn(
                      'flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden border-b border-l border-border/40 p-1.5 text-left transition-colors [&:nth-child(7n+1)]:border-l-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60',
                      inMonth ? 'hover:bg-muted/40' : 'bg-muted/10 opacity-50 hover:opacity-90',
                      weekend && inMonth && 'bg-muted/20',
                      s.isToday && 'bg-primary/[0.07]',
                      isSelected && 'ring-2 ring-inset ring-primary'
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <DayNumber date={date} isToday={s.isToday} isMarked={s.isMarked} muted={!inMonth} />
                      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {s.homework.length > 0 && (
                          <span className="hidden items-center gap-0.5 md:flex" title={`${s.homework.length} homework due`}>
                            <BookOpen aria-hidden="true" className="size-3" /> {s.homework.length}
                          </span>
                        )}
                        {hoursLabel(s.minutes)}
                      </span>
                    </span>
                    {s.isTermEnd && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                        <Flag aria-hidden="true" className="size-3" /> Term ends
                      </span>
                    )}
                    {s.holiday && (
                      <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <PartyPopper aria-hidden="true" className="size-3 shrink-0" />
                        <span className="truncate">{s.holiday}</span>
                      </span>
                    )}
                    {/* md+: chips. sm: dots only, the chips do not fit. */}
                    <span className="hidden w-full min-w-0 flex-col gap-[3px] md:flex">
                      {shown.map((c) =>
                        c.kind === 'exam' ? (
                          <span key={c.id} className="flex min-w-0 items-center gap-1 rounded bg-orange-500 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-white">
                            <GraduationCap aria-hidden="true" className="size-3 shrink-0" />
                            <span className="truncate">{c.text}</span>
                          </span>
                        ) : (
                          <span
                            key={c.id}
                            className={cn(
                              'flex min-w-0 items-center gap-1 rounded px-1.5 py-[3px] text-[11px] font-medium leading-none',
                              c.task.isDone
                                ? 'bg-success/15 text-foreground/70'
                                : c.task.isMissed
                                  ? 'bg-destructive/10 text-foreground/70'
                                  : c.task.type === 'REVISION'
                                    ? 'outline-1 -outline-offset-1 outline-dashed outline-orange-500 bg-orange-500/15 text-foreground'
                                    : 'bg-primary text-primary-foreground'
                            )}
                          >
                            {c.task.isDone && <Check aria-hidden="true" className="size-3 shrink-0 text-success" />}
                            {c.task.isMissed && !c.task.isDone && <X aria-hidden="true" className="size-3 shrink-0 text-destructive" />}
                            <span className="truncate">{c.text}</span>
                          </span>
                        )
                      )}
                      {hidden > 0 && <span className="px-1 text-[11px] font-medium leading-none text-muted-foreground">+{hidden} more</span>}
                    </span>
                    <span className="mt-auto flex md:hidden">
                      <DayDots summary={s} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Wide screens: the selected day, as a full-height column. */}
        {isWide && (
          <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border/60 lg:block">
            <DayDetails
              key={selectedKey}
              dateKey={selectedKey}
              summary={selected}
              term={data.term}
              subjects={subjects}
              variant="panel"
            />
          </aside>
        )}

        {!isWide && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
              <DayDetails
                key={selectedKey}
                dateKey={selectedKey}
                summary={selected}
                term={data.term}
                subjects={subjects}
                variant="dialog"
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </ScheduleFrame>
  );
}

type DaySummary = {
  tasks: CalendarTask[];
  exams: CalendarData['exams'];
  homework: CalendarData['homework'];
  hasHomework: boolean;
  hasRevision: boolean;
  /** Planned study minutes on the day. */
  minutes: number;
  isMarked: boolean;
  isTermEnd: boolean;
  isToday: boolean;
  holiday: string | null;
};

function DayNumber({
  date,
  isToday,
  isMarked,
  muted = false,
}: {
  date: Date;
  isToday: boolean;
  isMarked: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold tabular-nums',
        isToday
          ? 'bg-primary text-primary-foreground'
          : isMarked
            ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/30'
            : muted
              ? 'text-muted-foreground'
              : 'text-foreground'
      )}
    >
      {format(date, 'd')}
    </span>
  );
}

/** Blue for homework blocks, orange for revision and exams, a ring for homework due. */
function DayDots({ summary: s }: { summary: DaySummary }) {
  if (!s.hasHomework && !s.hasRevision && s.exams.length === 0 && s.homework.length === 0) return null;
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {s.hasHomework && <span className="size-2 rounded-full bg-primary" />}
      {s.hasRevision && <span className="size-2 rounded-full border-2 border-dashed border-orange-500" />}
      {s.exams.length > 0 && <span className="size-2 rounded-full bg-orange-500" />}
      {s.homework.length > 0 && <span className="size-2 rounded-full border-2 border-foreground/60" />}
    </span>
  );
}

/**
 * Everything on one day: beside the grid on wide screens, in a dialog on
 * narrow ones. "Open this week" carries the day over to the Week page.
 */
function DayDetails({
  dateKey,
  summary,
  term,
  subjects,
  variant,
}: {
  dateKey: string;
  summary: DaySummary;
  term: CalendarData['term'];
  subjects: { id: string; name: string }[];
  variant: 'panel' | 'dialog';
}) {
  const archived = useIsArchived();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmTermEnd, setConfirmTermEnd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const date = parseDayKey(dateKey);
  if (!date) return null;

  const Title = variant === 'dialog' ? DialogTitle : 'h2';
  const Description = variant === 'dialog' ? DialogDescription : 'p';

  const termStartKey = term?.start ? dayKey(new Date(term.start)) : null;
  const canSetTermEnd = !!term && !archived && !summary.isTermEnd && (!termStartKey || dateKey >= termStartKey);

  const toggleMark = () => {
    startTransition(async () => {
      try {
        await toggleMarkedDay(date, !summary.isMarked);
      } catch {
        toast.error('That day could not be updated. Try again.');
      }
    });
  };

  const setTermEnd = () => {
    startTransition(async () => {
      const result = await extendActiveTerm(date);
      if (result && 'error' in result && result.error) {
        toast.error(result.error);
        return;
      }
      setConfirmTermEnd(false);
      toast.success(`${term?.name ?? 'Your term'} now ends on ${format(date, 'EEEE d MMMM')}.`);
    });
  };

  const onConfirmDelete = () => {
    if (!deleteConfirmId) return;
    startTransition(async () => {
      const result = await deleteTask(deleteConfirmId);
      if (!result?.success) toast.error('That block could not be removed. Try again.');
      setDeleteConfirmId(null);
    });
  };

  const doneCount = summary.tasks.filter((t) => t.isDone).length;
  const counts = [
    summary.tasks.length && `${summary.tasks.length} study ${summary.tasks.length === 1 ? 'block' : 'blocks'}`,
    summary.homework.length && `${summary.homework.length} homework due`,
    summary.exams.length && `${summary.exams.length} ${summary.exams.length === 1 ? 'exam' : 'exams'}`,
  ].filter(Boolean);
  const sortedTasks = [...summary.tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <>
      <div className="border-b border-border/60 p-5">
        <p className="text-xs font-medium text-muted-foreground">{format(date, 'EEEE')}</p>
        <Title className="mt-0.5 flex flex-wrap items-center gap-2 font-heading text-2xl font-bold tracking-tight">
          {format(date, 'd MMMM')}
          {summary.isToday && <Pill tone="primary">Today</Pill>}
          {summary.isTermEnd && <Pill tone="warning">Last day of term</Pill>}
          {summary.holiday && <Pill tone="success">{summary.holiday}</Pill>}
        </Title>
        <Description className="mt-1 text-sm text-muted-foreground">
          {summary.holiday && 'Public holiday - your study routine is off. '}
          {counts.length > 0 ? counts.join(' · ') : summary.holiday ? '' : 'Nothing is planned on this day yet.'}
        </Description>
        {summary.tasks.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-success transition-[width] duration-500"
                style={{ width: `${(doneCount / summary.tasks.length) * 100}%` }}
              />
            </span>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {doneCount}/{summary.tasks.length} done
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <QuickAddForm
            initialDate={date}
            subjects={subjects}
            trigger={
              <Button size="sm">
                <Plus /> Add task
              </Button>
            }
          />
          {!archived && (
            <Button variant="outline" size="sm" onClick={toggleMark} disabled={isPending} aria-pressed={summary.isMarked}>
              {summary.isMarked ? <BookmarkCheck className="text-destructive" /> : <Bookmark />}
              {summary.isMarked ? 'Unmark day' : 'Mark day'}
            </Button>
          )}
          {canSetTermEnd && !confirmTermEnd && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmTermEnd(true)} disabled={isPending}>
              <Flag /> Last day of term
            </Button>
          )}
        </div>

        {confirmTermEnd && (
          <div className="mt-4 space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
            <p className="text-sm font-medium text-foreground">
              {term?.name ?? 'Your term'} will end on {format(date, 'EEEE d MMMM')}. Study blocks stop being planned
              after that day, and you will be asked to finish the term when it arrives. You can change it again in{' '}
              <Link href="/year" className="font-semibold text-primary hover:underline">
                Year &amp; terms
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={setTermEnd} disabled={isPending}>
                {isPending ? 'Saving…' : 'Set last day'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmTermEnd(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={cn('space-y-6 p-5', variant === 'panel' && 'max-h-[calc(100vh-22rem)] min-h-40 overflow-y-auto')}>
        {summary.exams.length > 0 && (
          <DaySection title="Exams">
            {summary.exams.map((exam) => (
              <ListRow
                key={exam.id}
                href={`/exams/${exam.id}`}
                leading={<GraduationCap aria-hidden="true" className="size-5 shrink-0 text-orange-500" />}
                title={exam.title}
                subtitle={exam.startTime ? `Starts ${exam.startTime}` : 'Time not set'}
                trailing={exam.priority === 'HIGH' ? <Pill tone="danger">High priority</Pill> : undefined}
              />
            ))}
          </DaySection>
        )}

        {summary.tasks.length > 0 && (
          <DaySection title="Study blocks">
            {sortedTasks.map((task) =>
              editingTaskId === task.id ? (
                <EditTaskForm key={task.id} task={task} dateKey={dateKey} onClose={() => setEditingTaskId(null)} />
              ) : (
                <div key={task.id} className="relative flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 py-2.5 pl-4 pr-2">
                  <ModeBar type={task.type} isDone={task.isDone} isMissed={task.isMissed} />
                  <TaskTick
                    taskId={task.id}
                    subject={task.subject}
                    isDone={task.isDone}
                    isMissed={task.isMissed}
                    hasProof={task.hasProof}
                    showMissed
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn('flex min-w-0 items-center gap-2 text-sm font-semibold', task.isDone && 'text-muted-foreground line-through')}>
                      <StudyTypeIcon type={task.type} />
                      <span className="truncate">{task.subject}</span>
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {task.startTime} – {task.endTime}
                      {' · '}
                      {task.type === 'REVISION' ? 'Revision' : 'Homework'}
                    </p>
                  </div>
                  {!archived && (
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="icon-sm" aria-label={`Move or retime ${task.subject}`} onClick={() => setEditingTaskId(task.id)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${task.subject}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(task.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </DaySection>
        )}

        {summary.homework.length > 0 && (
          <DaySection title="Homework due">
            {summary.homework.map((hw) => (
              <ListRow
                key={hw.id}
                href="/homeworks"
                leading={<BookOpen aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
                title={hw.title}
                subtitle={hw.subject}
                trailing={hw.isCompleted ? <Pill tone="success">Done</Pill> : <Pill>Due</Pill>}
              />
            ))}
          </DaySection>
        )}

        {counts.length === 0 && (
          <EmptyState
            title="A free day"
            description={
              archived
                ? 'Nothing was planned on this day.'
                : 'Add a one-off task above, or give this weekday a recurring block in your study routine.'
            }
            action={
              !archived ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/manage">Open study routine</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <div className="flex justify-end border-t border-border/60 px-5 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={weekHref(startOfWeek(date, { weekStartsOn: 1 }))}>
            <CalendarRange /> Open this week
          </Link>
        </Button>
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={onConfirmDelete}
        title="Remove this study block?"
        description="It will be removed from this day. Your study routine is not changed, so other weeks keep their block."
        isPending={isPending}
      />
    </>
  );
}

function DaySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Move a block to another day or change its times, inside the day dialog. */
function EditTaskForm({
  task,
  dateKey: initialKey,
  onClose,
}: {
  task: CalendarTask;
  dateKey: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [dateStr, setDateStr] = useState(initialKey);
  const [startTime, setStartTime] = useState(task.startTime);
  const [endTime, setEndTime] = useState(task.endTime);
  const [clash, setClash] = useState<ClashInfo | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save();
  };

  const save = (onClash?: ClashResolution) => {
    startTransition(async () => {
      try {
        // The day as picked, not a Date: a browser's midnight read on a server
        // in another timezone lands on the day before.
        const result = await updateTask(task.id, { dateKey: dateStr, startTime, endTime }, onClash);
        setClash(null);
        if ('clash' in result) {
          setClash(result.clash);
          return;
        }
        if ('error' in result) {
          toast.error(result.error);
          return;
        }
        onClose();
      } catch {
        toast.error('That block could not be saved. Try again.');
      }
    });
  };

  const dateId = `${task.id}-date`;
  const startId = `${task.id}-start`;
  const endId = `${task.id}-end`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/60 bg-muted/40 p-4">
      <p className="font-bold text-foreground">Edit {task.subject}</p>
      <div className="space-y-2">
        <Label htmlFor={dateId}>Move to date</Label>
        <Input id={dateId} type="date" required value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={startId}>Starts</Label>
          <Input id={startId} type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={endId}>Ends</Label>
          <Input id={endId} type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      <ClashDialog clash={clash} subject={task.subject} busy={isPending} onChoose={save} onCancel={() => setClash(null)} />
    </form>
  );
}

