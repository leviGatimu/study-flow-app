'use client';

/**
 * The school-day portal: the lessons a student attends, and the editor for them.
 *
 * This file used to export a `SCHOOL_DATA` constant - one real student's real
 * timetable, hardcoded - which the dashboard status card, the lesson notifier
 * and the week view all imported. Every account saw the same lessons. The
 * lessons now come from the database, per user and per academic year, and this
 * component is where they are edited.
 */

import { useState, useEffect, useTransition } from 'react';
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
import { cn, getRwandaTime } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
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
}: {
  lessons: SchoolLesson[];
  /** False while a finished year is open - an archive is a record, not a workspace. */
  canEdit: boolean;
}) {
  const [now, setNow] = useState(getRwandaTime());
  const [isTimetableSynced, setIsTimetableSynced] = useTimetableSync();
  const [viewMode, setViewMode] = useState<'agenda' | 'weekly'>('agenda');
  const [editing, setEditing] = useState<SchoolLesson | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Today, unless today has no lessons - then the first day that does, so the
  // portal never opens on a blank screen at the weekend.
  const [activeDay, setActiveDay] = useState(() => {
    const today = getRwandaTime().getDay();
    if (lessons.some((l) => l.dayOfWeek === today)) return today;
    return WEEK.find((day) => lessons.some((l) => l.dayOfWeek === day)) ?? 1;
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(getRwandaTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  const remove = (lesson: SchoolLesson) => {
    startTransition(async () => {
      await deleteSchoolLesson(lesson.id);
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

  if (lessons.length === 0) {
    return (
      <>
        <EmptyState
          icon={<School />}
          title="No school timetable yet"
          description={
            canEdit
              ? 'Upload a photo of your timetable and it will be read for you — or type the lessons in yourself. Either way they show up on your dashboard, your week view and as lesson reminders.'
              : 'This academic year finished without a school timetable recorded.'
          }
          action={
            canEdit ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => setUploading(true)} className="gap-2">
                  <Upload className="w-4 h-4" /> Upload a photo
                </Button>
                <Button variant="outline" onClick={() => setEditing('new')} className="gap-2">
                  <Plus className="w-4 h-4" /> Add a lesson by hand
                </Button>
              </div>
            ) : undefined
          }
          className="py-16"
        />
        {editing !== null && (
          <LessonDialog
            key={editing === 'new' ? 'new' : editing.id}
            lesson={editing === 'new' ? null : editing}
            defaultDay={activeDay}
            onClose={() => setEditing(null)}
          />
        )}
        {uploading && (
          <UploadSchoolTimetableDialog
            existingCount={lessons.length}
            onClose={() => setUploading(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-heading font-semibold tracking-tight text-foreground mb-1 flex items-center gap-3">
            <School className="w-6 h-6 text-primary" /> Your school week
          </h2>
          <p className="text-muted-foreground text-sm">
            The lessons you attend. Your study blocks live on the timetable page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-card border border-border/60 p-1 rounded-xl flex items-center shadow-sm">
            <Button
              variant={viewMode === 'agenda' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('agenda')}
              aria-pressed={viewMode === 'agenda'}
              className="rounded-lg h-9 text-xs gap-1.5 px-3 cursor-pointer"
            >
              <ListTodo className="w-3.5 h-3.5" /> Day
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('weekly')}
              aria-pressed={viewMode === 'weekly'}
              className="rounded-lg h-9 text-xs gap-1.5 px-3 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Week
            </Button>
          </div>

          <div className="bg-card border border-border/60 px-4 h-11 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="flex flex-col select-none">
              <span className="text-xs text-muted-foreground leading-none mb-0.5">Lesson tracking</span>
              <span className="text-xs font-medium text-foreground leading-none">
                {isTimetableSynced ? 'On' : 'Off'}
              </span>
            </div>
            <Switch
              checked={isTimetableSynced}
              onCheckedChange={setIsTimetableSynced}
              aria-label="Track lessons on the dashboard"
              className="scale-90"
            />
          </div>

          <div className="bg-primary/5 border border-primary/20 px-4 h-11 rounded-xl flex items-center gap-3 shadow-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium tabular-nums">{format(now, 'HH:mm')}</span>
          </div>

          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setUploading(true)} className="h-11 gap-2">
                <Upload className="w-4 h-4" /> Upload
              </Button>
              <Button onClick={() => setEditing('new')} className="h-11 gap-2">
                <Plus className="w-4 h-4" /> Add lesson
              </Button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'agenda' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex gap-2 justify-center border-b border-border/20 pb-4 overflow-x-auto">
            {WEEK.map((day) => {
              const date = dateOf(day);
              const isToday = isSameDay(date, now);
              const count = lessons.filter((l) => l.dayOfWeek === day).length;

              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  aria-pressed={activeDay === day}
                  className={cn(
                    'flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl border transition-colors cursor-pointer',
                    activeDay === day
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isToday
                        ? 'bg-primary/5 border-primary/30 text-primary'
                        : 'bg-card border-border/50 text-foreground',
                    count === 0 && activeDay !== day && 'opacity-45'
                  )}
                >
                  <span className="text-xs opacity-60 leading-none mb-1">
                    {DAY_NAMES[day].slice(0, 3)}
                  </span>
                  <span className="text-base font-heading font-semibold leading-none">
                    {format(date, 'd')}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 pt-2">
            {lessonsOn(lessons, activeDay).length === 0 ? (
              <EmptyState
                icon={<Coffee />}
                title={`Nothing scheduled on ${DAY_NAMES[activeDay]}`}
                description={canEdit ? 'A free day — or one you have not filled in yet.' : undefined}
                action={
                  canEdit ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing('new')} className="gap-2">
                      <Plus className="w-4 h-4" /> Add a lesson
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              lessonsOn(lessons, activeDay).map((lesson) => {
                const isToday = isSameDay(dateOf(activeDay), now);
                const start = toMinutes(lesson.startTime);
                const end = toMinutes(lesson.endTime);
                const isActive =
                  isTimetableSynced && isToday && nowMinutes >= start && nowMinutes < end;
                const isPast = isToday && nowMinutes >= end;
                const Icon = subjectIcon(lesson);

                return (
                  <div
                    key={lesson.id}
                    className={cn(
                      'p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden',
                      isActive
                        ? 'bg-primary/5 border-primary'
                        : isPast
                          ? 'bg-muted/15 border-transparent opacity-45'
                          : 'bg-card border-border/40',
                      lesson.isBreak && !isActive && !isPast && 'bg-muted/10 border-dashed'
                    )}
                  >
                    {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-primary" />}

                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                          isActive
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : lesson.isBreak
                              ? 'bg-muted text-muted-foreground border-border/50'
                              : 'bg-primary/5 border-primary/10 text-primary'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <h4
                          className={cn(
                            'text-base font-medium text-foreground truncate',
                            isPast && 'line-through'
                          )}
                        >
                          {lesson.subject}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 leading-none">
                          <Clock className="w-3.5 h-3.5" /> {lesson.startTime} — {lesson.endTime}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isActive ? (
                        <span className="text-xs font-medium text-primary bg-primary/15 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" /> {timeLeft(lesson.endTime)}
                        </span>
                      ) : isPast ? (
                        <span className="text-xs text-muted-foreground/60 bg-muted/40 px-2.5 py-1 rounded-lg">
                          Done
                        </span>
                      ) : null}

                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Edit ${lesson.subject}`}
                            onClick={() => setEditing(lesson)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label={`Delete ${lesson.subject}`}
                            disabled={pending}
                            onClick={() => remove(lesson)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {viewMode === 'weekly' && (
        <div className="space-y-4">
          {WEEK.filter((day) => lessons.some((l) => l.dayOfWeek === day)).map((day) => {
            const date = dateOf(day);
            const isToday = isSameDay(date, now);

            return (
              <div
                key={day}
                className={cn(
                  'bg-card/45 border border-border/40 rounded-2xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-6',
                  isToday && 'border-primary bg-primary/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'flex md:flex-col items-center justify-center gap-2 md:gap-0.5 py-3 px-4 rounded-xl border min-w-[90px] shrink-0 text-center',
                    isToday
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 border-border/50 text-foreground'
                  )}
                >
                  <span className="text-xs opacity-60 leading-none">{DAY_NAMES[day].slice(0, 3)}</span>
                  <span className="text-xl font-heading font-semibold leading-none">
                    {format(date, 'd')}
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap gap-3 items-center">
                  {lessonsOn(lessons, day).map((lesson) => {
                    const start = toMinutes(lesson.startTime);
                    const end = toMinutes(lesson.endTime);
                    const isActive =
                      isTimetableSynced && isToday && nowMinutes >= start && nowMinutes < end;
                    const isPast = isToday && nowMinutes >= end;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => canEdit && setEditing(lesson)}
                        className={cn(
                          'py-2.5 px-4 rounded-xl border text-xs text-left flex flex-col justify-between min-w-[150px] max-w-[200px] shrink-0',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : isPast
                              ? 'bg-muted/15 border-transparent opacity-40'
                              : 'bg-card border-border/50',
                          lesson.isBreak && !isActive && !isPast && 'border-dashed text-muted-foreground',
                          canEdit && 'cursor-pointer hover:border-primary/40'
                        )}
                      >
                        <span className="text-xs opacity-60 mb-1 block">
                          {lesson.startTime} - {lesson.endTime}
                        </span>
                        <span className={cn('font-medium truncate block', isPast && 'line-through')}>
                          {lesson.subject}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <LessonDialog
          key={editing === 'new' ? 'new' : editing.id}
          lesson={editing === 'new' ? null : editing}
          defaultDay={activeDay}
          onClose={() => setEditing(null)}
        />
      )}
      {uploading && (
        <UploadSchoolTimetableDialog
          existingCount={lessons.length}
          onClose={() => setUploading(false)}
        />
      )}
    </div>
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
