"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area,
  CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  ArrowUpDown, BookOpen, CheckCircle2, ChevronRight, Clock, Layers,
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
import { bestDay, changeLabel, cleanSubject, groupByDay, subjectScores, taskMinutes } from "./history-model";
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

/** How many log entries show before asking for more: years of blocks add up. */
const LOG_PAGE = 60;
const dayKeyOf = (date: Date) => format(date, "yyyy-MM-dd");

const TAB_LABELS: Record<TabType, string> = {
  ALL: "Everything",
  HOMEWORK: "Homework",
  REVISION: "Revision",
  MISSED: "Missed",
};

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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

export function HistoryClient({ tasks, userProgress, tabs }: HistoryClientProps & { tabs?: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [timeRange, setTimeRange] = useState<PeriodType>("ALL");
  const [sortBy, setSortBy] = useState<SortType>("DATE_DESC");
  const [logLimit, setLogLimit] = useState(LOG_PAGE);

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

  const previous = useMemo(() => {
    if (timeRange === "ALL") return null;
    const days = timeRange === "7_DAYS" ? 7 : 30;
    const from = startOfDay(subDays(new Date(), days * 2));
    const to = startOfDay(subDays(new Date(), days));
    const tasksBefore = tasks.filter((t) => {
      const day = startOfDay(new Date(t.date));
      return isAfter(day, from) && !isAfter(day, to);
    });
    const done = tasksBefore.filter((t) => t.isDone);
    return {
      homeworks: done.filter((t) => t.type === "HOMEWORK").length,
      revisions: done.filter((t) => t.type === "REVISION").length,
      hours: Math.round(done.reduce((sum, t) => sum + taskMinutes(t), 0) / 60),
    };
  }, [tasks, timeRange]);

  const scores = useMemo(() => subjectScores(inPeriod), [inPeriod]);
  const best = useMemo(() => bestDay(inPeriod, dayKeyOf), [inPeriod]);

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
      {tabs}

      <PageBody>
        {tasks.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title="Nothing finished yet"
            description="Finished study blocks appear here. Open one to see its notes, planned length and recorded focus sessions."
            action={
              <Button asChild>
                <Link href="/">Go to today</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Panel className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5">
              <Stat icon={<BookOpen />} tone="primary" label="Homework done" value={stats.homeworks} hint={(previous && changeLabel(stats.homeworks, previous.homeworks)) ?? periodLabel} />
              <Stat icon={<Repeat />} tone="warning" label="Revision done" value={stats.revisions} hint={(previous && changeLabel(stats.revisions, previous.revisions)) ?? periodLabel} />
              <Stat icon={<Clock />} label="Planned time completed" value={formatMinutes(stats.totalMinutes)} hint={(previous && changeLabel(Math.round(stats.totalMinutes / 60), previous.hours, "h")) ?? "Scheduled length of finished blocks"} />
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
                <PanelTitle icon={<Clock />}>Planned time by subject</PanelTitle>
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
                <PanelTitle icon={<Sparkles />}>Completed schedule time</PanelTitle>
                <ChartFrame>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyMinutes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                      <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} unit="m" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} min`, "Scheduled minutes"]} />
                      <Area type="monotone" dataKey="minutes" stroke={CHART_PRIMARY} strokeWidth={2.5} fill={CHART_PRIMARY} fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartFrame>
                {(patterns.peak || patterns.mostRevised || best) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/40 pt-4 text-sm text-muted-foreground">
                    {patterns.peak && (
                      <span>
                        Most completed blocks were planned for the <span className="font-semibold text-foreground">{patterns.peak.toLowerCase()}</span>
                      </span>
                    )}
                    {patterns.mostRevised && (
                      <span>
                        Most revised: <span className="font-semibold text-foreground">{patterns.mostRevised}</span>
                      </span>
                    )}
                    {best && (
                      <span>
                        Best day: <span className="font-semibold text-foreground">{format(best.date, "EEE d MMM")}, {formatMinutes(best.minutes)}</span>
                      </span>
                    )}
                  </div>
                )}
              </Panel>
            </div>

            {scores.length > 0 && (
              <Panel padded={false} className="overflow-hidden">
                <div className="px-5 pt-5">
                  <PanelTitle icon={<Layers />}>By subject</PanelTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <caption className="sr-only">Finished and missed blocks for each subject {periodLabel}. Choosing a subject filters the log.</caption>
                    <thead className="border-y border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-5 py-2 font-medium">Subject</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Finished</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Missed</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Time</th>
                        <th scope="col" className="w-48 px-5 py-2 font-medium">Completion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {scores.map((score) => (
                        <tr key={score.subject} className="transition-colors hover:bg-muted/40">
                          <th scope="row" className="px-5 py-2 text-left font-medium">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm(score.subject);
                                setActiveTab("ALL");
                                setLogLimit(LOG_PAGE);
                              }}
                              className="break-words text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              {score.subject}
                            </button>
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums">{score.done}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums", score.missed > 0 && "text-destructive")}>{score.missed}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMinutes(score.minutes)}</td>
                          <td className="px-5 py-2">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${score.completion}%` }} />
                              </span>
                              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{score.completion}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

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
                <div className="space-y-4">
                  {sortBy === "DATE_DESC" || sortBy === "DATE_ASC" ? (
                    groupByDay(filteredTasks.slice(0, logLimit), dayKeyOf).map((day) => (
                      <section key={day.key} aria-label={format(day.date, "EEEE d MMMM yyyy")} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                        <header className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border/60 bg-muted/30 px-4 py-2 text-sm">
                          <h3 className="font-semibold text-foreground">{format(day.date, "EEEE d MMMM yyyy")}</h3>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {day.tasks.length} {day.tasks.length === 1 ? "entry" : "entries"}{day.minutes > 0 && ` · ${formatMinutes(day.minutes)} finished`}
                          </span>
                        </header>
                        <ul className="divide-y divide-border/60">
                          {day.tasks.map((task) => (
                            <LogRow key={task.id} task={task} />
                          ))}
                        </ul>
                      </section>
                    ))
                  ) : (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
                      {filteredTasks.slice(0, logLimit).map((task) => (
                        <LogRow key={task.id} task={task} showDate />
                      ))}
                    </ul>
                  )}
                  {filteredTasks.length > logLimit && (
                    <Button variant="outline" className="w-full" onClick={() => setLogLimit((n) => n + LOG_PAGE)}>
                      Show more ({filteredTasks.length - logLimit} left)
                    </Button>
                  )}
                </div>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </Page>
  );
}

/** The entry link and delete control remain siblings for keyboard access. */
function LogRow({ task, showDate = false }: { task: TaskWithTemplate; showDate?: boolean }) {
  const minutes = taskMinutes(task);
  return (
    <li className="flex items-center gap-1 pr-2 transition-colors hover:bg-muted/40">
      <Link href={`/history/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50">
        {task.isDone ? (
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Completed" />
        ) : (
          <XCircle className="size-5 shrink-0 text-destructive" aria-label="Missed" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="break-words font-medium text-foreground">{cleanSubject(task.subject) || task.subject}</span>
            <Pill tone={task.type === "REVISION" ? "warning" : "default"}>{task.type === "REVISION" ? "Revision" : "Homework"}</Pill>
          </span>
          <span className="block text-xs tabular-nums text-muted-foreground">
            {showDate && `${format(new Date(task.date), "EEE d MMM yyyy")} · `}{task.startTime}–{task.endTime} · {formatMinutes(minutes)}
          </span>
          {task.workDescription && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{task.workDescription}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
      <DeleteTaskButton taskId={task.id} className="size-11 shrink-0" />
    </li>
  );
}
