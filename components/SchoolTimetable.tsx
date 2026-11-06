'use client';

/**
 * School lessons: the lessons a student attends, and the editor for them.
 *
 * This file used to export a `SCHOOL_DATA` constant - one real student's real
 * timetable, hardcoded - which the dashboard status card, the lesson notifier
 * and the week view all imported. Every account saw the same lessons. The
 * lessons now come from the database, per user and per academic year, and this
 * component is where they are edited. It renders the page's frame too, because
 * the toolbar's buttons open dialogs whose state lives here.
 */

import { useState, useEffect, useTransition } from 'react';
import {
  School,
  Plus,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { startOfWeek, addDays, isSameDay } from 'date-fns';
import { getZonedNow } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ScheduleFrame } from '@/components/schedule/ScheduleFrame';
import { WeekBoard } from '@/components/schedule/WeekBoard';
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
import { addSubject } from '@/lib/subject-actions';
import { canonicalSubject, normalizeSubject } from '@/lib/subject-match';

/** Monday through Sunday, as dayOfWeek values. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];


export function SchoolTimetable({
  lessons,
  subjects,
  canEdit,
  timezone,
  yearLabel,
  initialNow,
}: {
  lessons: SchoolLesson[];
  /** This year's subjects; lessons are picked from these so names stay consistent. */
  subjects: string[];
  /** False while a finished year is open - an archive is a record, not a workspace. */
  canEdit: boolean;
  /** The user's own timezone, so "now" is their school day and not the server's. */
  timezone: string;
  /** The academic year these lessons belong to, for the description. */
  yearLabel: string | null;
  /** Local wall time without a UTC suffix, shared by SSR and hydration. */
  initialNow: string;
}) {
  const [now, setNow] = useState(() => new Date(initialNow));
  const [isTimetableSynced, setIsTimetableSynced] = useTimetableSync();
  const [editing, setEditing] = useState<SchoolLesson | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<SchoolLesson | null>(null);
  const [pending, startTransition] = useTransition();

  // The day a new lesson defaults to: today, unless today has no lessons -
  // then the first day that does.
  const [activeDay] = useState(() => {
    const today = new Date(initialNow).getDay();
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

  const dialogs = (
    <>
      {editing !== null && (
        <LessonDialog
          key={editing === 'new' ? 'new' : editing.id}
          lesson={editing === 'new' ? null : editing}
          defaultDay={activeDay}
          subjects={subjects}
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
            ? `${removing.subject} on ${DAY_NAMES[removing.dayOfWeek]} at ${removing.startTime} will be removed from your school lessons.`
            : ''
        }
      />
    </>
  );

  if (!hasLessons) {
    return (
      <ScheduleFrame
        tour="school-timetable-intro"
        title="School lessons"
        meta={yearLabel ? `The lessons you attend in ${yearLabel}` : 'The lessons you attend'}
        actions={
          canEdit && (
            <Button onClick={() => setUploading(true)}>
              <Upload /> Upload a photo
            </Button>
          )
        }
      >
        <div className="p-4 md:p-6">
          <EmptyState
            icon={<School />}
            title="No school lessons yet"
            description={
              canEdit
                ? 'Upload a photo of your timetable and it will be read for you, or type the lessons in yourself.'
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
        </div>
        {dialogs}
      </ScheduleFrame>
    );
  }

  const todayDow = now.getDay();
  const current = isTimetableSynced ? lessonAt(lessons, todayDow, nowMinutes) : null;
  const next = nextLessonAfter(lessons, todayDow, nowMinutes);
  const left = current ? timeLeft(current.endTime) : null;
  const status = current
    ? `${current.isBreak ? 'On a break' : 'In class'}: ${current.subject}${left ? `, ${left}` : ''}`
    : next
      ? `Next: ${next.subject} at ${next.startTime}`
      : null;

  return (
    <ScheduleFrame
      tour="school-timetable-intro"
      title="School lessons"
      meta={[`${attended} ${attended === 1 ? 'lesson' : 'lessons'} a week`, status].filter(Boolean).join(' · ')}
      actions={
        <>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
            <Switch checked={isTimetableSynced} onCheckedChange={setIsTimetableSynced} aria-label="Follow my school day" />
            Follow my day
          </label>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setUploading(true)}>
                <Upload /> Upload photo
              </Button>
              <Button onClick={() => setEditing('new')}>
                <Plus /> Add lesson
              </Button>
            </>
          )}
        </>
      }
    >
      <WeekBoard
        label="Your school week"
        compact
        emptyLabel="No lessons"
        days={WEEK.map((day) => {
          const dayLessons = lessonsOn(lessons, day);
          const count = dayLessons.filter((lesson) => !lesson.isBreak).length;
          const bounds = schoolDayBounds(lessons, day);
          return {
            key: String(day),
            title: DAY_NAMES[day],
            isToday: isSameDay(dateOf(day), now),
            isWeekend: day === 0 || day === 6,
            summary: count && bounds ? `${count} lessons · ${bounds.start}–${bounds.end}` : undefined,
          };
        })}
        entries={lessons.map((lesson) => ({
          id: lesson.id,
          day: String(lesson.dayOfWeek),
          title: lesson.subject,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          kind: lesson.isBreak ? 'break' : 'school',
          state: current?.id === lesson.id ? 'active' : undefined,
          detail: current?.id === lesson.id ? timeLeft(lesson.endTime) ?? undefined : undefined,
        }))}
        renderActions={
          canEdit
            ? (entry) => {
                const lesson = lessons.find((item) => item.id === entry.id);
                return (
                  lesson && (
                    <>
                      <Button variant="outline" onClick={() => setEditing(lesson)}><Pencil /> Edit lesson</Button>
                      <Button variant="destructive" disabled={pending} onClick={() => setRemoving(lesson)}><Trash2 /> Remove lesson</Button>
                    </>
                  )
                );
              }
            : undefined
        }
      />
      {dialogs}
    </ScheduleFrame>
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
const NEW_SUBJECT = '__new__';

function LessonDialog({
  lesson,
  defaultDay,
  subjects,
  onClose,
}: {
  lesson: SchoolLesson | null;
  defaultDay: number;
  subjects: string[];
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
      : { dayOfWeek: defaultDay, startTime: '09:00', endTime: '10:00', subject: subjects[0] ?? '', isBreak: false }
  );
  // A lesson saved before this picker existed may name something that is not
  // in the subject list; keep it selectable rather than silently changing it.
  const legacy = lesson && !lesson.isBreak && !subjects.some((s) => normalizeSubject(s) === normalizeSubject(lesson.subject)) ? lesson.subject : null;
  const [choice, setChoice] = useState<string>(() => (form.isBreak ? subjects[0] ?? '' : form.subject) || (subjects.length === 0 ? NEW_SUBJECT : ''));
  const [newName, setNewName] = useState('');
  const creating = !form.isBreak && choice === NEW_SUBJECT;
  const subjectToSave = form.isBreak ? form.subject : creating ? newName : choice;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      let subject = subjectToSave.trim();
      if (creating && subject) {
        const existing = canonicalSubject(subject, subjects);
        if (subjects.includes(existing)) subject = existing;
        else {
          try {
            await addSubject(subject);
          } catch (e) {
            // Already a subject (e.g. in another year) is fine; anything else is not.
            if (!(e instanceof Error && /already exists/i.test(e.message))) {
              setError(e instanceof Error ? e.message : 'That subject could not be added');
              return;
            }
          }
        }
      }
      const input = { ...form, subject };
      const result = lesson
        ? await updateSchoolLesson(lesson.id, input)
        : await createSchoolLesson(input);
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
            <Label htmlFor="lesson-subject">{form.isBreak ? 'Name' : 'Subject'}</Label>
            {form.isBreak ? (
              <Input
                id="lesson-subject"
                value={form.subject}
                placeholder="e.g. Lunch"
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            ) : (
              <>
                <Select value={choice} onValueChange={setChoice}>
                  <SelectTrigger id="lesson-subject">
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    {legacy && <SelectItem value={legacy}>{legacy} (not in your subjects)</SelectItem>}
                    <SelectItem value={NEW_SUBJECT}>+ New subject…</SelectItem>
                  </SelectContent>
                </Select>
                {creating && (
                  <>
                    <Input
                      aria-label="New subject name"
                      value={newName}
                      placeholder="e.g. Kinyarwanda"
                      autoFocus
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {newName.trim() && subjects.includes(canonicalSubject(newName, subjects))
                        ? `You already have ${canonicalSubject(newName, subjects)}; the lesson will use it.`
                        : 'It will be added to your subjects too.'}
                    </p>
                  </>
                )}
              </>
            )}
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
          <Button onClick={submit} disabled={pending || !subjectToSave.trim()}>
            {pending ? 'Saving…' : lesson ? 'Save changes' : 'Add lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
