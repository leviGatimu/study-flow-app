"use client";

import { useState, useMemo, useRef } from "react";
import {
  Trophy, Clock, BrainCircuit, X, Target,
  TrendingUp, Download, Sparkles, Award,
  Loader2, ShieldCheck, Flame, CalendarDays, CheckCircle2,
  Zap, BarChart3, Lightbulb, ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { EnrichedWeeklySummary } from "@/lib/actions";
import { nextHourMilestone, HOUR_MILESTONES, STREAK_MILESTONES } from "@/lib/grading";

interface SummaryCardProps {
  summary: EnrichedWeeklySummary;
}

const SUBJECT_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Small SVG progress ring. */
function Ring({ value, color, label, sub }: { value: number; color: string; label: string; sub: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[76px] h-[76px]">
        <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle
            cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-900" style={{ fontFamily: "sans-serif" }}>{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-500 leading-none">{label}</span>
      <span className="text-xs text-slate-400 leading-none">{sub}</span>
    </div>
  );
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const perf = summary.performance;
  const theme = perf.theme;

  const breakdown = useMemo(() => {
    try { return JSON.parse(summary.subjectBreakdown) as Record<string, number>; }
    catch { return {}; }
  }, [summary.subjectBreakdown]);

  const pieData = useMemo(() =>
    Object.entries(breakdown)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value),
  [breakdown]);

  const hours = summary.totalMinutes / 60;
  const topSubjects = pieData.slice(0, 3);
  const maxDaily = Math.max(1, ...summary.dailyMinutes);
  const milestone = nextHourMilestone(hours);

  // --- Insights (data-driven) ---
  const insights = useMemo(() => {
    const out: string[] = [];
    if (perf.improvementPct !== null) {
      if (perf.improvementPct >= 5)
        out.push(`You studied ${Math.round(perf.improvementPct)}% more than last week.`);
      else if (perf.improvementPct <= -5)
        out.push(`Study time dropped ${Math.abs(Math.round(perf.improvementPct))}% from last week — aim to bounce back.`);
      else out.push(`Your study time held steady compared to last week.`);
    }
    const peakIdx = summary.dailyMinutes.indexOf(Math.max(...summary.dailyMinutes));
    if (summary.dailyMinutes[peakIdx] > 0)
      out.push(`${DAY_LABELS[peakIdx]} was your most productive day with ${fmtHM(summary.dailyMinutes[peakIdx])}.`);
    if (summary.activeDays > 0)
      out.push(`You stayed consistent across ${summary.activeDays} of 7 days.`);
    if (milestone && milestone.remaining > 0)
      out.push(`You're ${milestone.remaining.toFixed(1)} hours away from the ${milestone.target}h milestone.`);
    return out;
  }, [perf, summary.dailyMinutes, summary.activeDays, milestone]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      const imgData = await toPng(reportRef.current, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const props = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (props.height * pdfWidth) / props.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      pdf.save(`StudyFlow_Weekly_Report_${format(new Date(summary.startDate), "yyyy_MM_dd")}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const components = [
    { label: "Hours", value: perf.components.hours, sub: fmtHM(summary.totalMinutes) },
    { label: "Consistency", value: perf.components.consistency, sub: `${summary.activeDays}/7 days` },
    { label: "Completion", value: perf.components.completion, sub: `${summary.completedSessions}/${summary.totalSessions}` },
    { label: "Streak", value: perf.components.streak, sub: `${summary.weekStreak} day run` },
    { label: "Momentum", value: perf.components.improvement, sub: perf.improvementPct === null ? "baseline" : `${perf.improvementPct >= 0 ? "+" : ""}${Math.round(perf.improvementPct)}%` },
  ];

  return (
    <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 hover:shadow-md transition-shadow duration-200 overflow-hidden relative flex flex-col justify-between min-h-[380px]">

      {/* Status stripe — colour reports the grade tier, not decoration */}
      <div className={cn("absolute top-0 left-8 w-14 h-1.5 rounded-b-md", theme.glow)} />

      {/* Grade seal */}
      <div className={cn("absolute top-6 right-6 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border shadow-sm bg-background select-none", theme.border)}>
        <span className="text-xs font-medium text-muted-foreground/70 leading-none">Grade</span>
        <span className={cn("text-4xl font-heading font-black tracking-tighter mt-1", theme.text)}>{summary.grade}</span>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold select-none">
            <BrainCircuit className="w-3.5 h-3.5" /> Weekly report
          </div>
          <h3 className="text-2xl font-heading font-bold tracking-tight leading-none text-foreground pr-24 mt-1">
            {format(new Date(summary.startDate), "MMM do")} — {format(new Date(summary.endDate), "MMM do")}
          </h3>
          <div className="flex items-center gap-2 pt-1">
            <span className={cn("text-xs font-semibold", theme.text)}>{perf.level}</span>
            <span className="text-xs font-medium text-muted-foreground">· {perf.score}/100</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Clock, label: "Studied", value: fmtHM(summary.totalMinutes), c: "text-primary" },
            { icon: CheckCircle2, label: "Sessions", value: `${summary.completedSessions}`, c: "text-success" },
            { icon: CalendarDays, label: "Days", value: `${summary.activeDays}/7`, c: "text-amber-500" },
          ].map(s => (
            <div key={s.label} className="p-3.5 bg-muted/30 border border-border/40 rounded-xl">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5 text-xs font-medium select-none">
                <s.icon className={cn("w-3.5 h-3.5", s.c)} /> {s.label}
              </div>
              <p className="text-lg font-heading font-bold leading-none">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Performance score</span><span>{perf.score}/100</span>
          </div>
          <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${perf.score}%`, backgroundColor: theme.hex }} />
          </div>
        </div>

        {topSubjects.length > 0 && (
          <div className="space-y-2 bg-muted/20 border border-border/30 p-4 rounded-xl">
            <p className="text-xs font-medium text-muted-foreground select-none">Top focus areas</p>
            <div className="flex flex-col gap-2">
              {topSubjects.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-sm font-medium text-foreground/80">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }} />
                    <span className="truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-md border border-border/40">{fmtHM(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/30">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-11 rounded-xl gap-2 text-sm font-semibold shadow-sm">
              View full report <Sparkles className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[95vw] w-full p-0 overflow-hidden bg-background border-none rounded-2xl shadow-2xl z-[110]">
            <div className="flex flex-col h-[92vh]">
              <div className="px-8 py-5 border-b flex items-center justify-between bg-card shrink-0">
                <div className="text-left flex-1 space-y-0.5">
                  <p className="text-xs font-semibold text-primary">Performance report</p>
                  <DialogTitle className="text-2xl font-heading font-bold tracking-tight">Weekly study analytics</DialogTitle>
                  <DialogDescription className="sr-only">Detailed weekly study performance, analytics and insights.</DialogDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleDownloadPDF} disabled={isGenerating} className="rounded-xl gap-2 shadow-sm h-11 px-5 text-sm font-semibold">
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close report"
                    className="rounded-xl h-10 w-10 hover:bg-muted border"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 bg-[#e2e8f0] dark:bg-[#030303] flex justify-center">
                <div className="w-full max-w-[860px] pb-16">

                  {/* ===== REPORT SHEET (also the PDF) ===== */}
                  <div ref={reportRef} className="bg-white text-slate-900 p-8 md:p-12 shadow-2xl rounded-2xl space-y-9 relative overflow-hidden" style={{ fontFamily: "sans-serif" }}>

                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                            <Sparkles className="w-4 h-4 fill-current" />
                          </div>
                          <span className="font-black text-xl tracking-tighter uppercase">StudyFlow</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400">Weekly performance report</p>
                          <h1 className="text-2xl font-bold tracking-tight">
                            {format(new Date(summary.startDate), "MMMM do")} — {format(new Date(summary.endDate), "MMMM do, yyyy")}
                          </h1>
                        </div>
                      </div>
                      <div className="text-right space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-400 leading-none">Report ID</p>
                        <p className="font-semibold tracking-tight">SF-{summary.id.substring(0, 8).toUpperCase()}</p>
                        <p className="font-semibold text-slate-400 leading-none pt-1.5">Issued</p>
                        <p className="font-semibold tracking-tight">{format(new Date(), "MMM dd, yyyy")}</p>
                      </div>
                    </div>

                    {/* HERO GRADE CARD */}
                    <div className="rounded-2xl overflow-hidden relative text-white shadow-lg"
                         style={{ background: `linear-gradient(135deg, ${theme.hex}, ${theme.hex}cc)` }}>
                      <div className="relative p-7 flex flex-col md:flex-row items-center gap-7">
                        {/* Grade badge */}
                        <div className="shrink-0 w-32 h-32 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex flex-col items-center justify-center">
                          {summary.grade === "S" && <Trophy className="w-5 h-5 mb-1 text-amber-200" />}
                          <span className="text-6xl font-black tracking-tighter leading-none">{summary.grade}</span>
                          <span className="text-xs font-semibold mt-1.5 opacity-80">Grade</span>
                        </div>
                        {/* Message */}
                        <div className="flex-1 text-center md:text-left space-y-2">
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">{perf.level}</span>
                            <span className="text-xs font-semibold opacity-80">{theme.ring}</span>
                          </div>
                          <p className="text-lg font-bold leading-tight">{perf.feedback}</p>
                          <p className="text-sm font-medium opacity-90 leading-snug">{perf.detail}</p>
                        </div>
                        {/* Score */}
                        <div className="shrink-0 text-center">
                          <div className="text-5xl font-black leading-none">{perf.score}</div>
                          <div className="text-xs font-semibold opacity-80 mt-1">out of 100</div>
                        </div>
                      </div>
                    </div>

                    {/* ANALYTICS DASHBOARD */}
                    <div>
                      <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Study analytics</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { icon: Clock, label: "Scheduled hours", value: fmtHM(summary.totalMinutes), color: theme.hex },
                          { icon: CheckCircle2, label: "Completed", value: fmtHM(summary.completedMinutes), color: "#10b981" },
                          { icon: Zap, label: "Sessions done", value: `${summary.completedSessions} / ${summary.totalSessions}`, color: "#3b82f6" },
                          { icon: CalendarDays, label: "Active days", value: `${summary.activeDays} / 7`, color: "#f59e0b" },
                          { icon: Flame, label: "Current streak", value: `${summary.currentStreak} days`, color: "#f97316" },
                          { icon: Trophy, label: "Longest streak", value: `${summary.longestStreak} days`, color: "#a855f7" },
                        ].map(s => (
                          <div key={s.label} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} /> {s.label}
                            </div>
                            <p className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SCORE BREAKDOWN RINGS */}
                    <div>
                      <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4">Score breakdown</p>
                      <div className="flex flex-wrap justify-around gap-4 bg-slate-50 border border-slate-200 rounded-xl py-5 px-2">
                        {components.map(c => (
                          <Ring key={c.label} value={c.value} color={theme.hex} label={c.label} sub={c.sub} />
                        ))}
                      </div>
                    </div>

                    {/* DAILY STUDY CHART */}
                    <div>
                      <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4">Daily study distribution</p>
                      <div className="flex items-end justify-between gap-2 h-40 bg-slate-50 border border-slate-200 rounded-xl p-4">
                        {summary.dailyMinutes.map((mins, i) => {
                          const h = (mins / maxDaily) * 100;
                          const isPeak = mins === maxDaily && mins > 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                              <span className="text-xs font-medium text-slate-500">{mins > 0 ? fmtHM(mins) : ""}</span>
                              <div className="w-full rounded-t-md transition-all duration-700 min-h-[2px]"
                                   style={{ height: `${Math.max(2, h)}%`, backgroundColor: isPeak ? theme.hex : `${theme.hex}66` }} />
                              <span className="text-xs font-medium text-slate-400">{DAY_LABELS[i]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SUBJECT DISTRIBUTION */}
                    {pieData.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4">Subject allocation</p>
                        <div className="space-y-3">
                          {pieData.map((item, i) => {
                            const pct = Math.round((item.value / summary.totalMinutes) * 100) || 0;
                            return (
                              <div key={item.name} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                                    <span className="font-semibold text-sm">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-slate-500 text-xs font-medium">{fmtHM(item.value)}</span>
                                    <span className="font-semibold text-sm w-10 text-right" style={{ color: theme.hex }}>{pct}%</span>
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* INSIGHTS */}
                    {insights.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Performance insights</p>
                        <div className="grid md:grid-cols-2 gap-3">
                          {insights.map((ins, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                              <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme.hex }} />
                              <p className="text-sm font-semibold text-slate-700 leading-snug">{ins}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STRENGTHS / IMPROVEMENTS */}
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50">
                        <p className="font-semibold text-xs text-emerald-700 mb-3 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Strengths</p>
                        <ul className="space-y-2">
                          {perf.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5 rounded-xl border border-amber-200 bg-amber-50">
                        <p className="font-semibold text-xs text-amber-700 mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Focus next week</p>
                        <ul className="space-y-2">
                          {perf.improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                              <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* ACHIEVEMENTS */}
                    <div>
                      <p className="font-semibold text-xs text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Achievements</p>
                      <div className="flex flex-wrap gap-2.5">
                        {HOUR_MILESTONES.map(m => {
                          const earned = hours >= m;
                          return (
                            <div key={`h${m}`} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold",
                              earned ? "border-transparent text-white" : "border-slate-200 bg-slate-50 text-slate-300")}
                              style={earned ? { backgroundColor: theme.hex } : undefined}>
                              <Clock className="w-3.5 h-3.5" /> {m}h Club
                            </div>
                          );
                        })}
                        {STREAK_MILESTONES.map(m => {
                          const earned = summary.weekStreak >= m || summary.longestStreak >= m;
                          return (
                            <div key={`s${m}`} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold",
                              earned ? "border-transparent bg-orange-500 text-white" : "border-slate-200 bg-slate-50 text-slate-300")}>
                              <Flame className="w-3.5 h-3.5" /> {m}-Day Streak
                            </div>
                          );
                        })}
                        {summary.activeDays >= 5 && (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold">
                            <CalendarDays className="w-3.5 h-3.5" /> Consistency Pro
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-6 border-t border-slate-200 flex items-end justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-600">Verified local record</p>
                          <p className="text-xs font-medium text-slate-400 max-w-[260px] leading-tight">Generated from your StudyFlow study data. Score reflects effort, consistency and improvement.</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-serif italic font-black text-lg text-slate-400">StudyFlow Engine</span>
                        <div className="h-[1.5px] w-32 bg-slate-300 mt-1 ml-auto" />
                        <p className="text-xs font-semibold text-slate-400 mt-1">Performance registrar</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
