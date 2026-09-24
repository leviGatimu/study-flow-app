"use client";

import { useMemo } from "react";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpen, History, TrendingUp, Trophy, Zap } from "lucide-react";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { ChartFrame, TOOLTIP_STYLE, AXIS_TICK, CHART_PRIMARY } from "../insights/chart-frame";
import { parseGrade, standingLabel, type ReportCardType } from "./marks-model";

/** The selected term at a glance: its average, best and weakest subjects, and the trend across terms. */
export function TermOverview({ card, allCards }: { card: ReportCardType; allCards: ReportCardType[] }) {
  const average = card.overallAverage ?? null;

  const metrics = useMemo(() => {
    // Marks that cannot be read as a percentage are left out rather than counted as 0.
    const list = card.grades
      .map((g) => ({ subject: g.subject, score: parseGrade(g.grade), status: g.status }))
      .filter((g): g is { subject: string; score: number; status: string } => g.score !== null);
    if (list.length === 0) return null;
    const highest = [...list].sort((a, b) => b.score - a.score)[0];
    const lowest = [...list].sort((a, b) => a.score - b.score)[0];
    // A subject the report card itself flags outranks the plain lowest mark.
    const focus = list.find((g) => g.status === "Critical") || list.find((g) => g.status === "Needs Work") || lowest;
    const passing = list.filter((g) => g.score >= 50).length;
    return { highest, focus, passing, total: list.length };
  }, [card]);

  const history = useMemo(
    () =>
      allCards
        .filter((rc) => rc.overallAverage != null)
        .map((rc) => ({ term: rc.term, average: rc.overallAverage as number, date: new Date(rc.createdAt).getTime() }))
        .sort((a, b) => a.date - b.date),
    [allCards]
  );

  const trend = useMemo(() => {
    if (history.length < 2) return null;
    const diff = history[history.length - 1].average - history[history.length - 2].average;
    if (diff > 0.5) return { text: `Up ${diff.toFixed(1)}%`, tone: "success" as const };
    if (diff < -0.5) return { text: `Down ${Math.abs(diff).toFixed(1)}%`, tone: "danger" as const };
    return { text: "Steady", tone: "default" as const };
  }, [history]);

  return (
    <div className="space-y-6">
      <Panel>
        <p className="text-sm font-medium text-muted-foreground">{card.term} average</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <span className="font-heading text-6xl font-black leading-none tracking-tight tabular-nums text-foreground">
            {average === null ? "None" : `${average.toFixed(1)}%`}
          </span>
          {average !== null && <Pill tone="primary">{standingLabel(average)}</Pill>}
        </div>
        {average !== null && (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(average, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>0%</span>
              <span>50% pass</span>
              <span>75% credit</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </Panel>

      {metrics && (
        <Panel className="space-y-3">
          <FactRow icon={<Trophy className="text-primary" />} label="Best subject" subject={metrics.highest.subject} value={`${metrics.highest.score}%`} />
          <FactRow icon={<Zap className="text-orange-500" />} label="Needs the most work" subject={metrics.focus.subject} value={`${metrics.focus.score}%`} />
          <FactRow icon={<TrendingUp className="text-success" />} label="Passed (50% or more)" subject={null} value={`${metrics.passing} of ${metrics.total}`} />
        </Panel>
      )}

      {card.aiSummary && (
        <Panel>
          <PanelTitle icon={<BookOpen />}>Summary</PanelTitle>
          <p className="border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-foreground">{card.aiSummary}</p>
        </Panel>
      )}

      {history.length > 1 && (
        <Panel>
          <PanelTitle icon={<History />} action={trend ? <Pill tone={trend.tone}>{trend.text}</Pill> : undefined}>
            Term by term
          </PanelTitle>
          <ChartFrame className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="term" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Average"]} />
                <Area type="monotone" dataKey="average" stroke={CHART_PRIMARY} strokeWidth={3} fill={CHART_PRIMARY} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
      )}
    </div>
  );
}

function FactRow({
  icon,
  label,
  subject,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  subject: string | null;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/40 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {subject && <p className="truncate font-bold text-foreground">{subject}</p>}
        </div>
      </div>
      <span className="shrink-0 font-heading text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}
