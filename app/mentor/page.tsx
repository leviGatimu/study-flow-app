import Link from 'next/link';
import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, Clock, FileText, Flame, GraduationCap, History, Sparkles, Timer, TrendingUp } from 'lucide-react';

import { requireMentorStudent, loadMentorExams, loadMentorHomework, loadMentorTasks } from '@/lib/mentor-data';
import {
  addDays,
  blockStatus,
  changeLabel,
  cleanSubject,
  dailySeries,
  dayLabel,
  heatmap,
  homeworkBuckets,
  hoursMinutes,
  marksSummary,
  mondayOf,
  periodSummary,
  relativeDay,
  subjectRows,
} from '@/lib/mentor-model';
import { loadReports } from '@/lib/report-load';
import type { ReportData } from '@/lib/report-model';
import { Card, CardHead, Empty, Kpi, Legend, MarkChip, MentorHero, MentorPage, Meter, Ring, StatusPill } from '@/components/mentor/ui';
import { Heatmap, HeatLegend } from '@/components/mentor/blocks';
import { StudyTimeChart } from '@/components/mentor/charts';
import { Button } from '@/components/ui/button';
import { ReportRow } from '@/components/mentor/ReportRow';

export const dynamic = 'force-dynamic';

const HEAT_WEEKS = 18;

/** The mentor's home: everything at a glance, each card leading to its own page. */
export default async function MentorOverview() {
  const student = await requireMentorStudent();
  const { today } = student;
  const monday = mondayOf(today);
  const from = addDays(monday, -7 * (HEAT_WEEKS - 1));

  const [tasks, exams, homework, reports] = await Promise.all([
    loadMentorTasks(student, from, addDays(monday, 6)),
    loadMentorExams(student),
    loadMentorHomework(student),
    loadReports(student.studentId).catch((error) => {
      console.error('Mentor overview: reports failed', error);
      return { daily: [] as ReportData[], weekly: [] as ReportData[] };
    }),
  ]);

  const week = periodSummary(tasks, monday, addDays(monday, 6), today);
  const lastWeek = periodSummary(tasks, addDays(monday, -7), addDays(monday, -1), today);
  // Last week up to the same weekday, so Thursday is compared with Thursday.
  const lastWeekSoFar = periodSummary(tasks, addDays(monday, -7), addDays(today, -7), today);
  const hadLastWeek = lastWeek.plannedMinutes > 0;
  const series = dailySeries(tasks, addDays(today, -29), today, today);
  const month = periodSummary(tasks, addDays(today, -29), today, today);
  const subjects = subjectRows(tasks, exams, addDays(today, -29), today).slice(0, 7);
  const marks = marksSummary(exams, today);
  const hw = homeworkBuckets(homework, today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => {
    const rows = tasks.filter((t) => t.day === day);
    return { day, total: rows.length, done: rows.filter((t) => t.isDone).length, missed: rows.filter((t) => blockStatus(t, today) === 'missed').length };
  });
  const recent = tasks
    .filter((t) => ['done', 'missed'].includes(blockStatus(t, today)))
    .sort((a, b) => (b.day + b.startTime).localeCompare(a.day + a.startTime))
    .slice(0, 8);
  const comingUp = [
    ...marks.upcoming.slice(0, 4).map((e) => ({ kind: 'exam' as const, id: e.id, title: e.title, subject: e.subject, day: e.day })),
    ...[...hw.late, ...hw.soon].slice(0, 4).map((h) => ({ kind: 'homework' as const, id: h.id, title: h.title, subject: h.subject, day: h.due })),
  ].sort((a, b) => a.day.localeCompare(b.day));

  const first = student.name.split(/\s+/)[0];
  const verdict = summarySentence(first, week.completion, week.doneMinutes, hadLastWeek ? lastWeekSoFar.doneMinutes : null);
  const openHomework = hw.late.length + hw.soon.length + hw.later.length;

  return (
    <MentorPage>
      <MentorHero
        eyebrow={`Overview · ${dayLabel(today)}`}
        title={`How ${first} is doing`}
        description={verdict}
        actions={
          <>
            <Button asChild>
              <Link href="/mentor/reports">
                <FileText /> Read reports
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mentor/schedule">
                <CalendarClock /> This week
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          label="Studied this week"
          value={hoursMinutes(week.doneMinutes)}
          icon={<Clock />}
          change={hadLastWeek ? changeLabel(week.doneMinutes, lastWeekSoFar.doneMinutes) : null}
          sub={hadLastWeek ? 'vs this point last week' : `of ${hoursMinutes(week.plannedMinutes)} planned`}
        />
        <Kpi
          label="Blocks done"
          value={`${week.blocksDone}/${week.blocksDue}`}
          icon={<CheckCircle2 />}
          sub={week.completion === null ? 'Nothing due yet this week' : `${week.completion}% done · ${week.blocksMissed} missed`}
        />
        <Kpi label="Focus time" value={hoursMinutes(week.focusMinutes)} icon={<Timer />} tone="primary" sub="in focus mode this week" />
        <Kpi label="Streak" value={`${student.currentStreak} ${student.currentStreak === 1 ? 'day' : 'days'}`} icon={<Flame />} tone="warn" sub={`Best: ${student.longestStreak} days`} />
        <Kpi
          label="Average mark"
          value={marks.average === null ? '–' : `${marks.average}%`}
          icon={<GraduationCap />}
          tone="primary"
          change={marks.trend === null ? null : { text: `${marks.trend > 0 ? '+' : marks.trend < 0 ? '−' : ''}${Math.abs(marks.trend)} pts`, up: marks.trend === 0 ? null : marks.trend > 0 }}
          sub={marks.marked.length ? `${marks.marked.length} marked` : 'No marks yet'}
        />
        <Kpi
          label="Homework"
          value={`${openHomework} open`}
          icon={<ClipboardList />}
          tone={hw.late.length ? 'missed' : 'accent'}
          sub={hw.late.length ? `${hw.late.length} late · ${hw.soon.length} due soon` : `${hw.soon.length} due in 3 days`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            title="Study time, last 30 days"
            hint={`${hoursMinutes(month.doneMinutes)} done of ${hoursMinutes(month.plannedMinutes)} planned · studied on ${month.activeDays} of 30 days`}
            icon={<TrendingUp />}
            href="/mentor/log"
            linkLabel="Study log"
          />
          <StudyTimeChart data={series} today={today} height={340} />
          <div className="mt-3">
            <Legend items={[{ label: 'Done', className: 'bg-[var(--m-accent)]' }, { label: 'Missed', className: 'bg-[var(--m-missed)]' }, { label: 'Still to do', className: 'bg-[var(--m-planned)]' }]} />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead title="This week" hint="Monday to Sunday" icon={<CalendarClock />} href="/mentor/schedule" linkLabel="Open week" />
          <div className="flex items-center gap-5">
            <Ring value={week.completion} label="done" />
            <div className="min-w-0 space-y-1 text-sm">
              <p><span className="font-heading text-lg font-bold">{hoursMinutes(week.doneMinutes)}</span> <span className="text-muted-foreground">studied</span></p>
              <p className="text-muted-foreground">{week.blocksDone} done · {week.blocksMissed} missed</p>
              {hadLastWeek && <p className="text-muted-foreground">Last week: {hoursMinutes(lastWeek.doneMinutes)}</p>}
            </div>
          </div>
          <ul className="mt-5 space-y-1.5">
            {weekDays.map((d) => (
              <li key={d.day} className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 text-sm ${d.day === today ? 'bg-primary/8 ring-1 ring-primary/20' : ''}`}>
                <span className={`w-10 shrink-0 font-medium ${d.day === today ? 'text-primary' : 'text-muted-foreground'}`}>{dayLabel(d.day).slice(0, 3)}</span>
                <div className="flex flex-1 gap-1">
                  {d.total === 0 ? (
                    <span className="text-xs text-muted-foreground">Nothing planned</span>
                  ) : (
                    Array.from({ length: d.total }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 flex-1 rounded-full ${i < d.done ? 'bg-[var(--m-accent)]' : i < d.done + d.missed ? 'bg-[var(--m-missed)]' : 'bg-[var(--m-planned)]'}`}
                      />
                    ))
                  )}
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{d.total ? `${d.done}/${d.total}` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-8">
          <CardHead title="Subjects, last 30 days" hint="Time done, how many blocks were kept, and marks" icon={<BookOpen />} href="/mentor/subjects" />
          {subjects.length === 0 ? (
            <Empty icon={<BookOpen />} title="No subjects studied yet">Blocks appear here once they are on the schedule.</Empty>
          ) : (
            <div className="space-y-1">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_72px_64px] gap-4 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Subject</span>
                <span>Blocks kept</span>
                <span className="text-right">Time</span>
                <span className="text-right">Mark</span>
              </div>
              {subjects.map((s) => (
                <div key={s.subject} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-2 py-2.5 hover:bg-muted/50 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_72px_64px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.lastStudied ? `Last studied ${relativeDay(s.lastStudied, today).toLowerCase()}` : 'Not studied yet'}</p>
                  </div>
                  <span className="text-right font-heading text-sm font-bold tabular-nums sm:order-3">{hoursMinutes(s.doneMinutes)}</span>
                  <div className="col-span-2 flex items-center gap-3 sm:order-2 sm:col-span-1">
                    <Meter value={s.completion} tone={s.completion !== null && s.completion < 50 ? 'missed' : 'accent'} />
                    <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.completion === null ? 'none due' : `${s.completion}% · ${s.blocksDone}/${s.blocksDone + s.blocksMissed}`}
                    </span>
                  </div>
                  <span className="hidden text-right sm:order-4 sm:block">{s.average === null ? <span className="text-xs text-muted-foreground">–</span> : <MarkChip percent={s.average} />}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHead title="Coming up" hint="Exams and homework due" icon={<Sparkles />} href="/mentor/marks" linkLabel="Exams" />
          {comingUp.length === 0 ? (
            <Empty icon={<CalendarClock />} title="Nothing due soon" />
          ) : (
            <ul className="space-y-2">
              {comingUp.slice(0, 7).map((item) => {
                const late = item.kind === 'homework' && item.day < today;
                return (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                    <DateTile day={item.day} tone={item.kind === 'exam' ? 'primary' : late ? 'missed' : 'accent'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.kind === 'exam' ? 'Exam' : 'Homework'}
                        {item.subject ? ` · ${cleanSubject(item.subject)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${late ? 'text-[var(--m-missed)]' : 'text-muted-foreground'}`}>{late ? 'Late' : relativeDay(item.day, today)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-7">
          <CardHead title="Consistency" hint={`Study time each day, last ${HEAT_WEEKS} weeks`} icon={<Flame />} right={<HeatLegend />} />
          <Heatmap weeks={heatmap(tasks, today, HEAT_WEEKS)} />
        </Card>

        <Card className="xl:col-span-5">
          <CardHead title="Latest reports" hint="Graded automatically each day and week" icon={<FileText />} href="/mentor/reports" />
          {reports.weekly.length + reports.daily.length === 0 ? (
            <Empty icon={<FileText />} title="No reports yet">A report is written on any day with study blocks.</Empty>
          ) : (
            <div className="space-y-2">
              {[...reports.weekly.slice(0, 1), ...reports.daily.slice(0, 3)].map((r) => (
                <ReportRow key={`${r.kind}-${r.id}`} report={r} />
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-12">
          <CardHead title="Recent study blocks" hint="The latest blocks done or missed" icon={<History />} href="/mentor/log" linkLabel="Full log" />
          {recent.length === 0 ? (
            <Empty icon={<History />} title="No study blocks yet" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{cleanSubject(t.subject)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dayLabel(t.day)} · {t.startTime}–{t.endTime}
                      {t.focusMinutes > 0 ? ` · ${hoursMinutes(t.focusMinutes)} focus` : ''}
                    </p>
                  </div>
                  <StatusPill status={blockStatus(t, today)} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MentorPage>
  );
}

function DateTile({ day, tone }: { day: string; tone: 'primary' | 'missed' | 'accent' }) {
  const cls = { primary: 'bg-primary/10 text-primary', missed: 'bg-[var(--m-missed)]/12 text-[var(--m-missed)]', accent: 'bg-[var(--m-accent)]/12 text-[var(--m-accent)]' }[tone];
  return (
    <span className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${cls}`}>
      <span className="font-heading text-base font-bold">{Number(day.slice(8))}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase">{dayLabel(day).slice(-3)}</span>
    </span>
  );
}

function summarySentence(name: string, completion: number | null, doneMinutes: number, lastWeekSoFar: number | null): string {
  if (completion === null) return `${name} has nothing due yet this week. The schedule and past weeks are below.`;
  const pace =
    lastWeekSoFar === null
      ? ''
      : doneMinutes > lastWeekSoFar
        ? ', ahead of last week at this point'
        : doneMinutes < lastWeekSoFar
          ? ', behind last week at this point'
          : ', level with last week';
  const mood = completion >= 80 ? 'A strong week so far' : completion >= 50 ? 'A steady week so far' : 'A slow week so far';
  return `${mood}: ${completion}% of this week's study blocks done and ${hoursMinutes(doneMinutes)} studied${pace}.`;
}
