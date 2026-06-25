"use client";

import { useState, useMemo, useRef } from "react";
import {
  Trophy, Clock, X, Target,
  TrendingUp, Download, Sparkles, Award,
  Loader2, ShieldCheck, Flame, CalendarDays, CheckCircle2,
  Zap, BarChart3, Lightbulb, ArrowUpRight, Gauge,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { getOverallSummary, type OverallSummary } from "@/lib/actions";
import { HOUR_MILESTONES, STREAK_MILESTONES } from "@/lib/grading";

const SUBJECT_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
          <span className="text-sm font-black text-slate-900" style={{ fontFamily: "sans-serif" }}>{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none">{label}</span>
      <span className="text-[9px] font-semibold text-slate-400 leading-none">{sub}</span>
    </div>
  );
}

export function OverallSummaryButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<OverallSummary | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const result = await getOverallSummary();
      if (!result) {
        toast.error("No study data yet — complete a few tasks first.");
        return;
      }
      setSummary(result);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

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
      pdf.save(`StudyFlow_Overall_Report_${format(new Date(), "yyyy_MM_dd")}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={isLoading}
        className="rounded-2xl gap-2 font-black h-[52px] px-6 text-xs uppercase tracking-widest shadow-sm"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
        Generate Overall Summary
      </Button>

      {summary && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[95vw] w-full p-0 overflow-hidden bg-background border-none rounded-[36px] shadow-[0_0_80px_rgba(0,0,0,0.15)] z-[110]">
            <OverallReportBody
              summary={summary}
              reportRef={reportRef}
              isGenerating={isGenerating}
              onDownload={handleDownloadPDF}
              onClose={() => setIsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function OverallReportBody({
  summary, reportRef, isGenerating, onDownload, onClose,
}: {
  summary: OverallSummary;
  reportRef: React.RefObject<HTMLDivElement | null>;
  isGenerating: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
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
  const maxWeekday = Math.max(1, ...summary.weekdayMinutes);
  const peakIdx = summary.weekdayMinutes.indexOf(Math.max(...summary.weekdayMinutes));

  const insights = useMemo(() => {
    const out: string[] = [];
    out.push(`You've logged ${fmtHM(summary.totalMinutes)} of total study time across ${summary.totalDaysSpanned} tracked days.`);
    if (summary.weekdayMinutes[peakIdx] > 0)
      out.push(`${DAY_LABELS[peakIdx]} is historically your strongest study day.`);
    out.push(`You've been active on ${summary.activeDays} distinct days, with a longest streak of ${summary.longestStreak} days.`);
    if (pieData.length > 0)
      out.push(`${pieData[0].name} has taken up the most of your time overall, at ${fmtHM(pieData[0].value)}.`);
    return out;
  }, [summary, peakIdx, pieData]);

  const components = [
    { label: "Avg. Hours/Wk", value: perf.components.hours, sub: fmtHM(summary.totalMinutes / Math.max(1, summary.totalDaysSpanned / 7)) },
    { label: "Consistency", value: perf.components.consistency, sub: `${summary.activeDays} active days` },
    { label: "Completion", value: perf.components.completion, sub: `${summary.completedSessions}/${summary.totalSessions}` },
    { label: "Streak", value: perf.components.streak, sub: `${summary.longestStreak} day best` },
  ];

  return (
    <div className="flex flex-col h-[92vh]">
      <div className="px-8 py-5 border-b flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0 select-none">
        <div className="text-left flex-1 space-y-0.5">
          <p className="text-[9px] font-black text-primary uppercase tracking-[0.25em]">Lifetime Performance Report</p>
          <DialogTitle className="text-2xl font-heading font-black tracking-tight">Overall Study Analytics</DialogTitle>
          <DialogDescription className="sr-only">All-time study performance, analytics and insights.</DialogDescription>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={onDownload} disabled={isGenerating} className="rounded-xl gap-2 font-black shadow-md h-12 px-6 text-xs uppercase tracking-widest">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-10 w-10 hover:bg-muted border">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 bg-[#e2e8f0] dark:bg-[#030303] flex justify-center">
        <div className="w-full max-w-[860px] pb-16">

          <div ref={reportRef} className="bg-white text-slate-900 p-8 md:p-12 shadow-2xl rounded-2xl space-y-9 relative overflow-hidden" style={{ fontFamily: "sans-serif" }}>

            <div className="flex justify-between items-start border-b border-slate-200 pb-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4 fill-current" />
                  </div>
                  <span className="font-black text-xl tracking-tighter uppercase">StudyFlow</span>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">All-Time Performance Report</p>
                  <h1 className="text-2xl font-black tracking-tight">
                    {format(new Date(summary.firstDate), "MMM do, yyyy")} — {format(new Date(summary.lastDate), "MMM do, yyyy")}
                  </h1>
                </div>
              </div>
              <div className="text-right space-y-1.5 text-xs">
                <p className="font-bold text-[9px] uppercase text-slate-400 leading-none">Report Type</p>
                <p className="font-black tracking-tight">LIFETIME</p>
                <p className="font-bold text-[9px] uppercase text-slate-400 leading-none pt-1.5">Issued</p>
                <p className="font-black tracking-tight">{format(new Date(), "MMM dd, yyyy")}</p>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden relative text-white shadow-lg"
                 style={{ background: `linear-gradient(135deg, ${theme.hex}, ${theme.hex}cc)` }}>
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
              <div className="relative p-7 flex flex-col md:flex-row items-center gap-7">
                <div className="shrink-0 w-32 h-32 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex flex-col items-center justify-center">
                  {summary.grade === "S" && <Trophy className="w-5 h-5 mb-1 text-amber-200" />}
                  <span className="text-6xl font-black tracking-tighter leading-none">{summary.grade}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-80">Avg. Grade</span>
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span className="px-2.5 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest">{perf.level}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{theme.ring}</span>
                  </div>
                  <p className="text-lg font-black leading-tight">{perf.feedback}</p>
                  <p className="text-sm font-medium opacity-90 leading-snug">Based on your average weekly performance across {summary.totalDaysSpanned} tracked days.</p>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-5xl font-black leading-none">{perf.score}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">out of 100</div>
                </div>
              </div>
            </div>

            <div>
              <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Lifetime Analytics</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { icon: Clock, label: "Total Hours", value: fmtHM(summary.totalMinutes), color: theme.hex },
                  { icon: CheckCircle2, label: "Completed", value: fmtHM(summary.completedMinutes), color: "#10b981" },
                  { icon: Zap, label: "Sessions Done", value: `${summary.completedSessions} / ${summary.totalSessions}`, color: "#3b82f6" },
                  { icon: CalendarDays, label: "Days Tracked", value: `${summary.totalDaysSpanned}`, color: "#f59e0b" },
                  { icon: Flame, label: "Current Streak", value: `${summary.currentStreak} days`, color: "#f97316" },
                  { icon: Trophy, label: "Longest Streak", value: `${summary.longestStreak} days`, color: "#a855f7" },
                ].map(s => (
                  <div key={s.label} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} /> {s.label}
                    </div>
                    <p className="text-2xl font-black tracking-tight" style={{ color: "#0f172a" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4">Average Weekly Performance</p>
              <div className="flex flex-wrap justify-around gap-4 bg-slate-50 border border-slate-200 rounded-xl py-5 px-2">
                {components.map(c => (
                  <Ring key={c.label} value={c.value} color={theme.hex} label={c.label} sub={c.sub} />
                ))}
              </div>
            </div>

            <div>
              <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4">Lifetime Distribution by Weekday</p>
              <div className="flex items-end justify-between gap-2 h-40 bg-slate-50 border border-slate-200 rounded-xl p-4">
                {summary.weekdayMinutes.map((mins, i) => {
                  const h = (mins / maxWeekday) * 100;
                  const isPeak = mins === maxWeekday && mins > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                      <span className="text-[8px] font-black text-slate-500">{mins > 0 ? fmtHM(mins) : ""}</span>
                      <div className="w-full rounded-t-md transition-all duration-700 min-h-[2px]"
                           style={{ height: `${Math.max(2, h)}%`, backgroundColor: isPeak ? theme.hex : `${theme.hex}66` }} />
                      <span className="text-[9px] font-black uppercase text-slate-400">{DAY_LABELS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {pieData.length > 0 && (
              <div>
                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4">Subject Allocation</p>
                <div className="space-y-3">
                  {pieData.map((item, i) => {
                    const pct = Math.round((item.value / summary.totalMinutes) * 100) || 0;
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                            <span className="font-black text-sm">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500 text-[10px] font-bold">{fmtHM(item.value)}</span>
                            <span className="font-black text-sm w-10 text-right" style={{ color: theme.hex }}>{pct}%</span>
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

            {insights.length > 0 && (
              <div>
                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Performance Insights</p>
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

            <div className="grid md:grid-cols-2 gap-5">
              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50">
                <p className="font-black text-[10px] uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Strengths</p>
                <ul className="space-y-2">
                  {perf.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5 rounded-xl border border-amber-200 bg-amber-50">
                <p className="font-black text-[10px] uppercase tracking-widest text-amber-700 mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Keep Improving</p>
                <ul className="space-y-2">
                  {perf.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                      <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Achievements</p>
              <div className="flex flex-wrap gap-2.5">
                {HOUR_MILESTONES.map(m => {
                  const earned = hours >= m;
                  return (
                    <div key={`h${m}`} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black",
                      earned ? "border-transparent text-white" : "border-slate-200 bg-slate-50 text-slate-300")}
                      style={earned ? { backgroundColor: theme.hex } : undefined}>
                      <Clock className="w-3.5 h-3.5" /> {m}h Club
                    </div>
                  );
                })}
                {STREAK_MILESTONES.map(m => {
                  const earned = summary.longestStreak >= m;
                  return (
                    <div key={`s${m}`} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black",
                      earned ? "border-transparent bg-orange-500 text-white" : "border-slate-200 bg-slate-50 text-slate-300")}>
                      <Flame className="w-3.5 h-3.5" /> {m}-Day Streak
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 flex items-end justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Verified Local Record</p>
                  <p className="text-[8px] font-medium text-slate-400 max-w-[260px] leading-tight">Generated from your complete StudyFlow study history.</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-serif italic font-black text-lg text-slate-400">StudyFlow Engine</span>
                <div className="h-[1.5px] w-32 bg-slate-300 mt-1 ml-auto" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Performance Registrar</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
