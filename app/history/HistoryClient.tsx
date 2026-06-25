"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area
} from 'recharts';
import { 
  CheckCircle2, BookOpen, Repeat, Trophy, XCircle, 
  Zap, Clock, FileEdit, FileText, Search, ArrowUpDown, 
  Filter, Calendar, ChevronDown, ChevronUp, Eye, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskWithTemplate, UserProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, subDays, isAfter, startOfDay, differenceInDays } from 'date-fns';
import { Input } from "@/components/ui/input";
import { DeleteTaskButton } from "@/components/DeleteTaskButton";

interface HistoryClientProps {
  tasks: TaskWithTemplate[];
  userProgress: UserProgress | null;
}

type TabType = "ALL" | "HOMEWORK" | "REVISION" | "MISSED";
type PeriodType = "ALL" | "7_DAYS" | "30_DAYS";
type SortType = "DATE_DESC" | "DATE_ASC" | "SUBJECT" | "DURATION";

export function HistoryClient({ tasks, userProgress }: HistoryClientProps) {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [timeRange, setTimeRange] = useState<PeriodType>("ALL");
  const [sortBy, setSortBy] = useState<SortType>("DATE_DESC");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper: Get task duration in minutes
  const getTaskMinutes = (t: TaskWithTemplate): number => {
    try {
      const [sH, sM] = t.startTime.split(':').map(Number);
      const [eH, eM] = t.endTime.split(':').map(Number);
      let mins = (eH * 60 + eM) - (sH * 60 + sM);
      if (mins < 0) mins += 1440; // Handle cross-midnight
      return Math.max(0, mins);
    } catch (e) {
      return 0;
    }
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // 1. Filter by search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.subject.toLowerCase().includes(term) || 
        (t.workDescription && t.workDescription.toLowerCase().includes(term))
      );
    }

    // 2. Filter by tab status/type
    if (activeTab === "HOMEWORK") {
      result = result.filter(t => t.type === "HOMEWORK" && t.isDone);
    } else if (activeTab === "REVISION") {
      result = result.filter(t => t.type === "REVISION" && t.isDone);
    } else if (activeTab === "MISSED") {
      result = result.filter(t => t.isMissed);
    }

    // 3. Filter by time period
    if (timeRange !== "ALL") {
      const daysLimit = timeRange === "7_DAYS" ? 7 : 30;
      const cutoffDate = startOfDay(subDays(new Date(), daysLimit));
      result = result.filter(t => isAfter(startOfDay(new Date(t.date)), cutoffDate));
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === "DATE_DESC") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === "DATE_ASC") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "SUBJECT") {
        return a.subject.localeCompare(b.subject);
      }
      if (sortBy === "DURATION") {
        return getTaskMinutes(b) - getTaskMinutes(a);
      }
      return 0;
    });

    return result;
  }, [tasks, searchTerm, activeTab, timeRange, sortBy]);

  // Compute Statistics for the filtered dataset
  const stats = useMemo(() => {
    const doneTasks = filteredTasks.filter(t => t.isDone);
    const homeworksCount = doneTasks.filter(t => t.type === "HOMEWORK").length;
    const revisionsCount = doneTasks.filter(t => t.type === "REVISION").length;
    const missedCount = filteredTasks.filter(t => t.isMissed).length;
    const totalCount = filteredTasks.length;

    const totalMinutes = doneTasks.reduce((sum, t) => sum + getTaskMinutes(t), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const successRate = totalCount > 0 
      ? Math.round((doneTasks.length / totalCount) * 100) 
      : 100;

    return {
      homeworks: homeworksCount,
      revisions: revisionsCount,
      missed: missedCount,
      timeText,
      totalMinutes,
      successRate,
      sessionsCount: doneTasks.length
    };
  }, [filteredTasks]);

  // AI Insights derived from history
  const aiInsights = useMemo(() => {
    const doneTasks = tasks.filter(t => t.isDone);
    if (doneTasks.length === 0) {
      return {
        peakTime: "No data",
        mostRevisedSubject: "No data",
        primaryActivityType: "No data",
        summary: "Start completing study sessions to unlock personalized AI insights here!"
      };
    }

    // 1. Calculate Peak Time
    let morning = 0;   // 05:00 - 11:59
    let afternoon = 0; // 12:00 - 16:59
    let evening = 0;   // 17:00 - 20:59
    let night = 0;     // 21:00 - 04:59

    doneTasks.forEach(t => {
      try {
        const hour = parseInt(t.startTime.split(':')[0], 10);
        if (hour >= 5 && hour < 12) morning++;
        else if (hour >= 12 && hour < 17) afternoon++;
        else if (hour >= 17 && hour < 21) evening++;
        else night++;
      } catch (e) {}
    });

    let peakTime = "Evening (5 PM - 9 PM)";
    let maxCount = evening;
    if (morning > maxCount) { peakTime = "Morning (5 AM - 12 PM)"; maxCount = morning; }
    if (afternoon > maxCount) { peakTime = "Afternoon (12 PM - 5 PM)"; maxCount = afternoon; }
    if (night > maxCount) { peakTime = "Night (9 PM - 5 AM)"; maxCount = night; }

    // 2. Calculate Most Revised Subject
    const revisions = doneTasks.filter(t => t.type === "REVISION");
    const revisionSubjectCounts: Record<string, number> = {};
    revisions.forEach(t => {
      const sub = t.subject.replace(/\s*\(revision\)\s*/gi, '').trim();
      revisionSubjectCounts[sub] = (revisionSubjectCounts[sub] || 0) + 1;
    });
    let mostRevisedSubject = "None yet";
    let maxRevCount = 0;
    Object.entries(revisionSubjectCounts).forEach(([sub, count]) => {
      if (count > maxRevCount) {
        mostRevisedSubject = sub;
        maxRevCount = count;
      }
    });

    // 3. Primary activity type
    const homeworksCount = doneTasks.filter(t => t.type === "HOMEWORK").length;
    const revisionsCount = doneTasks.filter(t => t.type === "REVISION").length;
    const primaryActivityType = homeworksCount >= revisionsCount ? "Homework & Assignments" : "Revision & Active Recall";

    // 4. Productivity Summary Advice
    let summary = "";
    if (peakTime.startsWith("Morning")) {
      summary = "You are a morning warrior! Capitalize on your high early-day alertness by scheduling your hardest subjects (like Math or Programming) before noon.";
    } else if (peakTime.startsWith("Afternoon")) {
      summary = "Your cognitive peak hits in the afternoon. Take advantage of this post-lunch window to crunch complex problem sheets or finish assignment writeups.";
    } else if (peakTime.startsWith("Evening")) {
      summary = "You focus best in the evening. This is a perfect routine for winding down your day with deep active recall revision cards or coding labs.";
    } else {
      summary = "You are a night owl. Studying late requires discipline; make sure to maintain regular sleep schedules to preserve memory consolidation.";
    }

    if (maxRevCount > 0) {
      summary += ` You are highly dedicated to revising ${mostRevisedSubject}. Try to distribute this level of focus to other subjects as well to balance your syllabus mastery.`;
    }

    return {
      peakTime,
      mostRevisedSubject,
      primaryActivityType,
      summary
    };
  }, [tasks]);

  // Charts processing: 1. Subject breakdown
  const pieChartData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredTasks.filter(t => t.isDone).forEach(t => {
      const subject = t.subject.replace(/\s*\(revision\)\s*/gi, '').trim() || 'General';
      breakdown[subject] = (breakdown[subject] || 0) + getTaskMinutes(t);
    });

    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredTasks]);

  // Charts processing: 2. Focus Curve (daily minutes over selected range)
  const areaChartData = useMemo(() => {
    // Generate dates based on selected range (7 days, 30 days, or 14 days default for 'ALL')
    const rangeDays = timeRange === "7_DAYS" ? 7 : timeRange === "30_DAYS" ? 30 : 14;
    const dataList = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStrStr = format(date, "yyyy-MM-dd");
      const label = format(date, "MMM dd");
      
      // Sum minutes for tasks done on this specific date
      const dayMins = tasks
        .filter(t => t.isDone && format(new Date(t.date), "yyyy-MM-dd") === dateStrStr)
        .reduce((sum, t) => sum + getTaskMinutes(t), 0);

      dataList.push({
        dateLabel: label,
        minutes: dayMins
      });
    }
    return dataList;
  }, [tasks, timeRange]);

  const PIE_COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#06b6d4'];

  if (!mounted) {
    return (
      <div className="space-y-12 max-w-[1600px] mx-auto animate-pulse pb-16">
        <div className="h-20 bg-muted/30 rounded-2xl" />
        <div className="grid grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-muted/30 rounded-[32px]" />)}
        </div>
      </div>
    );
  }

  const toggleExpandTask = (id: string) => {
    setExpandedTaskId(expandedTaskId === id ? null : id);
  };

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* Page Header */}
      <div className="pt-6 pb-2 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">Activity Analytics</h1>
          <p className="text-xl text-muted-foreground font-semibold">
            Evaluate your study trends, filters, and logs of completed work.
          </p>
        </div>

        {/* Floating Time Period Range Selector */}
        <div className="flex items-center gap-2 bg-muted/40 border p-1 rounded-2xl w-fit self-start md:self-auto">
          <button
            onClick={() => setTimeRange("ALL")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              timeRange === "ALL" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Time
          </button>
          <button
            onClick={() => setTimeRange("7_DAYS")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              timeRange === "7_DAYS" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 7D
          </button>
          <button
            onClick={() => setTimeRange("30_DAYS")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              timeRange === "30_DAYS" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 30D
          </button>
        </div>
      </div>

      {/* Stats Cards Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard 
          label="Assignments Secured" 
          value={stats.homeworks} 
          icon={<BookOpen className="w-5 h-5 text-blue-500" />} 
          description="Homework sessions done"
          borderClass="border-blue-500/10 hover:border-blue-500/20"
        />
        <StatCard 
          label="Active Recall Blocks" 
          value={stats.revisions} 
          icon={<Repeat className="w-5 h-5 text-orange-500" />} 
          description="Revision sessions done"
          borderClass="border-orange-500/10 hover:border-orange-500/20"
        />
        <StatCard 
          label="Total Hours Focused" 
          value={stats.timeText} 
          icon={<Clock className="w-5 h-5 text-teal-500" />} 
          description="Formatted focus duration"
          borderClass="border-teal-500/10 hover:border-teal-500/20"
        />
        <StatCard 
          label="Session Efficiency" 
          value={`${stats.successRate}%`} 
          icon={<Zap className="w-5 h-5 text-purple-500" />} 
          description="Done vs missed ratio"
          borderClass="border-purple-500/10 hover:border-purple-500/20"
        />
        <StatCard 
          label="Longest Day Streak" 
          value={`${userProgress?.longestStreak || 0} Days`} 
          icon={<Trophy className="w-5 h-5 text-yellow-500" />} 
          description="Your all-time record"
          borderClass="border-yellow-500/10 hover:border-yellow-500/20"
        />
      </div>

      {/* AI Study Insights Panel */}
      <div className="bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-primary/20 rounded-[32px] p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary rounded-full blur-3xl -z-0 opacity-10 translate-x-1/2 -translate-y-1/2" />
        
        <div className="flex items-center gap-3.5 mb-5 relative z-10">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-heading font-black tracking-tight text-foreground flex items-center gap-2">
              AI Study Insights
              <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2.5 py-0.5 rounded-full animate-in zoom-in duration-500">Active</span>
            </h3>
            <p className="text-xs font-semibold text-muted-foreground">Automated analytics derived from your study logs.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {/* Peak Focus Time */}
          <div className="bg-card/45 backdrop-blur border border-border/40 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Peak Focus Hour</span>
            <span className="text-lg font-heading font-black text-foreground mt-2 flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-primary" />
              {aiInsights.peakTime}
            </span>
          </div>

          {/* Core Focus Area */}
          <div className="bg-card/45 backdrop-blur border border-border/40 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Most Revised Subject</span>
            <span className="text-lg font-heading font-black text-foreground mt-2 flex items-center gap-2">
              <Repeat className="w-4.5 h-4.5 text-orange-500" />
              {aiInsights.mostRevisedSubject}
            </span>
          </div>

          {/* Primary Study Type */}
          <div className="bg-card/45 backdrop-blur border border-border/40 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Primary Activity</span>
            <span className="text-lg font-heading font-black text-foreground mt-2 flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-teal-500" />
              {aiInsights.primaryActivityType}
            </span>
          </div>
        </div>

        {/* AI Briefing Message */}
        <div className="mt-5 p-4.5 bg-card/60 backdrop-blur rounded-2xl border border-border/30 text-sm text-foreground/85 leading-relaxed font-semibold relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="flex-1">
            {aiInsights.summary}
          </p>
          
          <Link
            href={`/ai?prompt=${encodeURIComponent(`Let's discuss my study history. According to my analytics, my peak focus hour is during the ${aiInsights.peakTime}, my most revised subject is ${aiInsights.mostRevisedSubject}, and I focus mostly on ${aiInsights.primaryActivityType}. What advice do you have to help me optimize my routine?`)}`}
            className="inline-flex items-center gap-2 bg-primary text-white hover:bg-primary/90 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Consult Buddy</span>
          </Link>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Chart 1: Donut Time Distribution (8 columns on large screens) */}
        <div className="lg:col-span-5 bg-card border border-border/60 p-8 rounded-[40px] shadow-sm flex flex-col justify-between">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-heading font-black tracking-tight">Time Distribution</h3>
            <p className="text-xs font-semibold text-muted-foreground">Focus duration breakdown across subjects.</p>
          </div>

          <div className="h-[280px] w-full flex items-center justify-center relative">
            {pieChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        background: 'rgba(255,255,255,0.95)'
                      }} 
                      formatter={(value: any) => [`${value} mins`, 'Duration']}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text displaying aggregate total focus time */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">Total Focused</span>
                  <span className="text-2xl font-heading font-black text-foreground mt-1.5">{stats.timeText}</span>
                </div>
              </>
            ) : (
              <div className="text-center space-y-2">
                <div className="p-4 bg-muted/60 rounded-full inline-block">
                  <Clock className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-xs font-bold text-muted-foreground">No data available for this range.</p>
              </div>
            )}
          </div>

          {/* Color Indicators Legend */}
          {pieChartData.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-6 border-t pt-5 border-border/40">
              {pieChartData.slice(0, 6).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs font-bold text-muted-foreground truncate" title={item.name}>{item.name}</span>
                  <span className="text-[10px] font-bold text-muted-foreground/40 ml-auto shrink-0">
                    {Math.round((item.value / stats.totalMinutes) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart 2: Focus Consistency Curve (7 columns) */}
        <div className="lg:col-span-7 bg-card border border-border/60 p-8 rounded-[40px] shadow-sm flex flex-col justify-between">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-heading font-black tracking-tight">Focus Consistency Curve</h3>
            <p className="text-xs font-semibold text-muted-foreground">Trend of daily study minutes over the range.</p>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis 
                  dataKey="dateLabel" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgb(156, 163, 175)' }} 
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgb(156, 163, 175)' }} 
                  unit="m"
                />
                <Tooltip
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    background: 'rgba(255,255,255,0.95)'
                  }} 
                  formatter={(value: any) => [`${value} mins`, 'Time Focused']}
                />
                <Area 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorMinutes)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 p-4.5 bg-muted/30 rounded-2xl border border-border/40 text-xs font-bold text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span>
              You finalized <span className="text-primary">{stats.sessionsCount} sessions</span> within this window. Keep the curve rising!
            </span>
          </div>
        </div>

      </div>

      {/* Ledger and Search / Filter Header */}
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <h2 className="text-3xl font-heading font-black tracking-tight">Performance Log</h2>
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-4xl justify-end">
            
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search subject or logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-9 pr-4 rounded-xl border border-border/60 bg-card font-bold text-xs"
              />
            </div>

            {/* Sort Dropdown Selector */}
            <div className="flex items-center gap-2 bg-card border border-border/60 rounded-xl px-3 h-10 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-muted-foreground focus:outline-none cursor-pointer pr-4"
              >
                <option value="DATE_DESC">Newest First</option>
                <option value="DATE_ASC">Oldest First</option>
                <option value="SUBJECT">Subject A-Z</option>
                <option value="DURATION">Longest Study</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 border-b pb-4 border-border/30">
          {(["ALL", "HOMEWORK", "REVISION", "MISSED"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all active:scale-95",
                activeTab === tab
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              {tab === "ALL" && "All Entries"}
              {tab === "HOMEWORK" && "Completed Homework"}
              {tab === "REVISION" && "Completed Revisions"}
              {tab === "MISSED" && "Missed Block Logs"}
            </button>
          ))}
          <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest ml-auto mr-2">
            Showing {filteredTasks.length} results
          </span>
        </div>

        {/* Expanding Log Grid Rows */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-20 bg-card border border-dashed rounded-[32px] text-muted-foreground font-bold italic">
              No matching records found. Try adjusting your searches or filters!
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const durationMins = getTaskMinutes(task);

              return (
                <div 
                  key={task.id}
                  className={cn(
                    "bg-card border-2 rounded-[28px] overflow-hidden transition-all duration-300 shadow-sm",
                    isExpanded 
                      ? "border-primary/40 shadow-md scale-[1.005]" 
                      : "border-border/60 hover:border-border"
                  )}
                >
                  {/* Row Header Trigger */}
                  <div 
                    onClick={() => toggleExpandTask(task.id)}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      
                      {/* Check/X Status Circle Indicator */}
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                        task.isDone 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}>
                        {task.isDone ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-heading font-black text-lg text-foreground truncate">{task.subject}</h4>
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            task.type === "HOMEWORK" 
                              ? "bg-blue-500/5 text-blue-500 border-blue-500/20" 
                              : "bg-orange-500/5 text-orange-500 border-orange-500/20"
                          )}>
                            {task.type}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground font-semibold mt-1">
                          {format(new Date(task.date), 'EEEE, MMMM do, yyyy')}
                        </p>
                      </div>
                    </div>

                    {/* Right column with time summary / toggle chevron */}
                    <div className="flex items-center gap-4 shrink-0 ml-14 sm:ml-0">
                      <DeleteTaskButton taskId={task.id} className="h-9 w-9" />
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{task.startTime} - {task.endTime}</p>
                        <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">Duration: {durationMins}m</p>
                      </div>

                      <div className={cn(
                        "p-2 rounded-xl border border-border/50 hover:bg-muted text-muted-foreground transition-all",
                        isExpanded && "bg-muted text-primary border-primary/20"
                      )}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="border-t border-border/40 bg-muted/10"
                      >
                        <div className="p-6 space-y-6">
                          
                          {/* Duration Badge stats for mobile */}
                          <div className="grid grid-cols-2 gap-4 md:hidden border-b pb-4 border-border/40">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">Time Slot</p>
                              <p className="text-xs font-bold text-foreground mt-1.5">{task.startTime} - {task.endTime}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none">Total Minutes</p>
                              <p className="text-xs font-bold text-foreground mt-1.5">{durationMins} minutes</p>
                            </div>
                          </div>

                          {/* Work proof details */}
                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 select-none">
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>Proof of Work Ledger</span>
                            </p>

                            {task.workDescription ? (
                              <div className="bg-card border p-5 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                <p className="text-sm font-medium text-foreground leading-relaxed italic">
                                  &quot;{task.workDescription}&quot;
                                </p>
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-muted-foreground/50 italic py-2">
                                No written reflection or text log was attached to this session.
                              </div>
                            )}

                            {/* View supplementary PDF upload */}
                            {task.proofPdfUrl && (
                              <div className="pt-3 flex items-center gap-3">
                                <a 
                                  href={task.proofPdfUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 p-3 px-5 rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm group/btn"
                                >
                                  <FileText className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Open Supplementary PDF Document</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Compact Subcard widget
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  borderClass?: string;
}

function StatCard({ label, value, icon, description, borderClass }: StatCardProps) {
  return (
    <div className={cn(
      "bg-card border p-6 rounded-[32px] shadow-sm transition-all duration-300 hover:-translate-y-0.5",
      borderClass
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-muted/60 rounded-2xl">
          {icon}
        </div>
        <span className="text-2xl font-heading font-black tracking-tight text-foreground select-all">{value}</span>
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 mb-1 select-none">{label}</p>
        <p className="text-xs font-bold text-muted-foreground/80">{description}</p>
      </div>
    </div>
  );
}
