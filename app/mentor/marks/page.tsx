import { Award, CalendarClock, GraduationCap, Hourglass, TrendingDown, TrendingUp } from 'lucide-react';

import { requireMentorStudent, loadMentorExams } from '@/lib/mentor-data';
import { cleanSubject, dayLabel, marksSummary, relativeDay } from '@/lib/mentor-model';
import { Card, CardHead, Empty, Kpi, MarkChip, MentorHero, MentorPage, Meter } from '@/components/mentor/ui';
import { MarksTrendChart } from '@/components/mentor/charts';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { QUIZ: 'Quiz', TEST: 'Test', MIDTERM: 'Midterm', FINAL: 'Final', EXAM: 'Exam' };

/** Every marked exam, how marks move over time, by subject, and what is still to come. */
export default async function MentorMarks() {
  const student = await requireMentorStudent();
  const { today } = student;
  const exams = await loadMentorExams(student);
  const m = marksSummary(exams, today);

  const bySubject = new Map<string, number[]>();
  for (const e of m.marked) {
    const name = e.subject ? cleanSubject(e.subject) : 'Other';
    bySubject.set(name, [...(bySubject.get(name) ?? []), e.percent]);
  }
  const subjects = [...bySubject.entries()]
    .map(([subject, list]) => ({ subject, count: list.length, average: Math.round(list.reduce((s, p) => s + p, 0) / list.length), latest: list[0] }))
    .sort((a, b) => b.average - a.average);
  const trend = [...m.marked].reverse().map((e) => ({ day: e.day, percent: e.percent, title: e.title }));

  return (
    <MentorPage>
      <MentorHero
        eyebrow="Marks & exams"
        title={m.average === null ? 'No marks yet' : `Averaging ${m.average}%`}
        description={`${m.marked.length} marked · ${m.upcoming.length} coming up${m.awaiting.length ? ` · ${m.awaiting.length} waiting for a mark` : ''}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Average" value={m.average === null ? '–' : `${m.average}%`} icon={<GraduationCap />} sub={`${m.marked.length} marked`} />
        <Kpi
          label="Recent trend"
          value={m.trend === null ? '–' : `${m.trend > 0 ? '+' : m.trend < 0 ? '−' : ''}${Math.abs(m.trend)} pts`}
          icon={m.trend !== null && m.trend < 0 ? <TrendingDown /> : <TrendingUp />}
          tone={m.trend !== null && m.trend < 0 ? 'missed' : 'accent'}
          sub={m.trend === null ? 'Needs 4 marks' : 'latest 3 vs the 3 before'}
        />
        <Kpi label="Best" value={m.best ? `${m.best.percent}%` : '–'} icon={<Award />} tone="warn" sub={m.best ? m.best.title : ''} />
        <Kpi label="Next exam" value={m.upcoming[0] ? relativeDay(m.upcoming[0].day, today) : '–'} icon={<CalendarClock />} tone="primary" sub={m.upcoming[0]?.title ?? 'None set'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead title="Marks over time" hint="Each marked exam as a percentage; the dashed line is the average" icon={<TrendingUp />} />
          {trend.length < 2 ? <Empty icon={<TrendingUp />} title="Two marks are needed for a trend" /> : <MarksTrendChart data={trend} average={m.average} height={280} />}
        </Card>

        <Card className="xl:col-span-4">
          <CardHead title="By subject" hint="Average of each subject's marks" icon={<GraduationCap />} />
          {subjects.length === 0 ? (
            <Empty title="No marks yet" />
          ) : (
            <ul className="space-y-4">
              {subjects.map((s) => (
                <li key={s.subject}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{s.subject}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {s.count} {s.count === 1 ? 'mark' : 'marks'} <MarkChip percent={s.average} />
                    </span>
                  </div>
                  <Meter value={s.average} tone={s.average < 50 ? 'missed' : s.average < 65 ? 'warn' : 'accent'} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-8">
          <CardHead title="All marks" hint="Newest first" icon={<Award />} />
          {m.marked.length === 0 ? (
            <Empty icon={<GraduationCap />} title="No marks yet">Marks appear here once results are entered.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pl-2 font-semibold">Exam</th>
                    <th className="pb-2 font-semibold">Subject</th>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Score</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {m.marked.map((e) => (
                    <tr key={e.id} className="border-t border-border/60">
                      <td className="py-3 pl-2">
                        <p className="font-semibold">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.category ?? KIND[e.kind] ?? 'Exam'}</p>
                      </td>
                      <td className="py-3 text-muted-foreground">{e.subject ? cleanSubject(e.subject) : '–'}</td>
                      <td className="py-3 tabular-nums text-muted-foreground">{dayLabel(e.day)}</td>
                      <td className="py-3 tabular-nums">{fmt(e.score)} / {fmt(e.maxScore)}</td>
                      <td className="py-3 pr-2 text-right"><MarkChip percent={e.percent} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5 xl:col-span-4">
          <Card>
            <CardHead title="Coming up" icon={<CalendarClock />} />
            {m.upcoming.length === 0 ? (
              <Empty title="No exams set" />
            ) : (
              <ul className="space-y-2">
                {m.upcoming.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 leading-none text-primary">
                      <span className="font-heading text-base font-bold">{Number(e.day.slice(8))}</span>
                      <span className="mt-0.5 text-[10px] font-semibold uppercase">{dayLabel(e.day).slice(-3)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.category ?? KIND[e.kind] ?? 'Exam'}{e.subject ? ` · ${cleanSubject(e.subject)}` : ''}{e.startTime ? ` · ${e.startTime}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">{relativeDay(e.day, today)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {m.awaiting.length > 0 && (
            <Card>
              <CardHead title="Waiting for a mark" hint="Sat, no result entered yet" icon={<Hourglass />} />
              <ul className="space-y-2 text-sm">
                {m.awaiting.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dayLabel(e.day)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </MentorPage>
  );
}

const fmt = (n: number | null) => (n === null ? '–' : Number.isInteger(n) ? String(n) : n.toFixed(1));
