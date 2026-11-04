"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import {
  BrainCircuit, CheckCircle, Flame, GraduationCap,
  Library, Target, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightsData, SubjectInsight } from "@/lib/insights-actions";
import { Button } from "@/components/ui/button";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/list-row";
import { Segmented } from "./Segmented";
import {
  ChartFrame, TOOLTIP_STYLE, AXIS_TICK, CHART_PRIMARY, CHART_ORANGE,
} from "./chart-frame";

export type WeekSnapshot = {
  done: number;
  scheduled: number;
  minutes: number;
  streakPaused: boolean;
};

const subjectHref = (subject: string) => `/subjects?subject=${encodeURIComponent(subject)}`;

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}


export function InsightsClient({
  data,
  scope,
  classLabel,
  week,
  tabs,
}: {
  tabs?: React.ReactNode;
  data: InsightsData;
  scope: "class" | "lifetime";
  classLabel: string | null;
  week: WeekSnapshot;
}) {
  const { headline, subjects, gradeTrajectory, quizTrend } = data;
  const goalRows = subjects.filter((s) => s.target != null);
  const graded = goalRows.filter((s) => s.grade != null);
  const onTarget = graded.filter((s) => (s.grade as number) >= (s.target as number)).length;
  const latestAverage = gradeTrajectory.at(-1) ?? null;
  const hasAnyData = subjects.length > 0;


  return (
    <Page>
      <PageHeader
        title="History"
        description={
          scope === "lifetime"
            ? "Every year you have studied, added together."
            : `Your recorded work and results for ${classLabel ?? "this year"}.`
        }
        actions={
          <>
            {/*
              A year and a lifetime answer different questions. "How am I doing"
              almost always means this year - last year's Physics has no bearing
              on it - while a running total only means anything across all of
              them.
            */}
            <Segmented
              label="Insights period"
              value={scope}
              options={[
                { value: "class", label: classLabel ?? "This year", href: "/history?view=overview" },
                { value: "lifetime", label: "All time", href: "/history?view=overview&scope=lifetime" },
              ]}
            />
          </>
        }
      />
      {tabs}

      <PageBody>
        {/* The four numbers worth knowing before anything else. Each opens the
            page that explains it. */}
        <Panel className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          <HeadlineLink href="/streak">
            <Stat
              icon={<Flame />}
              tone="warning"
              label="Current streak"
              value={plural(headline.currentStreak, "day")}
              hint={week.streakPaused ? "Paused for the break" : `Best ${plural(headline.longestStreak, "day")}`}
            />
          </HeadlineLink>
          <HeadlineLink href="/history">
            <Stat
              icon={<CheckCircle />}
              tone="success"
              label="Done this week"
              value={week.scheduled === 0 ? "Nothing yet" : `${week.done} of ${week.scheduled}`}
              hint={week.done > 0 ? `${formatMinutes(week.minutes)} studied` : "No blocks finished yet"}
            />
          </HeadlineLink>
          <HeadlineLink href="/marks">
            <Stat
              icon={<TrendingUp />}
              label="Latest average"
              value={latestAverage ? `${latestAverage.average}%` : "No marks"}
              hint={latestAverage ? latestAverage.term : "Add a report card in Marks"}
            />
          </HeadlineLink>
          <HeadlineLink href="/marks?view=goals">
            <Stat
              icon={<Target />}
              tone={graded.length > 0 && onTarget === graded.length ? "success" : "default"}
              label="Goals on target"
              value={goalRows.length === 0 ? "No goals" : `${onTarget} of ${goalRows.length}`}
              hint={
                goalRows.length === 0
                  ? "Set a target grade per subject"
                  : graded.length < goalRows.length
                    ? `${goalRows.length - graded.length} not graded yet`
                    : "At or above target"
              }
            />
          </HeadlineLink>
        </Panel>

        {!hasAnyData ? (
          <EmptyState
            icon={<Library />}
            title="Nothing to analyse yet"
            description="Insights build up from your subjects, finished study blocks, practice scores, goals and report cards. Add your subjects to start."
            action={
              <>
                <Button asChild>
                  <Link href="/subjects">Add subjects</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/marks">Add a report card</Link>
                </Button>
              </>
            }
          />
        ) : (
          <>


            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel>
                <PanelTitle icon={<TrendingUp />}>Grade trend</PanelTitle>
                <p className="-mt-2 mb-4 text-sm text-muted-foreground">Overall average on each report card.</p>
                {gradeTrajectory.length > 0 ? (
                  <ChartFrame>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gradeTrajectory} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="term" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={AXIS_TICK} unit="%" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Average"]} />
                        <Line type="monotone" dataKey="average" stroke={CHART_PRIMARY} strokeWidth={3} dot={{ r: 4, fill: CHART_PRIMARY }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                ) : (
                  <EmptyState
                    icon={<GraduationCap />}
                    title="No report cards yet"
                    description="Add a report card to see your average term by term."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/marks">Open marks</Link>
                      </Button>
                    }
                  />
                )}
              </Panel>

              <Panel>
                <PanelTitle icon={<Target />}>Practice scores</PanelTitle>
                <p className="-mt-2 mb-4 text-sm text-muted-foreground">Score on each practice attempt, oldest first.</p>
                {quizTrend.length > 0 ? (
                  <ChartFrame>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={quizTrend} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={AXIS_TICK} unit="%" />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          formatter={(v, _n, p) => [`${v}%`, (p?.payload as { subject?: string } | undefined)?.subject || "Score"]}
                        />
                        <Area type="monotone" dataKey="score" stroke={CHART_ORANGE} strokeWidth={2.5} fill={CHART_ORANGE} fillOpacity={0.12} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                ) : (
                  <EmptyState
                    icon={<BrainCircuit />}
                    title="No practice attempts yet"
                    description="Scores appear here for practice attempts you choose to complete."

                  />
                )}
              </Panel>
            </div>

            {graded.length > 0 && (
              <Panel>
                <PanelTitle
                  icon={<Target />}
                  action={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/marks?view=goals">Edit goals</Link>
                    </Button>
                  }
                >
                  Goals against marks
                </PanelTitle>
                <p className="-mt-2 mb-4 text-sm text-muted-foreground">Your latest mark in each subject next to its target.</p>
                <ChartFrame className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={graded.map((s) => ({ subject: s.subject, Mark: s.grade, Target: s.target }))}
                      margin={{ top: 10, right: 16, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={AXIS_TICK} unit="%" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                      <Bar dataKey="Mark" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Target" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} fillOpacity={0.4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </Panel>
            )}

            <Section title="Every subject" description="Completion, topic mastery and practice average, side by side.">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {[...subjects].sort((a, b) => a.subject.localeCompare(b.subject)).map((s) => (
                  <SubjectCard key={s.subject} s={s} />
                ))}
              </div>
            </Section>
          </>
        )}
      </PageBody>
    </Page>
  );
}

function HeadlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-m-2 rounded-xl p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}

function SubjectCard({ s }: { s: SubjectInsight }) {
  return (
    <Panel>
      <PanelTitle
        action={
          s.gradeLabel ? <Pill tone="primary">{s.gradeLabel}</Pill> : undefined
        }
      >
        <Link href={subjectHref(s.subject)} className="hover:text-primary transition-colors">
          {s.subject}
        </Link>
      </PanelTitle>
      <div className="space-y-4">
        <Meter label="Blocks done" value={s.totalTasks > 0 ? s.completionRate : null} barClass="bg-success" />
        <Meter label="Topic mastery" value={s.masteryPct} barClass="bg-primary" />
        {s.quizAvg != null && <Meter label="Practice average" value={s.quizAvg} barClass="bg-orange-500" />}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4 text-xs font-medium text-muted-foreground">
        <span>{formatMinutes(s.minutes)} studied</span>
        {s.target != null && <span>Target {s.target}%</span>}
        {s.nextExamDays != null && s.nextExamDays <= 30 && (
          <span className={cn(s.nextExamDays <= 14 && "text-destructive")}>
            Exam in {plural(s.nextExamDays, "day")}
          </span>
        )}
      </div>
    </Panel>
  );
}

function Meter({ label, value, barClass }: { label: string; value: number | null; barClass: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold tabular-nums text-foreground">{value != null ? `${value}%` : "No data"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {value != null && <div className={cn("h-full rounded-full", barClass)} style={{ width: `${value}%` }} />}
      </div>
    </div>
  );
}
