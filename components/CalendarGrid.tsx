'use client';

import { useMemo, useState, useTransition } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Flag,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { QuickAddForm } from '@/components/QuickAddForm';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { toggleMarkedDay, updateTask, deleteTask } from '@/lib/actions';
import { extendActiveTerm } from '@/lib/term-actions';
import { cn } from '@/lib/utils';
import {
  StudyLegend,
  StudyTypeIcon,
  StudyTypePill,
  statusOf,
  studyBlockClass,
} from '@/app/timetable/study-block';
import { dayKey, monthHref, parseDayKey, weekHref } from '@/app/timetable/schedule-dates';

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
export function CalendarGrid({
  monthKey,
  todayKey,
  data,
  subjects,
}: {
  monthKey: string;
  todayKey: string;
  data: CalendarData;
  subjects: { id: string; name: string }[];
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const isCurrentMonth = todayKey.startsWith(monthKey);

  const summaryOf = (key: string) => {
    const tasks = tasksByDay.get(key) ?? [];
    return {
      tasks,
      exams: examsByDay.get(key) ?? [],
      homework: homeworkByDay.get(key) ?? [],
      hasHomework: tasks.some((t) => t.type !== 'REVISION'),
      hasRevision: tasks.some((t) => t.type === 'REVISION'),
      isMarked: marked.has(key),
      isTermEnd: key === termEndKey,
      isToday: key === todayKey,
    };
  };

  return (
    <>
      <Panel padded={false} className="overflow-hidden">
        <div className="p-4 pb-0 sm:p-6 sm:pb-0">
          <PanelTitle
            icon={<CalendarRange />}
            action={
              <>
                {!isCurrentMonth && (
                  <Button asChild variant="outline">
                    <Link href="/calendar">Today</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="icon" aria-label="Previous month">
                  <Link href={monthHref(addMonths(month, -1))}>
                    <ChevronLeft />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" aria-label="Next month">
                  <Link href={monthHref(addMonths(month, 1))}>
                    <ChevronRight />
                  </Link>
                </Button>
              </>
            }
          >
            {format(month, 'MMMM yyyy')}
          </PanelTitle>
        </div>

        {/* Phone: a list of the month's days. */}
        <ul className="divide-y divide-border/60 border-t border-border/60 sm:hidden">
          {monthDays.map((date) => {
            const key = dayKey(date);
            const s = summaryOf(key);
            const count = s.tasks.length + s.exams.length + s.homework.length;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={cn(
                    'flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                    s.isToday && 'bg-primary/5'
                  )}
                >
                  <DayNumber date={date} isToday={s.isToday} isMarked={s.isMarked} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {format(date, 'EEEE')}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <DayDots summary={s} />
                      {count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Nothing planned'}
                      {s.isTermEnd && <Pill tone="warning">Term ends</Pill>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Tablet and up: the month grid. */}
        <div className="hidden sm:block">
          <div className="mt-2 grid grid-cols-7 border-y border-border/60 bg-muted/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border/60">
            {gridDays.map((date) => {
              const key = dayKey(date);
              const s = summaryOf(key);
              const inMonth = isSameMonth(date, month);
              const labels = [
                ...s.exams.map((e) => ({ id: e.id, text: e.title, kind: 'exam' as const })),
                ...s.tasks.map((t) => ({ id: t.id, text: t.subject, kind: 'task' as const, task: t })),
              ];
              const hidden = labels.length - 2;
              const count = s.tasks.length + s.exams.length + s.homework.length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  aria-label={`${format(date, 'EEEE d MMMM')}, ${count} ${count === 1 ? 'item' : 'items'}`}
                  className={cn(
                    'flex min-h-28 w-full flex-col gap-2 bg-card p-2 text-left transition-colors hover:bg-muted/50 focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 lg:min-h-32 lg:p-3',
                    !inMonth && 'bg-muted/30 text-muted-foreground',
                    s.isToday && 'bg-primary/5'
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <DayNumber date={date} isToday={s.isToday} isMarked={s.isMarked} muted={!inMonth} />
                    <DayDots summary={s} />
                  </span>
                  {s.isTermEnd && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      <Flag aria-hidden="true" className="size-3" /> Term ends
                    </span>
                  )}
                  <span className="hidden w-full flex-col gap-1 md:flex">
                    {labels.slice(0, 2).map((l) =>
                      l.kind === 'exam' ? (
                        <span
                          key={l.id}
                          className="truncate rounded-lg bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300"
                        >
                          Exam: {l.text}
                        </span>
                      ) : (
                        <span
                          key={l.id}
                          className={cn(
                            'truncate rounded-lg px-2 py-0.5 text-xs font-medium text-foreground',
                            studyBlockClass(l.task.type, statusOf(l.task)),
                            l.task.isDone && 'line-through opacity-70'
                          )}
                        >
                          {l.text}
                        </span>
                      )
                    )}
                    {hidden > 0 && (
                      <span className="px-1 text-xs font-medium text-muted-foreground">+{hidden} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 p-4 sm:px-6">
          <StudyLegend
            extra={
              <>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full bg-orange-500" /> Exam
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full border-2 border-foreground/60" /> Homework due
                </span>
                <span className="flex items-center gap-2">
                  <Bookmark aria-hidden="true" className="size-3 text-destructive" /> Marked day
                </span>
              </>
            }
          />
        </div>
      </Panel>

      <DayDialog
        dateKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        summary={selectedKey ? summaryOf(selectedKey) : null}
        term={data.term}
        subjects={subjects}
      />
    </>
  );
}

type DaySummary = {
  tasks: CalendarTask[];
  exams: CalendarData['exams'];
  homework: CalendarData['homework'];
  hasHomework: boolean;
  hasRevision: boolean;
  isMarked: boolean;
  isTermEnd: boolean;
  isToday: boolean;
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
 * Everything on one day. Closing it returns to the grid unchanged; "Open this
 * week" carries the day over to the Week page.
 */
function DayDialog({
  dateKey,
  summary,
  term,
  subjects,
  onClose,
}: {
  dateKey: string | null;
  summary: DaySummary | null;
  term: CalendarData['term'];
  subjects: { id: string; name: string }[];
  onClose: () => void;
}) {
  const archived = useIsArchived();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmTermEnd, setConfirmTermEnd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const date = parseDayKey(dateKey ?? undefined);
  const open = !!date && !!summary;

  const close = () => {
    setEditingTaskId(null);
    setConfirmTermEnd(false);
    onClose();
  };

  const termStartKey = term?.start ? dayKey(new Date(term.start)) : null;
  const canSetTermEnd =
    !!term && !archived && !summary?.isTermEnd && !!dateKey && (!termStartKey || dateKey >= termStartKey);

  const toggleMark = () => {
    if (!date || !summary) return;
    startTransition(async () => {
      try {
        await toggleMarkedDay(date, !summary.isMarked);
      } catch {
        toast.error('That day could not be updated. Try again.');
      }
    });
  };

  const setTermEnd = () => {
    if (!date) return;
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

  const counts = summary
    ? [
        summary.tasks.length && `${summary.tasks.length} study ${summary.tasks.length === 1 ? 'block' : 'blocks'}`,
        summary.homework.length && `${summary.homework.length} homework due`,
        summary.exams.length && `${summary.exams.length} ${summary.exams.length === 1 ? 'exam' : 'exams'}`,
      ].filter(Boolean)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {date && summary && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">
                  {format(date, 'EEEE d MMMM')}
                  {summary.isToday && <Pill tone="primary">Today</Pill>}
                  {summary.isTermEnd && <Pill tone="warning">Last day of term</Pill>}
                </DialogTitle>
                <DialogDescription>
                  {counts.length > 0 ? counts.join(' · ') : 'Nothing is planned on this day yet.'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleMark}
                    disabled={isPending}
                    aria-pressed={summary.isMarked}
                  >
                    {summary.isMarked ? <BookmarkCheck className="text-destructive" /> : <Bookmark />}
                    {summary.isMarked ? 'Unmark day' : 'Mark day'}
                  </Button>
                )}
                {canSetTermEnd && !confirmTermEnd && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmTermEnd(true)} disabled={isPending}>
                    <Flag /> Make this the last day of term
                  </Button>
                )}
              </div>

              {confirmTermEnd && (
                <div className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {term?.name ?? 'Your term'} will end on {format(date, 'EEEE d MMMM')}. Study blocks stop being
                    planned after that day, and you will be asked to finish the term when it arrives. You can
                    change it again in{' '}
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

              <div className="space-y-6">
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

                {summary.homework.length > 0 && (
                  <DaySection title="Homework due">
                    {summary.homework.map((hw) => (
                      <ListRow
                        key={hw.id}
                        href="/homeworks"
                        leading={<BookOpen aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
                        title={hw.title}
                        subtitle={hw.subject}
                        trailing={
                          hw.isCompleted ? <Pill tone="success">Done</Pill> : <Pill>Due</Pill>
                        }
                      />
                    ))}
                  </DaySection>
                )}

                {summary.tasks.length > 0 && (
                  <DaySection title="Study blocks">
                    {summary.tasks.map((task) =>
                      editingTaskId === task.id ? (
                        <EditTaskForm
                          key={task.id}
                          task={task}
                          dateKey={dateKey!}
                          onClose={() => setEditingTaskId(null)}
                        />
                      ) : (
                        <div
                          key={task.id}
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 py-3',
                            studyBlockClass(task.type, statusOf(task))
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <TaskCheckbox
                              taskId={task.id}
                              isDone={task.isDone}
                              isMissed={task.isMissed}
                              hasProof={task.hasProof}
                            />
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  'flex min-w-0 items-center gap-2 font-bold text-foreground',
                                  task.isDone && 'line-through opacity-70'
                                )}
                              >
                                <StudyTypeIcon type={task.type} />
                                <span className="truncate">{task.subject}</span>
                              </p>
                              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                                {task.startTime} – {task.endTime}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="hidden sm:inline-flex">
                              <StudyTypePill type={task.type} status={statusOf(task)} />
                            </span>
                            {!archived && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move or retime ${task.subject}`}
                                  onClick={() => setEditingTaskId(task.id)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remove ${task.subject}`}
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirmId(task.id)}
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    )}
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

              <div className="flex justify-end border-t border-border/60 pt-4">
                <Button asChild variant="outline">
                  <Link href={weekHref(startOfWeek(date, { weekStartsOn: 1 }))}>
                    <CalendarRange /> Open this week
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newDate = parseDayKey(dateStr);
    if (!newDate) {
      toast.error('Pick a valid date.');
      return;
    }
    startTransition(async () => {
      try {
        await updateTask(task.id, { date: newDate, startTime, endTime });
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
    </form>
  );
}

