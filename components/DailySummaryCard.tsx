"use client";

import { useState, useMemo, useRef } from "react";
import {
  Clock, BrainCircuit, X, Target,
  Download, Sparkles,
  Loader2, ShieldCheck, Flame, CalendarDays, CheckCircle2,
  Zap, Lightbulb, ArrowUpRight, ListChecks, Star,
  type LucideIcon,
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
import type { EnrichedDailySummary } from "@/lib/actions";

interface DailySummaryCardProps {
  summary: EnrichedDailySummary;
}

const SUBJECT_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4"];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
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
          <span className="text-sm font-black text-slate-900" style={{ fontFamily: "sans-serif" }}>{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none">{label}</span>
      <span className="text-[9px] font-semibold text-slate-400 leading-none">{sub}</span>
    </div>
  );
}

export function DailySummaryCard({ summary }: DailySummaryCardProps) {
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

  const insights = useMemo(() => {
    const out: string[] = [];
    if (perf.improvementPct !== null) {
      if (perf.improvementPct >= 5)
        out.push(`You studied ${Math.round(perf.improvementPct)}% more than yesterday.`);
      else if (perf.improvementPct <= -5)
        out.push(`Study time dropped ${Math.abs(Math.round(perf.improvementPct))}% from yesterday — aim to bounce back.`);
      else out.push(`Your study time held steady compared to yesterday.`);
    }
    if (topSubjects.length > 0)
      out.push(`${topSubjects[0].name} got the most attention today, at ${fmtHM(topSubjects[0].value)}.`);
    if (summary.currentStreak > 0)
      out.push(`You're on a ${summary.currentStreak}-day study streak.`);
    if (summary.totalSessions > 0)
      out.push(`You completed ${summary.completedSessions} of ${summary.totalSessions} scheduled sessions today.`);
    return out;
  }, [perf, topSubjects, summary.currentStreak, summary.completedSessions, summary.totalSessions]);

  const badges = useMemo(() => {
    const out: { label: string; icon: LucideIcon }[] = [];
    if (summary.totalSessions > 0 && summary.completedSessions === summary.totalSessions) out.push({ label: "Completionist", icon: CheckCircle2 });
    if (hours >= 5) out.push({ label: "Deep Work Day", icon: Zap });
    if (summary.currentStreak >= 7) out.push({ label: "Week+ Streak", icon: Flame });
    if (summary.currentStreak >= 30) out.push({ label: "30-Day Streak", icon: Star });
    return out;
  }, [summary.totalSessions, summary.completedSessions, summary.currentStreak, hours]);

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
      pdf.save(`StudyFlow_Daily_Report_${format(new Date(summary.date), "yyyy_MM_dd")}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const components = [
    { label: "Hours", value: perf.components.hours, sub: fmtHM(summary.totalMinutes) },
    { label: "Completion", value: perf.components.completion, sub: `${summary.completedSessions}/${summary.totalSessions}` },
    { label: "Streak", value: perf.components.streak, sub: `${summary.currentStreak} day run` },
    { label: "Momentum", value: perf.components.improvement, sub: perf.improvementPct === null ? "baseline" : `${perf.improvementPct >= 0 ? "+" : ""}${Math.round(perf.improvementPct)}%` },
  ];

  return (
    <div className="group bg-card/65 backdrop-blur-md border border-border/50 rounded-[36px] p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/20 transition-all duration-400 overflow-hidden relative flex flex-col justify-between min-h-[380px]">

      <div className={cn("absolute -top-16 -right-16 w-44 h-44 rounded-full blur-[80px] opacity-15 pointer-events-none transition-all duration-700 group-hover:scale-125 group-hover:opacity-25", theme.glow)} />
      <div className={cn("absolute top-0 left-8 w-14 h-1.5 rounded-b-md", theme.glow)} />

      <div className={cn("absolute top-7 right-7 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border shadow-sm bg-background/80 backdrop-blur-sm select-none transition-transform duration-500 group-hover:scale-105", theme.border)}>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">GRADE</span>
        <span className={cn("text-4xl font-heading font-black tracking-tighter mt-1", theme.text)}>{summary.grade}</span>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-primary font-black uppercase tracking-[0.2em] text-[9px] select-none">
            <BrainCircuit className="w-3.5 h-3.5" /> Daily Report
          </div>
          <h3 className="text-3xl font-heading font-black tracking-tight leading-none text-foreground pr-24 mt-1">
            {format(new Date(summary.date), "EEEE")}
          </h3>
          <p className="text-sm font-bold text-muted-foreground/70">{format(new Date(summary.date), "MMMM do, yyyy")}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className={cn("text-xs font-black uppercase tracking-wider", theme.text)}>{perf.level}</span>
            <span className="text-xs font-bold text-muted-foreground">· {perf.score}/100</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Clock, label: "Studied", value: fmtHM(summary.totalMinutes), c: "text-primary" },
            { icon: CheckCircle2, label: "Sessions", value: `${summary.completedSessions}/${summary.totalSessions}`, c: "text-success" },
            { icon: Flame, label: "Streak", value: `${summary.currentStreak}d`, c: "text-amber-500" },
          ].map(s => (
            <div key={s.label} className="p-3.5 bg-muted/20 border border-border/40 rounded-2xl">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5 font-black uppercase tracking-widest text-[8px] select-none">
                <s.icon className={cn("w-3 h-3", s.c)} /> {s.label}
              </div>
              <p className="text-xl font-heading font-black leading-none">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
            <span>Performance Score</span><span>{perf.score}/100</span>
          </div>
          <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${perf.score}%`, backgroundColor: theme.hex }} />
          </div>
        </div>

        {topSubjects.length > 0 && (
          <div className="space-y-2 bg-muted/10 border border-border/30 p-4 rounded-2xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 select-none">Top Focus Areas</p>
            <div className="flex flex-col gap-2">
              {topSubjects.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-xs font-bold text-foreground/80">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }} />
                    <span className="truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-black shrink-0 bg-muted px-2 py-0.5 rounded-md border border-border/40">{fmtHM(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/30">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button className="w-full h-13 py-3.5 rounded-2xl bg-[#0f172a] dark:bg-white text-white dark:text-black hover:scale-[1.01] active:scale-95 transition-all duration-300 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
              View Full Report <Sparkles className="w-4 h-4 fill-current" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[95vw] w-full p-0 overflow-hidden bg-background border-none rounded-[36px] shadow-[0_0_80px_rgba(0,0,0,0.15)] z-[110]">
            <div className="flex flex-col h-[92vh]">
              <div className="px-8 py-5 border-b flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0 select-none">
                <div className="text-left flex-1 space-y-0.5">
                  <p className="text-[9px] font-black text-primary uppercase tracking-[0.25em]">Performance Report</p>
                  <DialogTitle className="text-2xl font-heading font-black tracking-tight">Daily Study Analytics</DialogTitle>
                  <DialogDescription className="sr-only">Detailed daily study performance, analytics and insights.</DialogDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleDownloadPDF} disabled={isGenerating} className="rounded-xl gap-2 font-black shadow-md h-12 px-6 text-xs uppercase tracking-widest">
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PDF
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-xl h-10 w-10 hover:bg-muted border">
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
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Daily Performance Report</p>
                          <h1 className="text-2xl font-black tracking-tight">
                            {format(new Date(summary.date), "EEEE, MMMM do, yyyy")}
                          </h1>
                        </div>
                      </div>
                      <div className="text-right space-y-1.5 text-xs">
                        <p className="font-bold text-[9px] uppercase text-slate-400 leading-none">Report ID</p>
                        <p className="font-black tracking-tight">SF-{summary.id.substring(0, 8).toUpperCase()}</p>
                        <p className="font-bold text-[9px] uppercase text-slate-400 leading-none pt-1.5">Issued</p>
                        <p className="font-black tracking-tight">{format(new Date(), "MMM dd, yyyy")}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl overflow-hidden relative text-white shadow-lg"
                         style={{ background: `linear-gradient(135deg, ${theme.hex}, ${theme.hex}cc)` }}>
                      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative p-7 flex flex-col md:flex-row items-center gap-7">
                        <div className="shrink-0 w-32 h-32 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex flex-col items-center justify-center">
                          <span className="text-6xl font-black tracking-tighter leading-none">{summary.grade}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-80">Grade</span>
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-2">
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            <span className="px-2.5 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest">{perf.level}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{theme.ring}</span>
                          </div>
                          <p className="text-lg font-black leading-tight">{perf.feedback}</p>
                          <p className="text-sm font-medium opacity-90 leading-snug">{perf.detail}</p>
                        </div>
                        <div className="shrink-0 text-center">
                          <div className="text-5xl font-black leading-none">{perf.score}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">out of 100</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Today&apos;s Analytics</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { icon: Clock, label: "Scheduled", value: fmtHM(summary.totalMinutes), color: theme.hex },
                          { icon: CheckCircle2, label: "Completed", value: fmtHM(summary.completedMinutes), color: "#10b981" },
                          { icon: ListChecks, label: "Sessions Done", value: `${summary.completedSessions} / ${summary.totalSessions}`, color: "#3b82f6" },
                          { icon: Flame, label: "Current Streak", value: `${summary.currentStreak} days`, color: "#f97316" },
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
                      <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4">Score Breakdown</p>
                      <div className="flex flex-wrap justify-around gap-4 bg-slate-50 border border-slate-200 rounded-xl py-5 px-2">
                        {components.map(c => (
                          <Ring key={c.label} value={c.value} color={theme.hex} label={c.label} sub={c.sub} />
                        ))}
                      </div>
                    </div>

                    {summary.tasks.length > 0 && (
                      <div>
                        <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Today&apos;s Timeline</p>
                        <div className="space-y-2">
                          {summary.tasks.map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", t.isDone ? "bg-emerald-500" : "bg-slate-300")} />
                                <span className="font-black text-sm">{t.subject}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400">{fmtTime(t.startTime)} – {fmtTime(t.endTime)}</span>
                                {t.isDone
                                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  : <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Pending</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                        <p className="font-black text-[10px] uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Strengths</p>
                        <ul className="space-y-2">
                          {perf.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-5 rounded-xl border border-amber-200 bg-amber-50">
                        <p className="font-black text-[10px] uppercase tracking-widest text-amber-700 mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Focus Tomorrow</p>
                        <ul className="space-y-2">
                          {perf.improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                              <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {badges.length > 0 && (
                      <div>
                        <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-4 flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Today&apos;s Badges</p>
                        <div className="flex flex-wrap gap-2.5">
                          {badges.map(b => (
                            <div key={b.label} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-transparent text-white text-xs font-black" style={{ backgroundColor: theme.hex }}>
                              <b.icon className="w-3.5 h-3.5" /> {b.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-slate-200 flex items-end justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Verified Local Record</p>
                          <p className="text-[8px] font-medium text-slate-400 max-w-[260px] leading-tight">Generated from your StudyFlow study data. Score reflects effort, completion and momentum.</p>
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
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
