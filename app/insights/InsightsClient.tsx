"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import {
  BrainCircuit, CheckCircle, CheckCircle2, Flame, GraduationCap,
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

const practiceHref = (subject: string) => `/ai?subject=${encodeURIComponent(subject)}`;
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

function attentionTone(score: number): "danger" | "warning" | "default" {
  if (score >= 60) return "danger";
  if (score >= 35) return "warning";
  return "default";
}

export function InsightsClient({
  data,
  scope,
  classLabel,
  week,
}: {
  data: InsightsData;
  scope: "class" | "lifetime";
  classLabel: string | null;
  week: WeekSnapshot;
}) {
  const { headline, subjects, gradeTrajectory, quizTrend } = data;
  const attentionList = subjects.filter((s) => s.attentionScore >= 20).slice(0, 5);
  const goalRows = subjects.filter((s) => s.target != null);
  const graded = goalRows.filter((s) => s.grade != null);
  const onTarget = graded.filter((s) => (s.grade as number) >= (s.target as number)).length;
  const latestAverage = gradeTrajectory.at(-1) ?? null;
  const hasAnyData = subjects.length > 0;
  const weakest = attentionList[0];

  return (
    <Page>
      <PageHeader
        title="Insights"
        description={
          scope === "lifetime"
            ? "Every year you have studied, added together."
            : `How ${classLabel ?? "this year"} is going, and what to work on next.`
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
                { value: "class", label: classLabel ?? "This year", href: "/insights" },
                { value: "lifetime", label: "All time", href: "/insights?scope=lifetime" },
              ]}
            />
            <Button asChild size="lg">
              <Link href={weakest ? practiceHref(weakest.subject) : "/ai"}>
                <BrainCircuit />
                {weakest ? `Practice ${weakest.subject}` : "Open practice"}
              </Link>
            </Button>
          </>
        }
      />

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
          <HeadlineLink href="/goals">
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
            <Section
              title="Needs your attention"
              description="Ranked by gaps in completion, practice scores and grade targets, and by how close the next exam is."
            >
              {attentionList.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="Every subject is on track"
                  description="Nothing is falling behind right now. A practice set keeps it that way."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/ai">Open practice</Link>
                    </Button>
                  }
                />
              ) : (
                <Panel padded={false} className="divide-y divide-border/40">
                  {attentionList.map((s) => (
                    <AttentionRow key={s.subject} s={s} />
                  ))}
                </Panel>
              )}
            </Section>

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
                    description="Generate a practice set and your scores will chart here."
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/ai">Open practice</Link>
                      </Button>
                    }
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
                      <Link href="/goals">Edit goals</Link>
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
                {subjects.map((s) => (
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

/** One subject that needs work, with the two things you can do about it. */
function AttentionRow({ s }: { s: SubjectInsight }) {
  const facts = [
    s.totalTasks > 0 ? `${s.completionRate}% of blocks done` : null,
    s.masteryPct != null ? `mastery ${s.masteryPct}%` : null,
    s.quizAvg != null ? `practice ${s.quizAvg}%` : null,
    s.grade != null && s.target != null ? `mark ${s.grade}% of ${s.target}% target` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-foreground">{s.subject}</p>
          <Pill tone={attentionTone(s.attentionScore)}>Attention {s.attentionScore}</Pill>
          {s.nextExamDays != null && s.nextExamDays <= 14 && (
            <Pill tone="danger">
              Exam {s.nextExamDays === 0 ? "today" : `in ${plural(s.nextExamDays, "day")}`}
            </Pill>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {s.reason.charAt(0).toUpperCase() + s.reason.slice(1)}
          {facts.length > 0 && <> · {facts.join(" · ")}</>}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild size="sm">
          <Link href={practiceHref(s.subject)}>
            <BrainCircuit />
            Practice
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={subjectHref(s.subject)}>Open subject</Link>
        </Button>
      </div>
    </div>
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
        <Meter label="Practice average" value={s.quizAvg} barClass="bg-orange-500" />
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
