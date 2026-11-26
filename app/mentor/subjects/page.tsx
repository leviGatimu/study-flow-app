import { BookOpen, CalendarClock, GraduationCap, Timer } from 'lucide-react';

import { requireMentorStudent, loadMentorExams, loadMentorTasks } from '@/lib/mentor-data';
import { addDays, dayLabel, hoursMinutes, mondayOf, relativeDay, subjectRows } from '@/lib/mentor-model';
import { Card, Empty, MarkChip, MentorHero, MentorPage, Meter, Segmented } from '@/components/mentor/ui';
import { WeekBars } from '@/components/mentor/blocks';

export const dynamic = 'force-dynamic';

const RANGES = [30, 90] as const;

/** One card per subject: time put in, blocks kept, marks and what is next. */
export default async function MentorSubjects({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const student = await requireMentorStudent();
  const { today } = student;
  const asked = (await searchParams).days;
  const days = RANGES.find((r) => String(r) === asked) ?? 30;
  const from = addDays(today, -(days - 1));
  // The weekly bars need six whole weeks whatever the range.
  const sixWeeks = addDays(mondayOf(today), -35);

  const [tasks, exams] = await Promise.all([loadMentorTasks(student, from < sixWeeks ? from : sixWeeks, today), loadMentorExams(student)]);
  const rows = subjectRows(tasks, exams, from, today);
  const total = rows.reduce((s, r) => s + r.doneMinutes, 0);

  return (
    <MentorPage>
      <MentorHero
        eyebrow="Subjects"
        title={`${rows.length} ${rows.length === 1 ? 'subject' : 'subjects'}`}
        description={`${hoursMinutes(total)} studied in the last ${days} days. Bars show the last six weeks, this week on the right.`}
        actions={<Segmented value={String(days)} options={RANGES.map((r) => ({ label: `${r} days`, value: String(r), href: `/mentor/subjects?days=${r}` }))} />}
      />

      {rows.length === 0 ? (
        <Card><Empty icon={<BookOpen />} title="No subjects yet">Subjects appear once study blocks or exams are added.</Empty></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((s) => {
            const share = total ? Math.round((s.doneMinutes / total) * 100) : 0;
            return (
              <Card key={s.subject} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-lg font-bold">{s.subject}</h2>
                    <p className="text-xs text-muted-foreground">
                      {s.lastStudied ? `Last studied ${relativeDay(s.lastStudied, today).toLowerCase()}` : 'Not studied in this time'}
                    </p>
                  </div>
                  {s.average !== null ? <MarkChip percent={s.average} className="text-base" /> : null}
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-heading text-3xl font-bold tabular-nums">{hoursMinutes(s.doneMinutes)}</p>
                    <p className="text-xs text-muted-foreground">{share}% of all study · of {hoursMinutes(s.plannedMinutes)} planned</p>
                  </div>
                  <div className="w-28 shrink-0">
                    <WeekBars weeks={s.weekly} />
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Blocks kept</span>
                    <span className="font-semibold tabular-nums">
                      {s.completion === null ? 'none due' : `${s.completion}% · ${s.blocksDone} done, ${s.blocksMissed} missed`}
                    </span>
                  </div>
                  <Meter value={s.completion} tone={s.completion !== null && s.completion < 50 ? 'missed' : 'accent'} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Timer className="size-3.5 text-primary" aria-hidden />
                    <dt className="sr-only">Focus mode</dt>
                    <dd>{s.focusMinutes ? `${hoursMinutes(s.focusMinutes)} in focus` : 'No focus time'}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-3.5 text-primary" aria-hidden />
                    <dt className="sr-only">Marks</dt>
                    <dd>{s.marks ? `${s.marks} ${s.marks === 1 ? 'mark' : 'marks'}` : 'No marks yet'}</dd>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <CalendarClock className="size-3.5 text-[var(--m-warn)]" aria-hidden />
                    <dt className="sr-only">Next exam</dt>
                    <dd className="truncate">{s.nextExam ? `Next exam: ${s.nextExam.title}, ${dayLabel(s.nextExam.day)} (${relativeDay(s.nextExam.day, today).toLowerCase()})` : 'No exam set'}</dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </MentorPage>
  );
}
