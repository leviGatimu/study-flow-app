'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookCheck, CalendarDays, CheckCircle2, Clock, Download, Flame, FolderOpen, Lightbulb, ListChecks, ThumbsUp, TrendingDown, TrendingUp, XCircle } from 'lucide-react';

import { hm, versusAverage, type ReportData, type ReportKind } from '@/lib/report-model';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

const BAR_COLORS = ['bg-blue-500', 'bg-orange-500', 'bg-violet-500', 'bg-emerald-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500'];

/**
 * Reports: the list on the left (daily or weekly), the chosen report on the
 * right. The choice is kept in the URL (?view=, ?r=) so a report can be linked.
 */
export function ReportsBrowser({
  view,
  reports,
  counts,
  initialId,
  urls,
}: {
  view: ReportKind;
  reports: ReportData[];
  counts: Record<ReportKind, number>;
  initialId: string | null;
  /** "Daily/Daily report 2026-11-05.pdf" -> its file, once filed. */
  urls: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState(() => (reports.some((r) => r.id === initialId) ? initialId : reports[0]?.id ?? null));
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  const choose = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('r', id);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 lg:sticky lg:top-6">
        <div role="tablist" aria-label="Report period" className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
          {(['daily', 'weekly'] as const).map((kind) => (
            <Link
              key={kind}
              role="tab"
              aria-selected={view === kind}
              href={kind === 'daily' ? '/summaries' : '/summaries?view=weekly'}
              className={cn(
                'rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                view === kind ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {kind === 'daily' ? 'Daily' : 'Weekly'} <span className="tabular-nums text-muted-foreground">{counts[kind]}</span>
            </Link>
          ))}
        </div>

        {reports.length > 0 && (
          <nav aria-label={`${view === 'daily' ? 'Daily' : 'Weekly'} reports`} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
            {reports.map((r) => {
              const active = r.id === selected?.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => choose(r.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-full',
                    active ? 'border-primary/30 bg-primary/5' : 'border-transparent hover:bg-muted/60'
                  )}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-black text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.grade}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', active ? 'font-semibold text-foreground' : 'font-medium text-foreground/90')}>
                      {r.shortTitle}
                    </span>
                    <span className="block truncate text-xs tabular-nums text-muted-foreground">
                      {hm(r.doneMinutes)} of {hm(r.plannedMinutes)}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </aside>

      {selected && <ReportView report={selected} url={urls[`${selected.kind === 'daily' ? 'Daily' : 'Weekly'}/${selected.fileName}`] ?? null} />}
    </div>
  );
}

function ReportView({ report: r, url }: { report: ReportData; url: string | null }) {
  const vs = versusAverage(r);
  const subjectTotal = r.subjects.reduce((s, b) => s + b.minutes, 0) || 1;
  const dayMax = Math.max(60, ...r.days.map((d) => d.minutes));
  const donePct = r.plannedMinutes ? Math.min(100, Math.round((r.doneMinutes / r.plannedMinutes) * 100)) : 0;

  return (
    <article className="min-w-0 space-y-6" aria-label={`${r.kind === 'daily' ? 'Daily' : 'Weekly'} report, ${r.title}`}>
      <Panel padded={false} className="overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: r.color }} />
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{r.kind === 'daily' ? 'Daily report' : 'Weekly report'}</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{r.title}</h2>
            <p className="text-sm text-muted-foreground">
              {r.level} · score <span className="font-semibold tabular-nums text-foreground">{r.score}</span> out of 100
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex size-20 flex-col items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: r.color }}>
              <span className="font-heading text-3xl font-black leading-none">{r.grade}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">Grade</span>
            </div>
          </div>
        </div>
        <div className="mx-6 mb-6 rounded-xl border-l-4 bg-muted/40 px-5 py-4 sm:mx-8" style={{ borderColor: r.color }}>
          <p className="font-semibold text-foreground">{r.feedback}</p>
          <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 md:grid-cols-4">
          <Tile icon={<Clock />} label="Studied" value={hm(r.doneMinutes)} note={`of ${hm(r.plannedMinutes)} planned`} />
          <Tile
            icon={<ListChecks />}
            label="Blocks done"
            value={`${r.blocksDone} / ${r.blocksTotal}`}
            note={r.blocksTotal ? `${Math.round((r.blocksDone / r.blocksTotal) * 100)}% of planned` : 'None planned'}
          />
          <Tile icon={<Flame />} label="Streak" value={`${r.streak} ${r.streak === 1 ? 'day' : 'days'}`} note="Days in a row" />
          <Tile icon={<BookCheck />} label="Homework done" value={String(r.homework.length)} note={r.kind === 'daily' ? 'That day' : 'That week'} />
        </div>
        <div className="space-y-2 border-t border-border/60 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Time done of planned</span>
            <span className="tabular-nums">{donePct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${donePct}%`, backgroundColor: r.color }} />
          </div>
          {vs && (
            <p className={cn('flex items-center gap-1.5 pt-1 text-sm', vs.up ? 'text-success' : 'text-destructive')}>
              {vs.up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              <span className="text-foreground">{vs.text}</span>
            </p>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {r.blocks.length > 0 && (
          <Section title="Blocks" icon={<CalendarDays />}>
            <ul className="divide-y divide-border/60">
              {r.blocks.map((b, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  {b.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{b.subject}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {b.start} – {b.end}
                  </span>
                  <span className={cn('w-14 shrink-0 text-right text-xs font-semibold', b.done ? 'text-success' : 'text-destructive')}>
                    {b.done ? 'Done' : 'Missed'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {r.days.length > 0 && (
          <Section title="Each day" icon={<CalendarDays />}>
            <div className="flex h-40 items-end gap-2" role="img" aria-label={r.days.map((d) => `${d.label} ${hm(d.minutes)}`).join(', ')}>
              {r.days.map((d) => (
                <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{d.minutes ? hm(d.minutes) : ''}</span>
                  <div className="flex w-full max-w-10 flex-1 items-end overflow-hidden rounded-lg bg-muted/60">
                    <div className="w-full rounded-lg" style={{ height: `${(d.minutes / dayMax) * 100}%`, backgroundColor: r.color }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {r.subjects.length > 0 && (
          <Section title="Time per subject" icon={<Clock />}>
            <ul className="space-y-3">
              {r.subjects.map((s, i) => (
                <li key={s.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                      <span className={cn('size-2.5 shrink-0 rounded-full', BAR_COLORS[i % BAR_COLORS.length])} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {hm(s.minutes)} · {Math.round((s.minutes / subjectTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${(s.minutes / subjectTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Homework finished" icon={<BookCheck />}>
          {r.homework.length ? (
            <ul className="divide-y divide-border/60">
              {r.homework.map((h, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{h.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{h.subject}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No homework was marked as finished {r.kind === 'daily' ? 'that day' : 'that week'}.</p>
          )}
        </Section>

        {r.strengths.length > 0 && (
          <Section title="What went well" icon={<ThumbsUp />}>
            <ul className="space-y-2">
              {r.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {r.next.length > 0 && (
          <Section title={r.kind === 'daily' ? 'For tomorrow' : 'For next week'} icon={<Lightbulb />}>
            <ul className="space-y-2">
              {r.next.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} /> {s}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="size-4 shrink-0 text-primary" />
          {url ? (
            <>Saved as a PDF in Resources › Reports › {r.kind === 'daily' ? 'Daily' : 'Weekly'}.</>
          ) : (
            <>Being saved to Resources › Reports. Reload in a moment to download it.</>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link href="/resources/Reports">
              <FolderOpen /> Open folder
            </Link>
          </Button>
          {url ? (
            <Button asChild>
              <a href={url} download={r.fileName}>
                <Download /> Download PDF
              </a>
            </Button>
          ) : (
            <Button disabled>
              <Download /> Download PDF
            </Button>
          )}
        </div>
      </Panel>
    </article>
  );
}

function Tile({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="bg-card px-6 py-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-primary">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel>
      <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold [&_svg]:size-5 [&_svg]:text-primary">
        {icon}
        {title}
      </h3>
      {children}
    </Panel>
  );
}
