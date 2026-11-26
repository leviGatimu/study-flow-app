import Link from 'next/link';
import { ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Timer } from 'lucide-react';

import { requireMentorStudent, loadMentorExams, loadMentorHomework, loadMentorTasks } from '@/lib/mentor-data';
import { addDays, blockMinutes, blockStatus, cleanSubject, dayLabel, hoursMinutes, mondayOf, periodSummary } from '@/lib/mentor-model';
import { Kpi, Legend, MentorHero, MentorPage, StatusPill, statusBorder } from '@/components/mentor/ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** One week, Monday to Sunday: every study block and where it stands, day by day. */
export default async function MentorWeek({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const student = await requireMentorStudent();
  const { today } = student;
  const asked = (await searchParams).week;
  const monday = mondayOf(asked && KEY.test(asked) ? asked : today);
  const sunday = addDays(monday, 6);
  const isThisWeek = monday === mondayOf(today);

  const [tasks, exams, homework] = await Promise.all([loadMentorTasks(student, monday, sunday), loadMentorExams(student), loadMentorHomework(student)]);
  const summary = periodSummary(tasks, monday, sunday, today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sameMonth = monday.slice(5, 7) === sunday.slice(5, 7);
  const title = `${sameMonth ? Number(monday.slice(8)) : dayLabel(monday).slice(4)} – ${dayLabel(sunday).slice(4)} ${sunday.slice(0, 4)}`;

  return (
    <MentorPage>
      <MentorHero
        eyebrow={isThisWeek ? 'This week' : monday < today ? 'A past week' : 'A week ahead'}
        title={title}
        description={
          tasks.length
            ? `${tasks.length} study blocks planned, ${hoursMinutes(tasks.reduce((s, t) => s + blockMinutes(t.startTime, t.endTime), 0))} in all.`
            : 'Nothing planned this week.'
        }
        actions={
          <div className="flex items-center gap-1.5">
            <NavButton href={`/mentor/schedule?week=${addDays(monday, -7)}`} label="Previous week"><ChevronLeft className="size-4" /></NavButton>
            {!isThisWeek && (
              <Button asChild variant="outline" size="sm">
                <Link href="/mentor/schedule">This week</Link>
              </Button>
            )}
            <NavButton href={`/mentor/schedule?week=${addDays(monday, 7)}`} label="Next week"><ChevronRight className="size-4" /></NavButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Studied" value={hoursMinutes(summary.doneMinutes)} sub={`of ${hoursMinutes(summary.plannedMinutes)} due so far`} />
        <Kpi label="Kept" value={summary.completion === null ? '–' : `${summary.completion}%`} sub={`${summary.blocksDone} of ${summary.blocksDue} blocks due`} />
        <Kpi label="Missed" value={summary.blocksMissed} tone="missed" sub={summary.blocksMissed === 1 ? 'block' : 'blocks'} />
        <Kpi label="Focus mode" value={hoursMinutes(summary.focusMinutes)} tone="primary" icon={<Timer />} sub="time in focus" />
      </div>

      <Legend
        items={[
          { label: 'Done', className: 'bg-[var(--m-accent)]' },
          { label: 'Missed', className: 'bg-[var(--m-missed)]' },
          { label: 'Today', className: 'bg-[var(--m-warn)]' },
          { label: 'Coming up', className: 'bg-border' },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {days.map((day) => {
          const blocks = tasks.filter((t) => t.day === day);
          const dayExams = exams.filter((e) => e.day === day);
          const due = homework.filter((h) => h.due === day && !h.isCompleted);
          const done = blocks.filter((t) => t.isDone).reduce((s, t) => s + blockMinutes(t.startTime, t.endTime), 0);
          const isToday = day === today;
          return (
            <section
              key={day}
              aria-label={dayLabel(day)}
              className={cn('flex min-w-0 flex-col rounded-2xl border bg-card p-3 shadow-sm', isToday ? 'border-primary/40 ring-2 ring-primary/15' : 'border-border/60')}
            >
              <header className="flex items-baseline justify-between gap-2 px-1.5 pb-3 pt-1">
                <div>
                  <p className={cn('text-xs font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>{isToday ? 'Today' : dayLabel(day).slice(0, 3)}</p>
                  <p className="font-heading text-xl font-bold">{Number(day.slice(8))}</p>
                </div>
                {blocks.length > 0 && <p className="text-xs tabular-nums text-muted-foreground">{hoursMinutes(done)} done</p>}
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {dayExams.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-primary">
                    <GraduationCap className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate text-xs font-semibold">{e.title}{e.startTime ? ` · ${e.startTime}` : ''}</span>
                  </div>
                ))}
                {due.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 rounded-2xl bg-[var(--m-warn)]/14 px-3 py-2 text-[var(--m-warn)]">
                    <ClipboardList className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate text-xs font-semibold">Due: {h.title}</span>
                  </div>
                ))}
                {blocks.length === 0 && dayExams.length === 0 && (
                  <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">Free day</p>
                )}
                {blocks.map((t) => {
                  const status = blockStatus(t, today);
                  return (
                    <div key={t.id} className={cn('rounded-2xl border border-l-4 border-border/60 bg-background/60 px-3 py-2.5', statusBorder(status))}>
                      <p className="truncate text-sm font-semibold">{cleanSubject(t.subject)}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {t.startTime}–{t.endTime} · {hoursMinutes(blockMinutes(t.startTime, t.endTime))}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusPill status={status} />
                        {/revision/i.test(t.subject) || t.type === 'REVISION' ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Revision</span>
                        ) : null}
                        {t.focusMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Timer className="size-3" aria-hidden />
                            {hoursMinutes(t.focusMinutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </MentorPage>
  );
}

function NavButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="icon-sm" aria-label={label}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
