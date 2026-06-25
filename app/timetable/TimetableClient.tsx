'use client';

import { useState, useMemo } from 'react';
import { 
  School, 
  Coffee, 
  BookOpen, 
  Repeat, 
  CheckCircle2, 
  XCircle,
  Clock,
  ListTodo,
  CalendarDays,
  CalendarCheck
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TaskType {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
  isDone: boolean;
  isMissed: boolean;
  type: string; // "HOMEWORK" or "REVISION"
  date: string | Date;
}

interface TimetableClientProps {
  initialTasks: TaskType[];
  startOfWeekStr: string;
}

type TimelineItem = {
  start: string;
  end: string;
  label: string;
  type: 'SCHOOL' | 'STUDY' | 'BREAK';
  isDone?: boolean;
  isMissed?: boolean;
  subType?: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// School Hours
const SCHOOL_WEEKDAY = { start: "07:30", end: "17:20", label: "School Hours" };
const SCHOOL_SATURDAY = { start: "08:00", end: "14:00", label: "School Hours" };

export function TimetableClient({ initialTasks, startOfWeekStr }: TimetableClientProps) {
  const [viewMode, setViewMode] = useState<'agenda' | 'weekly'>('agenda');
  const startOfWeekDate = useMemo(() => parseISO(startOfWeekStr), [startOfWeekStr]);
  const today = useMemo(() => new Date(), []);
  
  // Default to today's day if inside DAYS, otherwise default to Monday
  const [activeDay, setActiveDay] = useState(() => {
    const dayName = format(new Date(), 'EEEE');
    return DAYS.includes(dayName) ? dayName : 'Monday';
  });

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Build the timelines for each day of the week
  const daysTimelines = useMemo(() => {
    const map: Record<string, TimelineItem[]> = {};

    DAYS.forEach((dayName, index) => {
      const date = addDays(startOfWeekDate, index);
      const dayTasks = initialTasks.filter(t => isSameDay(new Date(t.date), date));

      const timeline: TimelineItem[] = [];

      // 1. Add School if applicable
      if (index < 5) { // Mon-Fri
        timeline.push({ ...SCHOOL_WEEKDAY, type: 'SCHOOL' });
      } else if (index === 5) { // Sat
        timeline.push({ ...SCHOOL_SATURDAY, type: 'SCHOOL' });
      }

      // 2. Add Study Tasks
      dayTasks.forEach(task => {
        timeline.push({
          start: task.startTime,
          end: task.endTime,
          label: task.subject,
          type: 'STUDY',
          isDone: task.isDone,
          isMissed: task.isMissed,
          subType: task.type
        });
      });

      // Sort by start time
      timeline.sort((a, b) => getMinutes(a.start) - getMinutes(b.start));

      // 3. Detect Breaks (Gaps between items)
      const fullTimeline: TimelineItem[] = [];
      for (let i = 0; i < timeline.length; i++) {
        const current = timeline[i];

        if (i > 0) {
          const prev = timeline[i - 1];
          const gapStart = prev.end;
          const gapEnd = current.start;

          if (getMinutes(gapEnd) > getMinutes(gapStart)) {
            fullTimeline.push({
              start: gapStart,
              end: gapEnd,
              label: "Break / Personal Time",
              type: "BREAK"
            });
          }
        }
        fullTimeline.push(current);
      }

      map[dayName] = fullTimeline;
    });

    return map;
  }, [initialTasks, startOfWeekDate]);

  return (
    <div className="space-y-8">
      
      {/* Control Ribbon */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border/40">
        <div>
          <h2 className="text-3xl font-heading font-black tracking-tight text-foreground uppercase mb-1">
            Study Schedule
          </h2>
          <p className="text-muted-foreground font-semibold text-sm">
            Track your classes, break points, and daily revision agendas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-card border border-border/60 p-1 rounded-xl flex items-center shadow-sm">
            <Button 
              variant={viewMode === 'agenda' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('agenda')}
              className="rounded-lg h-9 font-bold text-xs gap-1.5 px-3 cursor-pointer"
            >
              <ListTodo className="w-3.5 h-3.5" /> Agenda View
            </Button>
            <Button 
              variant={viewMode === 'weekly' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('weekly')}
              className="rounded-lg h-9 font-bold text-xs gap-1.5 px-3 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Weekly Ledger
            </Button>
          </div>
        </div>
      </div>

      {/* AGENDA VIEW (Tabbed day list, spacious full cards) */}
      {viewMode === 'agenda' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Day Selector Tabs */}
          <div className="flex gap-2 justify-center border-b border-border/20 pb-4 overflow-x-auto">
            {DAYS.map((day, idx) => {
              const date = addDays(startOfWeekDate, idx);
              const isToday = isSameDay(date, today);
              const isSelected = activeDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[76px] py-2 px-3 rounded-xl border transition-all cursor-pointer",
                    isSelected ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10 scale-105" :
                    isToday ? "bg-primary/5 border-primary/30 text-primary" : "bg-card border-border/50 hover:border-primary/30 text-foreground"
                  )}
                >
                  <span className="text-[8px] font-black uppercase tracking-wider opacity-60 leading-none mb-1">{day.slice(0, 3)}</span>
                  <span className="text-base font-heading font-black leading-none">{format(date, 'd')}</span>
                </button>
              );
            })}
          </div>

          {/* Timetable Agenda items */}
          <div className="space-y-3.5 pt-2">
            {daysTimelines[activeDay]?.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground font-semibold bg-muted/10 border border-dashed border-border/50 rounded-2xl">
                No classes or tasks scheduled for {activeDay}. Free Day!
              </div>
            ) : (
              daysTimelines[activeDay]?.map((item, idx) => {
                const isSchool = item.type === 'SCHOOL';
                const isStudy = item.type === 'STUDY';
                const isBreak = item.type === 'BREAK';

                return (
                  <div 
                    key={idx}
                    className={cn(
                      "p-5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden",
                      isSchool && "bg-blue-500/5 border-blue-500/20 text-blue-700",
                      isBreak && "bg-muted/15 border-dashed border-border/40 text-muted-foreground",
                      isStudy && !item.isDone && !item.isMissed && (item.subType === 'HOMEWORK' ? "bg-primary/5 border-primary/20 text-primary" : "bg-orange-500/5 border-orange-500/20 text-orange-600"),
                      item.isDone && "bg-success/10 border-success/30 text-success opacity-85",
                      item.isMissed && "bg-destructive/10 border-destructive/30 text-destructive opacity-85"
                    )}
                  >
                    {/* Visual left bar accent */}
                    <div className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      isSchool && "bg-blue-500",
                      isBreak && "bg-muted-foreground/30",
                      isStudy && (item.isDone ? "bg-success" : item.isMissed ? "bg-destructive" : item.subType === 'HOMEWORK' ? "bg-primary" : "bg-orange-500")
                    )} />

                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                        isSchool && "bg-blue-500/10 border-blue-500/20 text-blue-600",
                        isBreak && "bg-muted text-muted-foreground border-border/40",
                        isStudy && (item.isDone ? "bg-success/10 border-success/20 text-success" : item.isMissed ? "bg-destructive/10 border-destructive/20 text-destructive" : item.subType === 'HOMEWORK' ? "bg-primary/10 border-primary/20 text-primary" : "bg-orange-500/10 border-orange-500/20 text-orange-600")
                      )}>
                        {isSchool && <School className="w-5 h-5" />}
                        {isBreak && <Coffee className="w-5 h-5" />}
                        {isStudy && (item.subType === 'HOMEWORK' ? <BookOpen className="w-5 h-5" /> : <Repeat className="w-5 h-5" />)}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <h4 className={cn(
                          "text-base font-bold tracking-tight text-foreground truncate",
                          (item.isDone || item.isMissed) && "line-through opacity-65"
                        )}>
                          {item.label}
                        </h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 leading-none">
                          <Clock className="w-3.5 h-3.5 opacity-60" /> {item.start} — {item.end}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isStudy && item.isDone && (
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                      {isStudy && item.isMissed && (
                        <span className="text-[9px] font-black text-destructive uppercase tracking-wider bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Missed
                        </span>
                      )}
                      {isStudy && !item.isDone && !item.isMissed && (
                        <span className="text-[9px] font-black text-primary/60 uppercase tracking-wider bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-full">
                          {item.subType}
                        </span>
                      )}
                      {isSchool && (
                        <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-wider bg-blue-500/5 border border-blue-500/10 px-2.5 py-1 rounded-full">
                          Lectures
                        </span>
                      )}
                      {isBreak && (
                        <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider bg-muted/20 border border-border/10 px-2.5 py-1 rounded-full">
                          Break
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* WEEKLY LEDGER VIEW (Horizontal Day bands, no columns text squeezing) */}
      {viewMode === 'weekly' && (
        <div className="space-y-6">
          {DAYS.map((day, dayIdx) => {
            const date = addDays(startOfWeekDate, dayIdx);
            const isToday = isSameDay(date, today);
            const dayTimeline = daysTimelines[day] || [];

            return (
              <div 
                key={day} 
                className={cn(
                  "bg-card/45 backdrop-blur-md border border-border/40 rounded-2xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-6 relative overflow-hidden transition-all duration-300",
                  isToday ? "border-primary shadow-md shadow-primary/5 bg-primary/[0.01]" : "hover:border-primary/20"
                )}
              >
                {/* Day block */}
                <div className={cn(
                  "flex md:flex-col items-center justify-center gap-2 md:gap-0.5 py-3 px-4 rounded-xl border min-w-[90px] shrink-0 text-center",
                  isToday ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 border-border/50 text-foreground"
                )}>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none">{day.slice(0, 3)}</span>
                  <span className="text-xl font-heading font-black leading-none">{format(date, 'd')}</span>
                </div>

                {/* Flow of timeline capsules */}
                <div className="flex-1 flex flex-wrap gap-3 items-center">
                  {dayTimeline.length === 0 ? (
                    <span className="text-xs font-bold text-muted-foreground italic px-2">Free Day</span>
                  ) : (
                    dayTimeline.map((item, idx) => {
                      const isSchool = item.type === 'SCHOOL';
                      const isStudy = item.type === 'STUDY';
                      const isBreak = item.type === 'BREAK';

                      return (
                        <div 
                          key={idx}
                          className={cn(
                            "py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all duration-300 flex flex-col justify-between min-w-[150px] max-w-[200px] shrink-0 relative overflow-hidden",
                            isSchool && "bg-blue-500/5 border-blue-500/20 text-blue-700",
                            isBreak && "bg-muted/15 border-dashed border-border/40 text-muted-foreground/60",
                            isStudy && !item.isDone && !item.isMissed && (item.subType === 'HOMEWORK' ? "bg-primary/5 border-primary/20 text-primary" : "bg-orange-500/5 border-orange-500/20 text-orange-600"),
                            item.isDone && "bg-success/10 border-success/30 text-success opacity-85",
                            item.isMissed && "bg-destructive/10 border-destructive/30 text-destructive opacity-85"
                          )}
                        >
                          <span className="text-[8px] font-black opacity-60 tracking-wider mb-1 block">
                            {item.start} - {item.end}
                          </span>
                          <span className={cn(
                            "font-bold truncate leading-tight block",
                            (item.isDone || item.isMissed) && "line-through"
                          )}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
