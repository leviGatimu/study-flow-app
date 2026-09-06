"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import {
  Activity, Target, Brain, GraduationCap, Clock, Flame, Trophy,
  AlertTriangle, Sparkles, TrendingUp, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightsData, SubjectInsight } from "@/lib/insights-actions";

const TOOLTIP_STYLE = {
  borderRadius: "16px",
  border: "1px solid var(--border)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  fontWeight: "bold" as const,
  fontSize: "11px",
  background: "var(--card)",
  color: "var(--foreground)",
};

const BAR_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4"];

function attentionColor(score: number) {
  if (score >= 60) return { text: "text-red-500", bg: "bg-red-500", soft: "bg-red-500/10 border-red-500/20" };
  if (score >= 35) return { text: "text-orange-500", bg: "bg-orange-500", soft: "bg-orange-500/10 border-orange-500/20" };
  if (score >= 20) return { text: "text-yellow-500", bg: "bg-yellow-500", soft: "bg-yellow-500/10 border-yellow-500/20" };
  return { text: "text-emerald-500", bg: "bg-emerald-500", soft: "bg-emerald-500/10 border-emerald-500/20" };
}

export function InsightsClient({ data }: { data: InsightsData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { headline, subjects, gradeTrajectory, quizTrend } = data;
  const attentionList = subjects.filter((s) => s.attentionScore >= 20).slice(0, 5);
  const goalRows = subjects.filter((s) => s.grade != null && s.target != null);

  if (!mounted) {
    return (
      <div className="space-y-8 max-w-[1600px] mx-auto animate-pulse pb-16 px-4 md:px-8 pt-6">
        <div className="h-20 bg-muted/30 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-muted/30 rounded-2xl" />)}
        </div>
        <div className="h-80 bg-muted/30 rounded-2xl" />
      </div>
    );
  }

  const hasAnyData = subjects.length > 0;

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pt-6 pb-2 border-b border-border/40 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Your academic performance across grades, quizzes, mastery and effort — synthesized.
          </p>
        </div>
        <Link
          href={`/ai?prompt=${encodeURIComponent(
            attentionList.length > 0
              ? `Based on my study insights, my subjects needing the most attention are: ${attentionList
                  .map((s) => `${s.subject} (${s.reason.toLowerCase()})`)
                  .join(", ")}. Build me a focused study plan for the next two weeks.`
              : "Review my study insights and suggest how I can keep improving."
          )}`}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shrink-0 self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          Get AI study plan
        </Link>
      </div>

      {!hasAnyData ? (
        <div className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
          No data yet. Complete tasks, take tutor quizzes, track topic mastery, set goals and upload report cards —
          your insights will build up here.
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
            <StatCard label="Subjects Tracked" value={headline.subjectsTracked}
              icon={<GraduationCap className="w-5 h-5 text-blue-500" />} border="border-blue-500/10" />
            <StatCard label="Avg Completion" value={headline.avgCompletion != null ? `${headline.avgCompletion}%` : "—"}
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} border="border-emerald-500/10" />
            <StatCard label="Avg Mastery" value={headline.avgMastery != null ? `${headline.avgMastery}%` : "—"}
              icon={<Brain className="w-5 h-5 text-violet-500" />} border="border-violet-500/10" />
            <StatCard label="Avg Quiz Score" value={headline.avgQuiz != null ? `${headline.avgQuiz}%` : "—"}
              icon={<Target className="w-5 h-5 text-orange-500" />} border="border-orange-500/10" />
            <StatCard label="Focus Time" value={`${Math.round(headline.focusMinutes / 60)}h`}
              icon={<Clock className="w-5 h-5 text-teal-500" />} border="border-teal-500/10" />
            <StatCard label="Level / Streak" value={`L${headline.level} · ${headline.currentStreak}d`}
              icon={<Flame className="w-5 h-5 text-red-500" />} border="border-red-500/10" />
          </div>

          {/* Subjects needing attention */}
          <div className="bg-card border border-orange-500/20 rounded-2xl p-8 shadow-sm">
            <h3 className="font-heading font-bold text-lg mb-1 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Needs your attention
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Ranked by performance gaps and exam urgency.</p>

            {attentionList.length === 0 ? (
              <div className="flex items-center gap-3 bg-muted/50 border border-emerald-500/20 rounded-2xl p-5 text-sm font-medium text-foreground">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                Everything looks on track. Keep the momentum going!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {attentionList.map((s) => {
                  const c = attentionColor(s.attentionScore);
                  return (
                    <Link
                      key={s.subject}
                      href={`/ai?prompt=${encodeURIComponent(`Help me improve in ${s.subject}. My current situation: ${s.reason.toLowerCase()}, completion ${s.completionRate}%${s.masteryPct != null ? `, mastery ${s.masteryPct}%` : ""}${s.quizAvg != null ? `, quiz average ${s.quizAvg}%` : ""}. What should I focus on?`)}`}
                      className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-heading font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">{s.subject}</span>
                        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", c.soft, c.text)}>
                          {s.attentionScore}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 capitalize">{s.reason}</p>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full", c.bg)} style={{ width: `${s.attentionScore}%` }} />
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs font-medium text-muted-foreground/60">
                        <span>Done {s.completionRate}%</span>
                        {s.masteryPct != null && <span>· Mastery {s.masteryPct}%</span>}
                        {s.nextExamDays != null && s.nextExamDays <= 14 && (
                          <span className="text-red-500">· Exam {s.nextExamDays}d</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Grade trajectory */}
            <div className="lg:col-span-6 bg-card border border-border/60 p-8 rounded-2xl shadow-sm">
              <div className="mb-6">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-primary" /> Grade Trajectory
                </h3>
                <p className="text-sm text-muted-foreground">Overall average across your report cards.</p>
              </div>
              <div className="h-[280px] w-full">
                {gradeTrajectory.length >= 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gradeTrajectory} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} unit="%" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, "Average"]} />
                      <Line type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart icon={<GraduationCap className="w-8 h-8" />} text="Upload report cards in Marks to track your grade trend." />
                )}
              </div>
            </div>

            {/* Quiz performance */}
            <div className="lg:col-span-6 bg-card border border-border/60 p-8 rounded-2xl shadow-sm">
              <div className="mb-6">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 text-orange-500" /> Quiz Performance
                </h3>
                <p className="text-sm text-muted-foreground">Score on each tutor quiz attempt over time.</p>
              </div>
              <div className="h-[280px] w-full">
                {quizTrend.length >= 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={quizTrend} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="quizGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} unit="%" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, _n: any, p: any) => [`${v}%`, p?.payload?.subject || "Score"]} />
                      <Area type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2.5} fill="url(#quizGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart icon={<Target className="w-8 h-8" />} text="Take quizzes in the AI Tutor to see your performance curve." />
                )}
              </div>
            </div>
          </div>

          {/* Goal vs actual */}
          {goalRows.length > 0 && (
            <div className="bg-card border border-border/60 p-8 rounded-2xl shadow-sm">
              <div className="mb-6">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-yellow-500" /> Goals vs Actual
                </h3>
                <p className="text-sm text-muted-foreground">Where your latest grades stand against your targets.</p>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={goalRows.map((s) => ({ subject: s.subject, Actual: s.grade, Target: s.target }))} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "var(--muted-foreground)" }} unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                    <Bar dataKey="Actual" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Target" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} fillOpacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-subject breakdown table */}
          <div className="space-y-5">
            <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">Subject Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {subjects.map((s) => <SubjectCard key={s.subject} s={s} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubjectCard({ s }: { s: SubjectInsight }) {
  const c = attentionColor(s.attentionScore);
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h4 className="font-heading font-bold text-lg text-foreground truncate">{s.subject}</h4>
        {s.gradeLabel ? (
          <span className="text-sm font-black px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{s.gradeLabel}</span>
        ) : (
          <span className={cn("w-2.5 h-2.5 rounded-full", c.bg)} title={s.reason} />
        )}
      </div>
      <div className="space-y-4">
        <Meter label="Completion" value={s.completionRate} color="#10b981" suffix="%" />
        <Meter label="Topic Mastery" value={s.masteryPct} color="#8b5cf6" suffix="%" />
        <Meter label="Quiz Average" value={s.quizAvg} color="#f97316" suffix="%" />
      </div>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40 text-xs font-medium text-muted-foreground/60">
        <span>{Math.round(s.minutes / 60)}h studied</span>
        {s.target != null && <span>Target {s.target}%</span>}
        {s.nextExamDays != null && s.nextExamDays <= 30 && (
          <span className="text-red-500">Exam {s.nextExamDays}d</span>
        )}
      </div>
    </div>
  );
}

function Meter({ label, value, color, suffix = "" }: { label: string; value: number | null; color: string; suffix?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
        <span className="text-xs font-black text-foreground">{value != null ? `${value}${suffix}` : "—"}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        {value != null && (
          <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, border }: { label: string; value: string | number; icon: React.ReactNode; border?: string }) {
  return (
    <div className={cn("bg-card border p-6 rounded-2xl shadow-sm", border)}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-muted/60 rounded-2xl">{icon}</div>
        <span className="text-2xl font-heading font-black tracking-tight text-foreground">{value}</span>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyChart({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center gap-3">
      <div className="p-4 bg-muted/60 rounded-full text-muted-foreground/30">{icon}</div>
      <p className="text-sm text-muted-foreground max-w-[240px]">{text}</p>
    </div>
  );
}
