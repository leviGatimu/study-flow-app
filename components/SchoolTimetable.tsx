'use client';

/**
 * School lessons: the lessons a student attends, and the editor for them.
 *
 * This file used to export a `SCHOOL_DATA` constant - one real student's real
 * timetable, hardcoded - which the dashboard status card, the lesson notifier
 * and the week view all imported. Every account saw the same lessons. The
 * lessons now come from the database, per user and per academic year, and this
 * component is where they are edited. It renders the page header too, because
 * the header's buttons open dialogs whose state lives here.
 */

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Zap,
  School,
  Coffee,
  BookOpen,
  CalendarDays,
  Cpu,
  Laptop,
  Globe,
  Plus,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn, getZonedNow } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageBody } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useTimetableSync } from '@/components/useTimetableSync';
import { UploadSchoolTimetableDialog } from '@/components/UploadSchoolTimetableDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DAY_NAMES,
  lessonAt,
  lessonsOn,
  minutesOf,
  nextLessonAfter,
  schoolDayBounds,
  toMinutes,
  weekdayOrder,
  type SchoolLesson,
} from '@/lib/school';
import {
  createSchoolLesson,
  updateSchoolLesson,
  deleteSchoolLesson,
  type SchoolLessonInput,
} from '@/lib/school-actions';

/** Monday through Sunday, as dayOfWeek values. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const subjectIcon = (lesson: SchoolLesson) => {
  if (lesson.isBreak) return Coffee;
  const sub = lesson.subject.toLowerCase();
  if (sub.includes('network')) return Globe;
  if (/javascript|php|web|programming|software|comput/.test(sub)) return Laptop;
  if (/embedded|electric|electronic|circuit|hardware/.test(sub)) return Cpu;
  return BookOpen;
};

export function SchoolTimetable({
  lessons,
  canEdit,
  timezone,
  yearLabel,
}: {
  lessons: SchoolLesson[];
  /** False while a finished year is open - an archive is a record, not a workspace. */
  canEdit: boolean;
  /** The user's own timezone, so "now" is their school day and not the server's. */
  timezone: string;
  /** The academic year these lessons belong to, for the description. */
  yearLabel: string | null;
}) {
  const [now, setNow] = useState(() => getZonedNow(timezone));
  const [isTimetableSynced, setIsTimetableSynced] = useTimetableSync();
  const [editing, setEditing] = useState<SchoolLesson | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<SchoolLesson | null>(null);
  const [pending, startTransition] = useTransition();

  // Today, unless today has no lessons - then the first day that does, so the
  // page never opens on a blank screen at the weekend.
  const [activeDay, setActiveDay] = useState(() => {
    const today = getZonedNow(timezone).getDay();
    if (lessons.some((l) => l.dayOfWeek === today)) return today;
    return WEEK.find((day) => lessons.some((l) => l.dayOfWeek === day)) ?? 1;
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(getZonedNow(timezone)), 30000);
    return () => clearInterval(timer);
  }, [timezone]);

  const confirmRemove = () => {
    if (!removing) return;
    startTransition(async () => {
      await deleteSchoolLesson(removing.id);
      setRemoving(null);
    });
  };

  const nowMinutes = minutesOf(now);
  const startOfCurrWeek = startOfWeek(now, { weekStartsOn: 1 });
  const dateOf = (dayOfWeek: number) => addDays(startOfCurrWeek, weekdayOrder(dayOfWeek));

  const timeLeft = (endTime: string) => {
    const diff = toMinutes(endTime) - nowMinutes;
    if (diff <= 0) return null;
    return diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m left` : `${diff}m left`;
  };

  const hasLessons = lessons.length > 0;
  const attended = lessons.filter((l) => !l.isBreak).length;

  const header = (
    <div data-tour="school-timetable-intro">
      <PageHeader
        title="School lessons"
        description={
          yearLabel
            ? `The lessons you attend in ${yearLabel}. Upload a photo of your timetable and it is read for you - then fix anything that came out wrong.`
            : 'The lessons you attend. Upload a photo of your timetable and it is read for you - then fix anything that came out wrong.'
        }
        highlight={hasLessons ? { label: 'Each week', value: `${attended} ${attended === 1 ? 'lesson' : 'lessons'}` } : undefined}
        actions={
          canEdit ? (
            hasLessons ? (
              <>
                <Button variant="outline" size="lg" onClick={() => setUploading(true)}>
                  <Upload /> Upload a new photo
                </Button>
                <Button size="lg" onClick={() => setEditing('new')}>
                  <Plus /> Add lesson
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={() => setUploading(true)}>
                <Upload /> Upload a photo
              </Button>
            )
          ) : undefined
        }
      />
    </div>
  );

  const dialogs = (
    <>
      {editing !== null && (
        <LessonDialog
          key={editing === 'new' ? 'new' : editing.id}
          lesson={editing === 'new' ? null : editing}
          defaultDay={activeDay}
          onClose={() => setEditing(null)}
        />
      )}
      {uploading && (
        <UploadSchoolTimetableDialog existingCount={lessons.length} onClose={() => setUploading(false)} />
      )}
      <ConfirmModal
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        isPending={pending}
        title="Remove this lesson?"
        description={
          removing
            ? `${removing.subject} on ${DAY_NAMES[removing.dayOfWeek]} at ${removing.startTime} will be removed from your school week.`
            : ''
        }
      />
    </>
  );

  if (!hasLessons) {
    return (
      <>
        {header}
        <PageBody>
          <EmptyState
            icon={<School />}
            title="No school lessons yet"
            description={
              canEdit
                ? 'Upload a photo of your timetable and it will be read for you - or type the lessons in yourself. They show up on your dashboard, your week and as lesson reminders.'
                : 'This academic year finished without a school timetable recorded.'
            }
            action={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing('new')}>
                  <Plus /> Add a lesson by hand
                </Button>
              ) : undefined
            }
            className="py-12"
          />
        </PageBody>
        {dialogs}
      </>
    );
  }

  const todayDow = now.getDay();
  const current = isTimetableSynced ? lessonAt(lessons, todayDow, nowMinutes) : null;
  const next = nextLessonAfter(lessons, todayDow, nowMinutes);
  const todayBounds = schoolDayBounds(lessons, todayDow);
  const dayLessons = lessonsOn(lessons, activeDay);
  const activeIsToday = isSameDay(dateOf(activeDay), now);

  const lessonRow = (lesson: SchoolLesson) => {
    const start = toMinutes(lesson.startTime);
    const end = toMinutes(lesson.endTime);
    const isActive = isTimetableSynced && activeIsToday && nowMinutes >= start && nowMinutes < end;
    const isPast = activeIsToday && nowMinutes >= end;
    const Icon = subjectIcon(lesson);
    const actions = canEdit && (
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" aria-label={`Edit ${lesson.subject}`} onClick={() => setEditing(lesson)}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${lesson.subject}`}
          disabled={pending}
          onClick={() => setRemoving(lesson)}
        >
          <Trash2 />
        </Button>
      </div>
    );

    // A break is a pause in the day, not an item in it: a thin divider row.
    if (lesson.isBreak) {
      return (
        <li key={lesson.id} className={cn('flex items-center gap-2 sm:gap-4', isPast && 'opacity-50')}>
          <span className="hidden sm:block w-14 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">
            {lesson.startTime}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground">
              <Coffee className="size-3.5 shrink-0" /> <span className="truncate">{lesson.subject} · {formatDuration(end - start)}</span>
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {actions}
        </li>
      );
    }

    return (
      <li key={lesson.id} className="flex items-center gap-2 sm:gap-4">
        <span
          className={cn(
            'hidden sm:block w-14 shrink-0 text-right font-heading text-base font-bold tabular-nums',
            isActive ? 'text-primary' : 'text-foreground',
            isPast && 'text-muted-foreground'
          )}
        >
          {lesson.startTime}
        </span>
        <div
          className={cn(
            'relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border py-3.5 pl-4 pr-1 sm:gap-3 sm:pl-5 sm:pr-2 transition-colors',
            isActive
              ? 'border-primary/40 bg-primary/10'
              : 'border-border/40 bg-muted/40 hover:bg-muted',
            isPast && 'opacity-60'
          )}
        >
          <span
            aria-hidden
            className={cn('absolute left-0 inset-y-3 border-l-4 rounded-full', isActive ? 'border-primary' : isPast ? 'border-border' : 'border-primary/50')}
          />
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'hidden sm:flex size-9 shrink-0 items-center justify-center rounded-xl',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-background text-primary border border-border/60'
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className={cn('break-words font-bold leading-snug text-foreground sm:truncate', isPast && 'line-through decoration-muted-foreground/50')}>
                {lesson.subject}
              </p>
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {lesson.startTime} – {lesson.endTime} · {formatDuration(end - start)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isActive && (
              <Pill tone="primary">
                <Zap /> {timeLeft(lesson.endTime)}
              </Pill>
            )}
            {actions}
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      {header}
      <PageBody>
        <NowCard
          current={current}
          next={next}
          bounds={todayBounds}
          nowMinutes={nowMinutes}
          tracking={isTimetableSynced}
          timeLeft={timeLeft}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Day">
              {WEEK.map((day) => {
                const date = dateOf(day);
                const isToday = isSameDay(date, now);
                const count = lessons.filter((l) => l.dayOfWeek === day && !l.isBreak).length;
                const selected = activeDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDay(day)}
                    aria-pressed={selected}
                    aria-label={`${DAY_NAMES[day]}, ${count} ${count === 1 ? 'lesson' : 'lessons'}`}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : isToday
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground border-border hover:text-foreground',
                      count === 0 && !selected && 'opacity-60'
                    )}
                  >
                    {DAY_NAMES[day].slice(0, 3)}
                    <span className={cn('tabular-nums', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {format(date, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>

            <Panel>
              <PanelTitle
                icon={<School />}
                action={
                  <>
                    {activeIsToday && <Pill tone="primary">Today</Pill>}
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                        <Plus /> Add
                      </Button>
                    )}
                  </>
                }
              >
                {DAY_NAMES[activeDay]}
              </PanelTitle>
              {dayLessons.length === 0 ? (
                <EmptyState
                  icon={<Coffee />}
                  title={`No lessons on ${DAY_NAMES[activeDay]}`}
                  description={canEdit ? 'A free day - or one you have not filled in yet.' : undefined}
                  action={
                    canEdit ? (
                      <Button variant="outline" onClick={() => setEditing('new')}>
                        <Plus /> Add a lesson
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="space-y-2.5">{dayLessons.map(lessonRow)}</ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <Panel>
              <PanelTitle
                icon={<CalendarDays />}
                action={
                  <Link href="/timetable" className="text-sm font-medium text-primary hover:underline">
                    Your week
                  </Link>
                }
              >
                This week
              </PanelTitle>
              <ul className="space-y-2">
                {WEEK.map((day) => {
                  const bounds = schoolDayBounds(lessons, day);
                  const count = lessons.filter((l) => l.dayOfWeek === day && !l.isBreak).length;
                  const isToday = isSameDay(dateOf(day), now);
                  const selected = activeDay === day;
                  return (
                    <li key={day}>
                      <button
                        type="button"
                        onClick={() => setActiveDay(day)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          selected ? 'border-primary/30 bg-primary/10' : 'border-border/40 bg-muted/40 hover:bg-muted'
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn('block font-bold', selected ? 'text-primary' : 'text-foreground')}>
                            {DAY_NAMES[day]}
                            {isToday && <span className="ml-2 text-xs font-semibold text-primary">Today</span>}
                          </span>
                          <span className="block text-xs font-medium tabular-nums text-muted-foreground">
                            {bounds ? `${bounds.start} – ${bounds.end}` : 'No school'}
                          </span>
                        </span>
                        <Pill className={cn(!count && 'opacity-60')}>
                          {count} {count === 1 ? 'lesson' : 'lessons'}
                        </Pill>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel>
              <PanelTitle icon={<Zap />}>Live tracking</PanelTitle>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/40 bg-muted/40 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Follow my school day</span>
                <Switch
                  checked={isTimetableSynced}
                  onCheckedChange={setIsTimetableSynced}
                  aria-describedby="lesson-tracking-help"
                />
              </label>
              <p id="lesson-tracking-help" className="mt-3 text-sm text-muted-foreground">
                The lesson happening now is highlighted here and on your dashboard, with a countdown to the bell.
              </p>
            </Panel>
          </div>
        </div>
      </PageBody>
      {dialogs}
    </>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * What school is doing right now, as the page's hero - the same blue card the
 * dashboard shows while a lesson is on, and a plain panel otherwise.
 */
function NowCard({
  current,
  next,
  bounds,
  nowMinutes,
  tracking,
  timeLeft,
}: {
  current: SchoolLesson | null;
  next: SchoolLesson | null;
  bounds: { start: string; end: string } | null;
  nowMinutes: number;
  tracking: boolean;
  timeLeft: (endTime: string) => string | null;
}) {
  if (current) {
    const start = toMinutes(current.startTime);
    const end = toMinutes(current.endTime);
    const pct = Math.min(100, Math.max(0, ((nowMinutes - start) / (end - start)) * 100));
    return (
      <div className="rounded-3xl bg-primary p-6 md:p-8 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-bold text-primary-foreground/80">
              {current.isBreak ? 'On a break' : 'In class now'} · {current.startTime} – {current.endTime}
            </p>
            <p className="font-heading text-3xl md:text-4xl font-black tracking-tight break-words">{current.subject}</p>
            {next && (
              <p className="text-sm font-medium text-primary-foreground/80">
                Then {next.subject} at {next.startTime}
              </p>
            )}
          </div>
          <div className="shrink-0 md:text-right">
            <p className="text-sm font-bold text-primary-foreground/80">Bell in</p>
            <p className="font-heading text-4xl font-black tabular-nums">{timeLeft(current.endTime)?.replace(' left', '') ?? '0m'}</p>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
          <div className="h-full rounded-full bg-primary-foreground transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  const title = next
    ? `${next.subject} at ${next.startTime}`
    : bounds && nowMinutes >= toMinutes(bounds.end)
      ? "School's out for today"
      : bounds
        ? 'School has not started yet'
        : 'No school today';
  const label = next ? 'Next lesson' : 'Today';
  const detail = !tracking
    ? 'Turn on live tracking to follow each lesson as it happens.'
    : bounds
      ? `School today runs ${bounds.start} – ${bounds.end}.`
      : 'Enjoy the free day.';

  return (
    <Panel className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-2xl font-bold break-words">{title}</p>
      </div>
      <p className="text-sm font-medium text-muted-foreground md:text-right">{detail}</p>
    </Panel>
  );
}

/**
 * Add or edit one lesson.
 *
 * Times are `<input type="time">`, which produces exactly the "HH:MM" the
 * server validates - typing a time is one of the few places a native control
 * beats anything hand-rolled, and it gets the mobile keyboard right for free.
 *
 * Mounted only while open, and keyed on the row being edited, so the form seeds
 * itself from props once at mount. The alternative - one long-lived dialog
 * refilled by an effect when `open` flips - is a setState-in-effect cascade the
 * lint config rejects, and it is the weaker design anyway: state that belongs
 * to one row should not outlive it.
 */
function LessonDialog({
  lesson,
  defaultDay,
  onClose,
}: {
  lesson: SchoolLesson | null;
  defaultDay: number;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<SchoolLessonInput>(
    lesson
      ? {
          dayOfWeek: lesson.dayOfWeek,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          subject: lesson.subject,
          isBreak: lesson.isBreak,
        }
      : { dayOfWeek: defaultDay, startTime: '09:00', endTime: '10:00', subject: '', isBreak: false }
  );

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = lesson
        ? await updateSchoolLesson(lesson.id, form)
        : await createSchoolLesson(form);
      if (result?.error) setError(result.error);
      else onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit lesson' : 'Add a lesson'}</DialogTitle>
          <DialogDescription>
            Part of your school day — not a study block you tick off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-subject">Lesson</Label>
            <Input
              id="lesson-subject"
              value={form.subject}
              placeholder="e.g. Mathematics"
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-day">Day</Label>
            <Select
              value={String(form.dayOfWeek)}
              onValueChange={(value) => setForm((f) => ({ ...f, dayOfWeek: Number(value) }))}
            >
              <SelectTrigger id="lesson-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {DAY_NAMES[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lesson-start">Starts</Label>
              <Input
                id="lesson-start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-end">Ends</Label>
              <Input
                id="lesson-end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer">
            <Switch
              checked={form.isBreak ?? false}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isBreak: checked }))}
            />
            This is a break or lunch
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !form.subject.trim()}>
            {pending ? 'Saving…' : lesson ? 'Save changes' : 'Add lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
