"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area,
  CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  ArrowUpDown, BookOpen, CheckCircle2, ChevronDown, Clock, FileText,
  History as HistoryIcon, ListChecks, Repeat, Search, Sparkles, Trophy, XCircle,
} from "lucide-react";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import type { TaskWithTemplate, SafeUserProgress as UserProgress } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteTaskButton } from "@/components/DeleteTaskButton";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/list-row";
import { Segmented } from "../insights/Segmented";
import {
  ChartFrame, TOOLTIP_STYLE, AXIS_TICK, CHART_PRIMARY, SUBJECT_COLORS, useIsClient,
} from "../insights/chart-frame";

interface HistoryClientProps {
  tasks: TaskWithTemplate[];
  userProgress: UserProgress | null;
}

type TabType = "ALL" | "HOMEWORK" | "REVISION" | "MISSED";
type PeriodType = "ALL" | "7_DAYS" | "30_DAYS";
type SortType = "DATE_DESC" | "DATE_ASC" | "SUBJECT" | "DURATION";

const TAB_LABELS: Record<TabType, string> = {
  ALL: "Everything",
  HOMEWORK: "Homework",
  REVISION: "Revision",
  MISSED: "Missed",
};

function taskMinutes(t: TaskWithTemplate): number {
  const [sH, sM] = t.startTime.split(":").map(Number);
  const [eH, eM] = t.endTime.split(":").map(Number);
  let mins = eH * 60 + eM - (sH * 60 + sM);
  if (mins < 0) mins += 1440; // crosses midnight
  return Number.isFinite(mins) ? Math.max(0, mins) : 0;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const cleanSubject = (s: string) => s.replace(/\s*\(revision\)\s*/gi, "").trim();

/** When in the day most finished blocks started. Null with no finished work. */
function peakTimeOfDay(done: TaskWithTemplate[]): string | null {
  if (done.length === 0) return null;
  const buckets = [
    { label: "Morning", count: 0 },   // 05:00 - 11:59
    { label: "Afternoon", count: 0 }, // 12:00 - 16:59
    { label: "Evening", count: 0 },   // 17:00 - 20:59
    { label: "Night", count: 0 },     // 21:00 - 04:59
  ];
  for (const t of done) {
    const hour = parseInt(t.startTime.split(":")[0], 10);
    if (Number.isNaN(hour)) continue;
    if (hour >= 5 && hour < 12) buckets[0].count++;
    else if (hour >= 12 && hour < 17) buckets[1].count++;
    else if (hour >= 17 && hour < 21) buckets[2].count++;
    else buckets[3].count++;
  }
  return buckets.reduce((a, b) => (b.count > a.count ? b : a)).label;
}

export function HistoryClient({ tasks, userProgress }: HistoryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [timeRange, setTimeRange] = useState<PeriodType>("ALL");
  const [sortBy, setSortBy] = useState<SortType>("DATE_DESC");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Dates are formatted in the viewer's time zone, which the server cannot
  // know, so the log renders after mount rather than risk a hydration mismatch.
  const mounted = useIsClient();

  // The period applies to everything on the page; the type tabs and search
  // narrow only the log.
  const inPeriod = useMemo(() => {
    if (timeRange === "ALL") return tasks;
    const cutoff = startOfDay(subDays(new Date(), timeRange === "7_DAYS" ? 7 : 30));
    return tasks.filter((t) => isAfter(startOfDay(new Date(t.date)), cutoff));
  }, [tasks, timeRange]);

  const filteredTasks = useMemo(() => {
    let result = inPeriod;

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(term) ||
          (t.workDescription && t.workDescription.toLowerCase().includes(term))
      );
    }

    if (activeTab === "HOMEWORK") result = result.filter((t) => t.type === "HOMEWORK" && t.isDone);
    else if (activeTab === "REVISION") result = result.filter((t) => t.type === "REVISION" && t.isDone);
    else if (activeTab === "MISSED") result = result.filter((t) => t.isMissed);

    return [...result].sort((a, b) => {
      if (sortBy === "DATE_DESC") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "DATE_ASC") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "SUBJECT") return a.subject.localeCompare(b.subject);
      return taskMinutes(b) - taskMinutes(a);
    });
  }, [inPeriod, searchTerm, activeTab, sortBy]);

  const stats = useMemo(() => {
    const done = inPeriod.filter((t) => t.isDone);
    const missed = inPeriod.filter((t) => t.isMissed).length;
    const totalMinutes = done.reduce((sum, t) => sum + taskMinutes(t), 0);
    const counted = done.length + missed;
    return {
      done,
      homeworks: done.filter((t) => t.type === "HOMEWORK").length,
      revisions: done.filter((t) => t.type === "REVISION").length,
      missed,
      totalMinutes,
      // Done against done + missed. Null rather than a made-up 100% when there
      // is nothing to count.
      completionRate: counted > 0 ? Math.round((done.length / counted) * 100) : null,
    };
  }, [inPeriod]);

  const patterns = useMemo(() => {
    const revisionCounts = new Map<string, number>();
    for (const t of stats.done) {
      if (t.type !== "REVISION") continue;
      const sub = cleanSubject(t.subject);
      revisionCounts.set(sub, (revisionCounts.get(sub) ?? 0) + 1);
    }
    let mostRevised: string | null = null;
    let max = 0;
    for (const [sub, count] of revisionCounts) {
      if (count > max) {
        mostRevised = sub;
        max = count;
      }
    }
    return { peak: peakTimeOfDay(stats.done), mostRevised };
  }, [stats.done]);

  const subjectSplit = useMemo(() => {
    const breakdown = new Map<string, number>();
    for (const t of stats.done) {
      const subject = cleanSubject(t.subject) || "General";
      breakdown.set(subject, (breakdown.get(subject) ?? 0) + taskMinutes(t));
    }
    return Array.from(breakdown, ([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [stats.done]);

  const dailyMinutes = useMemo(() => {
    // "All time" charts the last two weeks: a curve across a whole year of
    // days is too dense to read.
    const rangeDays = timeRange === "7_DAYS" ? 7 : timeRange === "30_DAYS" ? 30 : 14;
    const byDay = new Map<string, number>();
    for (const t of tasks) {
      if (!t.isDone) continue;
      const key = format(new Date(t.date), "yyyy-MM-dd");
      byDay.set(key, (byDay.get(key) ?? 0) + taskMinutes(t));
    }
    return Array.from({ length: rangeDays }, (_, i) => {
      const date = subDays(new Date(), rangeDays - 1 - i);
      return {
        dateLabel: format(date, "MMM d"),
        minutes: byDay.get(format(date, "yyyy-MM-dd")) ?? 0,
      };
    });
  }, [tasks, timeRange]);

  if (!mounted) return <PageSkeleton layout="list" />;

  const periodLabel =
    timeRange === "7_DAYS" ? "in the last 7 days" : timeRange === "30_DAYS" ? "in the last 30 days" : "so far";
  const filtersActive = searchTerm.trim() !== "" || activeTab !== "ALL";

  return (
    <Page>
      {/* The onboarding tour anchors on this. */}
      <div data-tour="history-intro">
        <PageHeader
          title="History"
          description="Every study block you finished, and the ones you missed."
          actions={
            <>
              <Segmented
                label="Period"
                value={timeRange}
                options={[
                  { value: "7_DAYS", label: "7 days", onSelect: () => setTimeRange("7_DAYS") },
                  { value: "30_DAYS", label: "30 days", onSelect: () => setTimeRange("30_DAYS") },
                  { value: "ALL", label: "All time", onSelect: () => setTimeRange("ALL") },
                ]}
              />
              <Button asChild size="lg">
                <Link href="/">
                  <ListChecks />
                  Today&apos;s tasks
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <PageBody>
        {tasks.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title="Nothing finished yet"
            description="Tick off a study block on Today and it lands here, with the time you spent and any notes you added."
            action={
              <Button asChild>
                <Link href="/">Go to today</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Panel className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5">
              <Stat icon={<BookOpen />} tone="primary" label="Homework done" value={stats.homeworks} hint={periodLabel} />
              <Stat icon={<Repeat />} tone="warning" label="Revision done" value={stats.revisions} hint={periodLabel} />
              <Stat icon={<Clock />} label="Time studied" value={formatMinutes(stats.totalMinutes)} hint="From finished blocks" />
              <Stat
                icon={<CheckCircle2 />}
                tone="success"
                label="Completion"
                value={stats.completionRate == null ? "No data" : `${stats.completionRate}%`}
                hint={`${stats.missed} missed ${periodLabel}`}
              />
              <Link
                href="/streak"
                className="-m-2 rounded-xl p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Stat
                  icon={<Trophy />}
                  label="Best streak"
                  value={`${userProgress?.longestStreak ?? 0} days`}
                  hint="Your all-time record"
                />
              </Link>
            </Panel>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <Panel className="lg:col-span-5">
                <PanelTitle icon={<Clock />}>Time by subject</PanelTitle>
                {subjectSplit.length > 0 ? (
                  <>
                    <div className="relative">
                      <ChartFrame>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={subjectSplit} cx="50%" cy="50%" innerRadius={75} outerRadius={105} paddingAngle={4} dataKey="value" stroke="none">
                              {subjectSplit.map((item, index) => (
                                <Cell key={item.name} fill={SUBJECT_COLORS[index % SUBJECT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} min`, "Time"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartFrame>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">Total</span>
                        <span className="font-heading text-2xl font-black text-foreground">{formatMinutes(stats.totalMinutes)}</span>
                      </div>
                    </div>
                    <ul className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-4">
                      {subjectSplit.slice(0, 6).map((item, i) => (
                        <li key={item.name} className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                          <span className="truncate text-xs text-muted-foreground" title={item.name}>{item.name}</span>
                          <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {Math.round((item.value / stats.totalMinutes) * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <EmptyState
                    title="No finished blocks in this period"
                    description="Pick a longer period, or finish a block today."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setTimeRange("ALL")}>
                        Show all time
                      </Button>
                    }
                  />
                )}
              </Panel>

              <Panel className="lg:col-span-7">
                <PanelTitle icon={<Sparkles />}>Daily study time</PanelTitle>
                <ChartFrame>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyMinutes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                      <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} unit="m" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} min`, "Studied"]} />
                      <Area type="monotone" dataKey="minutes" stroke={CHART_PRIMARY} strokeWidth={2.5} fill={CHART_PRIMARY} fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartFrame>
                {(patterns.peak || patterns.mostRevised) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/40 pt-4 text-sm text-muted-foreground">
                    {patterns.peak && (
                      <span>
                        You finish most in the <span className="font-semibold text-foreground">{patterns.peak.toLowerCase()}</span>
                      </span>
                    )}
                    {patterns.mostRevised && (
                      <span>
                        Most revised: <span className="font-semibold text-foreground">{patterns.mostRevised}</span>
                      </span>
                    )}
                  </div>
                )}
              </Panel>
            </div>

            <Section
              title="Log"
              actions={
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative sm:w-64">
                    <label htmlFor="history-search" className="sr-only">Search subject or notes</label>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="history-search"
                      placeholder="Search subject or notes"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 rounded-xl pl-9"
                    />
                  </div>
                  <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3">
                    <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                    <label htmlFor="history-sort" className="sr-only">Sort by</label>
                    <select
                      id="history-sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortType)}
                      className="w-full cursor-pointer bg-transparent text-sm font-medium text-foreground focus:outline-none"
                    >
                      <option value="DATE_DESC">Newest first</option>
                      <option value="DATE_ASC">Oldest first</option>
                      <option value="SUBJECT">Subject A to Z</option>
                      <option value="DURATION">Longest first</option>
                    </select>
                  </div>
                </div>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  label="Entry type"
                  value={activeTab}
                  options={(Object.keys(TAB_LABELS) as TabType[]).map((tab) => ({
                    value: tab,
                    label: TAB_LABELS[tab],
                    onSelect: () => setActiveTab(tab),
                  }))}
                />
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {filteredTasks.length} {filteredTasks.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {filteredTasks.length === 0 ? (
                <EmptyState
                  icon={<Search />}
                  title="No entries match"
                  description={filtersActive ? "Nothing in this period matches your search and filter." : "Nothing was logged in this period."}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setActiveTab("ALL");
                        setTimeRange("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <LogRow
                      key={task.id}
                      task={task}
                      expanded={expandedTaskId === task.id}
                      onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </Page>
  );
}

/**
 * One logged block. The toggle and the delete button are siblings rather than
 * one nested inside the other - a button inside a button is invalid and
 * breaks keyboard and screen-reader use.
 */
function LogRow({
  task,
  expanded,
  onToggle,
}: {
  task: TaskWithTemplate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const minutes = taskMinutes(task);
  const panelId = `history-entry-${task.id}`;

  return (
    <Panel padded={false} className={cn("overflow-hidden", expanded && "border-primary/40")}>
      <div className="flex items-center gap-2 pr-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:p-5"
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              task.isDone
                ? "border-success/20 bg-success/10 text-success"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            )}
          >
            {task.isDone ? <CheckCircle2 className="size-5" aria-label="Done" /> : <XCircle className="size-5" aria-label="Missed" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-bold text-foreground">{task.subject}</span>
              <Pill
                tone={task.type === "HOMEWORK" ? "primary" : "warning"}
                className={cn(task.type === "REVISION" && "border-dashed")}
              >
                {task.type === "HOMEWORK" ? "Homework" : "Revision"}
              </Pill>
            </span>
            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
              {format(new Date(task.date), "EEE d MMM yyyy")} · {task.startTime} to {task.endTime} · {minutes} min
            </span>
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        <DeleteTaskButton taskId={task.id} className="size-9 shrink-0" />
      </div>

      {expanded && (
        <div id={panelId} className="space-y-3 border-t border-border/40 bg-muted/20 p-5">
          <p className="text-xs font-medium text-muted-foreground">What you did</p>
          {task.workDescription ? (
            <p className="border-l-2 border-primary pl-4 text-sm leading-relaxed text-foreground">
              {task.workDescription}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes were added to this block.</p>
          )}
          {task.proofPdfUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={task.proofPdfUrl} target="_blank" rel="noreferrer">
                <FileText />
                Open attached PDF
              </a>
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
