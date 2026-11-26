import { CalendarCheck, CheckCircle2, Clock, History, Timer, TrendingUp, XCircle } from 'lucide-react';

import { requireMentorStudent, loadMentorTasks } from '@/lib/mentor-data';
import { addDays, blockMinutes, blockStatus, cleanSubject, dailySeries, dayLabel, hoursMinutes, periodSummary, relativeDay } from '@/lib/mentor-model';
import { Card, CardHead, Empty, Kpi, Legend, MentorHero, MentorPage, Segmented, StatusPill } from '@/components/mentor/ui';
import { StudyTimeChart } from '@/components/mentor/charts';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;
const SHOW = ['all', 'done', 'missed'] as const;

/** Everything the student did (and did not do), day by day, newest first. */
export default async function MentorLog({ searchParams }: { searchParams: Promise<{ days?: string; show?: string }> }) {
  const student = await requireMentorStudent();
  const { today } = student;
  const params = await searchParams;
  const days = RANGES.find((r) => String(r) === params.days) ?? 30;
  const show = SHOW.find((s) => s === params.show) ?? 'all';
  const from = addDays(today, -(days - 1));

  const tasks = await loadMentorTasks(student, from, today);
  const summary = periodSummary(tasks, from, today, today);
  const series = dailySeries(tasks, from, today, today);

  const shown = tasks
    .map((t) => ({ ...t, status: blockStatus(t, today) }))
    .filter((t) => t.status === 'done' || t.status === 'missed' || t.status === 'today')
    .filter((t) => show === 'all' || t.status === show);
  const byDay = new Map<string, typeof shown>();
  for (const t of shown) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t]);
  const dayKeys = [...byDay.keys()].sort().reverse();
  const href = (d: number, s: string) => `/mentor/log?days=${d}${s === 'all' ? '' : `&show=${s}`}`;

  return (
    <MentorPage>
      <MentorHero
        eyebrow="Study log"
        title={`The last ${days} days`}
        description="Every study block, whether it was done, and the time spent in focus mode."
        actions={
          <>
            <Segmented value={String(days)} options={RANGES.map((r) => ({ label: `${r} days`, value: String(r), href: href(r, show) }))} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Studied" value={hoursMinutes(summary.doneMinutes)} icon={<Clock />} sub={`of ${hoursMinutes(summary.plannedMinutes)} planned`} />
        <Kpi label="Blocks kept" value={summary.completion === null ? '–' : `${summary.completion}%`} icon={<CheckCircle2 />} sub={`${summary.blocksDone} of ${summary.blocksDue}`} />
        <Kpi label="Missed" value={summary.blocksMissed} icon={<XCircle />} tone="missed" sub={summary.blocksMissed === 1 ? 'block' : 'blocks'} />
        <Kpi label="Focus mode" value={hoursMinutes(summary.focusMinutes)} icon={<Timer />} tone="primary" sub="time in focus" />
        <Kpi label="Days studied" value={`${summary.activeDays}/${days}`} icon={<CalendarCheck />} tone="warn" sub="with a block done" />
        <Kpi
          label="Per study day"
          value={summary.activeDays ? hoursMinutes(summary.doneMinutes / summary.activeDays) : '–'}
          icon={<TrendingUp />}
          sub="on days studied"
        />
      </div>

      <Card>
        <CardHead title="Study time per day" icon={<TrendingUp />} right={<Legend items={[{ label: 'Done', className: 'bg-[var(--m-accent)]' }, { label: 'Missed', className: 'bg-[var(--m-missed)]' }, { label: 'Still to do', className: 'bg-[var(--m-planned)]' }]} />} />
        <StudyTimeChart data={series} today={today} height={240} />
      </Card>

      <Card>
        <CardHead
          title="Day by day"
          hint="Newest first"
          icon={<History />}
          right={<Segmented value={show} options={SHOW.map((s) => ({ label: s === 'all' ? 'All' : s === 'done' ? 'Done' : 'Missed', value: s, href: href(days, s) }))} />}
        />
        {dayKeys.length === 0 ? (
          <Empty icon={<History />} title={show === 'missed' ? 'Nothing missed' : 'No study blocks in this time'} />
        ) : (
          <div className="space-y-6">
            {dayKeys.map((day) => {
              const rows = byDay.get(day)!;
              const done = rows.filter((t) => t.status === 'done');
              const minutes = done.reduce((s, t) => s + blockMinutes(t.startTime, t.endTime), 0);
              return (
                <div key={day} className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="flex items-baseline gap-3 lg:block">
                    <p className="font-heading text-base font-semibold">{dayLabel(day)}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDay(day, today)} · {hoursMinutes(minutes)} · {done.length}/{rows.length} done
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {rows.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border p-3',
                          t.status === 'missed' ? 'border-[var(--m-missed)]/25 bg-[var(--m-missed)]/5' : 'border-border/60'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{cleanSubject(t.subject)}</p>
                          <p className="truncate text-xs tabular-nums text-muted-foreground">
                            {t.startTime}–{t.endTime} · {hoursMinutes(blockMinutes(t.startTime, t.endTime))}
                            {t.focusMinutes > 0 ? ` · ${hoursMinutes(t.focusMinutes)} in focus` : ''}
                          </p>
                        </div>
                        <StatusPill status={t.status} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </MentorPage>
  );
}
