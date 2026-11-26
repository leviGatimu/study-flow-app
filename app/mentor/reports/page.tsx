import { CheckCircle2, ClipboardCheck, Download, FileText, Flame, Lightbulb, Star, XCircle } from 'lucide-react';

import { requireMentorStudent } from '@/lib/mentor-data';
import { changeLabel, hoursMinutes } from '@/lib/mentor-model';
import { loadReports } from '@/lib/report-load';
import { filedReportUrls } from '@/lib/report-filing';
import type { ReportData } from '@/lib/report-model';
import { Card, CardHead, Change, Empty, MentorHero, MentorPage, Meter, Segmented } from '@/components/mentor/ui';
import { ReportRow } from '@/components/mentor/ReportRow';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Every graded daily and weekly report: the list on the left, one in full on the right. */
export default async function MentorReports({ searchParams }: { searchParams: Promise<{ view?: string; r?: string }> }) {
  const student = await requireMentorStudent();
  const params = await searchParams;
  const view = params.view === 'weekly' ? 'weekly' : 'daily';

  let daily: ReportData[] = [];
  let weekly: ReportData[] = [];
  let urls: Record<string, string> = {};
  let failed = false;
  try {
    const loaded = await loadReports(student.studentId);
    daily = loaded.daily;
    weekly = loaded.weekly;
    urls = await filedReportUrls(student.studentId, loaded.scope);
  } catch (error) {
    console.error('Mentor reports failed to load', error);
    failed = true;
  }

  const list = view === 'weekly' ? weekly : daily;
  const selected = list.find((r) => r.id === params.r) ?? list[0] ?? null;
  const pdf = selected ? (urls[`${selected.kind === 'daily' ? 'Daily' : 'Weekly'}/${selected.fileName}`] ?? null) : null;
  const avgScore = list.length ? Math.round(list.slice(0, 7).reduce((s, r) => s + r.score, 0) / Math.min(7, list.length)) : null;

  return (
    <MentorPage>
      <MentorHero
        eyebrow="Reports"
        title={`${student.name.split(/\s+/)[0]}'s reports`}
        description="Study Flow grades each day and each week from the study blocks planned and done. Pick one to read it in full."
        actions={
          <Segmented
            value={view}
            options={[
              { label: `Daily (${daily.length})`, value: 'daily', href: '/mentor/reports?view=daily' },
              { label: `Weekly (${weekly.length})`, value: 'weekly', href: '/mentor/reports?view=weekly' },
            ]}
          />
        }
      />

      {failed ? (
        <Card><Empty icon={<FileText />} title="The reports could not be loaded">Reload the page to try again.</Empty></Card>
      ) : list.length === 0 || !selected ? (
        <Card>
          <Empty icon={<FileText />} title={view === 'weekly' ? 'No weekly reports yet' : 'No daily reports yet'}>
            {view === 'weekly' ? 'A weekly report is written after each full week of study blocks.' : 'A report is written on any day with study blocks.'}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-4 2xl:col-span-3">
            <CardHead title={view === 'weekly' ? 'Weeks' : 'Days'} hint={avgScore === null ? undefined : `Average score of the latest ${Math.min(7, list.length)}: ${avgScore}/100`} icon={<FileText />} />
            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {list.map((r) => (
                <ReportRow key={r.id} report={r} active={r.id === selected.id} />
              ))}
            </div>
          </Card>
          <div className="min-w-0 xl:col-span-8 2xl:col-span-9">
            <ReportDetail report={selected} pdf={pdf} />
          </div>
        </div>
      )}
    </MentorPage>
  );
}

function ReportDetail({ report: r, pdf }: { report: ReportData; pdf: string | null }) {
  // Against the student's usual: the mean of the reports before this one.
  const vs = changeLabel(r.doneMinutes, r.averageMinutes);
  const kept = r.blocksTotal ? Math.round((r.blocksDone / r.blocksTotal) * 100) : null;
  const ofPlan = r.plannedMinutes ? Math.round((r.doneMinutes / r.plannedMinutes) * 100) : null;
  const maxDay = Math.max(60, ...r.days.map((d) => d.minutes));
  const maxSubject = Math.max(1, ...r.subjects.map((s) => s.minutes));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-7" style={{ background: `linear-gradient(120deg, ${r.color}26, transparent 60%)` }}>
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl font-heading text-4xl font-black text-white shadow-lg" style={{ background: r.color }}>
            {r.grade}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{r.kind === 'weekly' ? 'Weekly report' : 'Daily report'}</p>
            <h2 className="font-heading text-2xl font-bold">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{r.level}</span> · score {r.score}/100
            </p>
          </div>
          {pdf && (
            <Button asChild variant="outline">
              <a href={pdf} download={r.fileName}>
                <Download /> PDF
              </a>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 border-t border-border/60 md:grid-cols-4">
          <Fact label="Studied" value={hoursMinutes(r.doneMinutes)} sub={ofPlan === null ? 'nothing planned' : `${ofPlan}% of ${hoursMinutes(r.plannedMinutes)}`}>
            {vs && <Change change={{ text: `${vs.text} vs usual`, up: vs.up }} />}
          </Fact>
          <Fact label="Blocks done" value={`${r.blocksDone}/${r.blocksTotal}`} sub={kept === null ? '' : `${kept}% kept`} />
          <Fact label="Streak" value={`${r.streak} days`} sub="on the day of the report" icon={<Flame className="size-3.5 text-[var(--m-warn)]" />} />
          <Fact label="Homework done" value={r.homework.length} sub={r.homework.length === 1 ? 'piece' : 'pieces'} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="What the report says" icon={<FileText />} />
          <p className="text-[15px] leading-relaxed text-foreground">{r.feedback}</p>
          {r.detail && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>}
        </Card>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          <ListCard title="Went well" icon={<Star />} items={r.strengths} empty="Nothing noted." />
          <ListCard title="To work on" icon={<Lightbulb />} items={r.next} empty="Nothing noted." tone="warn" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {r.kind === 'daily' ? (
          <Card>
            <CardHead title="Study blocks" hint={`${r.blocksDone} of ${r.blocksTotal} done`} icon={<CheckCircle2 />} />
            {r.blocks.length === 0 ? (
              <Empty title="No blocks that day" />
            ) : (
              <ul className="space-y-2">
                {r.blocks.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                    {b.done ? <CheckCircle2 className="size-5 shrink-0 text-[var(--m-accent)]" aria-label="Done" /> : <XCircle className="size-5 shrink-0 text-[var(--m-missed)]" aria-label="Not done" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.subject}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{b.start}–{b.end}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <CardHead title="Day by day" hint="Time done each day" icon={<CheckCircle2 />} />
            <div className="flex h-48 items-end gap-2 sm:gap-3">
              {r.days.map((d) => (
                <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] tabular-nums text-muted-foreground">{d.minutes ? hoursMinutes(d.minutes) : ''}</span>
                  <div className={cn('w-full rounded-t-lg', d.minutes ? 'bg-[var(--m-accent)]' : 'bg-[var(--m-planned)]')} style={{ height: `${Math.max(4, (d.minutes / maxDay) * 100)}%` }} />
                  <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardHead title="Time by subject" hint="Planned minutes" icon={<ClipboardCheck />} />
          {r.subjects.length === 0 ? (
            <Empty title="No subjects" />
          ) : (
            <ul className="space-y-3">
              {r.subjects.map((s) => (
                <li key={s.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{hoursMinutes(s.minutes)}</span>
                  </div>
                  <Meter value={(s.minutes / maxSubject) * 100} />
                </li>
              ))}
            </ul>
          )}
          {r.homework.length > 0 && (
            <div className="mt-5 border-t border-border/60 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Homework finished</p>
              <ul className="space-y-1 text-sm">
                {r.homework.map((h, i) => (
                  <li key={i} className="truncate"><span className="font-medium">{h.title}</span> <span className="text-muted-foreground">· {h.subject}</span></li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value, sub, icon, children }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 border-border/60 p-4 sm:p-5 [&:not(:last-child)]:border-r">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {children}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function ListCard({ title, icon, items, empty, tone = 'accent' }: { title: string; icon: React.ReactNode; items: string[]; empty: string; tone?: 'accent' | 'warn' }) {
  return (
    <Card>
      <CardHead title={title} icon={icon} />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', tone === 'warn' ? 'bg-[var(--m-warn)]' : 'bg-[var(--m-accent)]')} aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
