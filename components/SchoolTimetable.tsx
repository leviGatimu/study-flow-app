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
import {
  Zap,
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
import { PageHeader } from '@/components/ui/page-header';
import { PageBody } from '@/components/ui/page';
import { ScheduleBoard } from '@/components/ScheduleBoard';
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

  const header = (
    <div data-tour="school-timetable-intro">
      <PageHeader
        className="pt-7 pb-5 [&_h1]:text-3xl [&_h1]:font-semibold"
        title="School lessons"
        description={
          yearLabel
            ? `The lessons you attend in ${yearLabel}. Upload your timetable or add lessons by hand.`
            : 'The lessons you attend. Upload your timetable or add lessons by hand.'
        }
        meta={hasLessons ? `${attended} ${attended === 1 ? 'lesson' : 'lessons'} each week` : undefined}
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
  return (
    <>
      {header}
      <PageBody className="space-y-6 pt-6">
        <NowCard
          current={current}
          next={next}
          bounds={todayBounds}
          nowMinutes={nowMinutes}
          tracking={isTimetableSynced}
          timeLeft={timeLeft}
        />

        <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-border/60 pb-5">
          <span className="flex items-center gap-2">
            <Zap className="size-4 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Follow my school day</span>
              <span id="lesson-tracking-help" className="block text-xs text-muted-foreground">
                Highlight the current lesson and show the time left until the bell.
              </span>
            </span>
          </span>
          <Switch
            checked={isTimetableSynced}
            onCheckedChange={setIsTimetableSynced}
            aria-describedby="lesson-tracking-help"
          />
        </label>

        <ScheduleBoard
          title="Your school week"
          description="Select a lesson or break for details and editing"
          emptyLabel="No lessons"
          schoolWeek
          nowMinutes={isTimetableSynced ? nowMinutes : undefined}
          days={WEEK.map((day) => {
            const dayLessons = lessonsOn(lessons, day);
            const count = dayLessons.filter((lesson) => !lesson.isBreak).length;
            const bounds = schoolDayBounds(lessons, day);
            return {
              key: String(day),
              title: DAY_NAMES[day],
              isToday: isSameDay(dateOf(day), now),
              isWeekend: day === 0 || day === 6,
              summary: count && bounds ? `${count} lessons · ${formatDuration(toMinutes(bounds.end) - toMinutes(bounds.start))}` : 'Day off',
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
          renderActions={canEdit ? (entry) => {
            const lesson = lessons.find((item) => item.id === entry.id);
            return lesson && <>
              <Button variant="outline" onClick={() => setEditing(lesson)}><Pencil /> Edit lesson</Button>
              <Button variant="destructive" disabled={pending} onClick={() => setRemoving(lesson)}><Trash2 /> Remove lesson</Button>
            </>;
          } : undefined}
        />
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
 * A compact status strip leaves the timetable as the page's main surface.
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
  const title = current?.subject ?? (next ? next.subject : bounds && nowMinutes >= toMinutes(bounds.end) ? "School’s out for today" : 'No school today');
  const label = current ? (current.isBreak ? 'On a break' : 'In class now') : next ? 'Up next' : 'Today';
  const detail = current
    ? `${current.startTime} – ${current.endTime}${next ? ` · Next: ${next.subject} at ${next.startTime}` : ''}`
    : next ? `${next.startTime} – ${next.endTime}` : bounds ? `School day · ${bounds.start} – ${bounds.end}` : 'A little breathing room in your week';
  return (
    <section aria-label="School status" className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><School className="size-5" /></div>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">{current && <span className="size-1.5 rounded-full bg-primary" />}{label}</p>
          <p className="text-lg font-semibold leading-snug">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {current ? <div className="ml-14 shrink-0 sm:ml-0 sm:text-right"><p className="text-xl font-medium tabular-nums">{timeLeft(current.endTime)?.replace(' left', '') ?? '0m'}</p><p className="mt-1 text-xs text-muted-foreground">until the bell</p></div> : !tracking && <p className="text-xs text-muted-foreground">Live tracking is off</p>}
    </section>
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
