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
  Clock,
  Zap,
  School,
  Coffee,
  BookOpen,
  ListTodo,
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
  lessonsOn,
  minutesOf,
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
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
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
        meta={hasLessons ? `${attended} ${attended === 1 ? 'lesson' : 'lessons'} a week` : undefined}
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

  const lessonRow = (lesson: SchoolLesson, isToday: boolean) => {
    const start = toMinutes(lesson.startTime);
    const end = toMinutes(lesson.endTime);
    const isActive = isTimetableSynced && isToday && nowMinutes >= start && nowMinutes < end;
    const isPast = isToday && nowMinutes >= end;
    const Icon = subjectIcon(lesson);

    return (
      <li
        key={lesson.id}
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
          isActive
            ? 'border-primary bg-primary/5'
            : lesson.isBreak
              ? 'border-dashed border-border bg-muted/30'
              : 'border-border/60 bg-card',
          isPast && !isActive && 'opacity-60'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Icon
            aria-hidden="true"
            className={cn('size-5 shrink-0', lesson.isBreak ? 'text-muted-foreground' : 'text-primary')}
          />
          <div className="min-w-0">
            <p className={cn('truncate font-bold text-foreground', isPast && 'line-through')}>
              {lesson.subject}
            </p>
            <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-muted-foreground">
              <Clock aria-hidden="true" className="size-3" /> {lesson.startTime} – {lesson.endTime}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isActive ? (
            <Pill tone="primary">
              <Zap /> {timeLeft(lesson.endTime)}
            </Pill>
          ) : isPast ? (
            <Pill>Done</Pill>
          ) : lesson.isBreak ? (
            <Pill>Break</Pill>
          ) : null}

          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${lesson.subject}`}
                onClick={() => setEditing(lesson)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label={`Delete ${lesson.subject}`}
                disabled={pending}
                onClick={() => setRemoving(lesson)}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      {header}
      <PageBody>
        <div className="space-y-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex w-fit items-center gap-1 rounded-xl border border-border/60 bg-card p-1"
              role="group"
              aria-label="View"
            >
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
                aria-pressed={viewMode === 'day'}
              >
                <ListTodo /> Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                aria-pressed={viewMode === 'week'}
              >
                <CalendarDays /> Week
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                <Switch
                  checked={isTimetableSynced}
                  onCheckedChange={setIsTimetableSynced}
                  aria-describedby="lesson-tracking-help"
                />
                Track lessons live
              </label>
              <Link href="/timetable" className="text-sm font-medium text-primary hover:underline">
                See them on your week
              </Link>
            </div>
          </div>
          <p id="lesson-tracking-help" className="text-xs text-muted-foreground">
            With tracking on, the lesson happening now is highlighted here and on your dashboard.
          </p>
        </div>

        {viewMode === 'day' && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Day">
              {WEEK.map((day) => {
                const date = dateOf(day);
                const isToday = isSameDay(date, now);
                const count = lessons.filter((l) => l.dayOfWeek === day).length;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDay(day)}
                    aria-pressed={activeDay === day}
                    aria-label={`${DAY_NAMES[day]}, ${count} ${count === 1 ? 'lesson' : 'lessons'}`}
                    className={cn(
                      'flex min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      activeDay === day
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isToday
                          ? 'border-primary/30 bg-primary/5 text-primary'
                          : 'border-border/60 bg-card text-foreground hover:bg-muted',
                      count === 0 && activeDay !== day && 'text-muted-foreground'
                    )}
                  >
                    <span className="text-xs font-medium">{DAY_NAMES[day].slice(0, 3)}</span>
                    <span className="font-heading text-base font-bold">{format(date, 'd')}</span>
                  </button>
                );
              })}
            </div>

            <Panel>
              <PanelTitle icon={<School />}>{DAY_NAMES[activeDay]}</PanelTitle>
              {lessonsOn(lessons, activeDay).length === 0 ? (
                <EmptyState
                  icon={<Coffee />}
                  title={`No lessons on ${DAY_NAMES[activeDay]}`}
                  description={canEdit ? 'A free day - or one you have not filled in yet.' : undefined}
                  action={
                    canEdit ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                        <Plus /> Add a lesson
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {lessonsOn(lessons, activeDay).map((lesson) =>
                    lessonRow(lesson, isSameDay(dateOf(activeDay), now))
                  )}
                </ul>
              )}
            </Panel>
          </div>
        )}

        {viewMode === 'week' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {WEEK.filter((day) => lessons.some((l) => l.dayOfWeek === day)).map((day) => {
              const isToday = isSameDay(dateOf(day), now);
              return (
                <Panel key={day} className={cn(isToday && 'border-primary/50')}>
                  <PanelTitle icon={<School />} action={isToday ? <Pill tone="primary">Today</Pill> : undefined}>
                    {DAY_NAMES[day]}
                  </PanelTitle>
                  <ul className="space-y-2">
                    {lessonsOn(lessons, day).map((lesson) => lessonRow(lesson, isToday))}
                  </ul>
                </Panel>
              );
            })}
          </div>
        )}
      </PageBody>
      {dialogs}
    </>
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
