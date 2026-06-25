'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, 
  Zap, 
  School, 
  Coffee, 
  BookOpen, 
  ListTodo, 
  CalendarDays,
  Cpu,
  Laptop,
  MessageSquareCode,
  Globe,
  Award
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn, getRwandaTime } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export type Lesson = {
  day: string;
  start: string;
  end: string;
  subject: string;
};

export const SCHOOL_DATA: Lesson[] = [
  // Monday
  { day: 'Monday', start: '07:30', end: '09:00', subject: 'Self Study / Devotion' },
  { day: 'Monday', start: '09:00', end: '10:40', subject: 'Networking Fundamentals' },
  { day: 'Monday', start: '10:40', end: '11:00', subject: 'Short Break' },
  { day: 'Monday', start: '11:00', end: '11:50', subject: 'Citizenship' },
  { day: 'Monday', start: '11:50', end: '12:40', subject: 'Fundamentals of C (Extra hour)' },
  { day: 'Monday', start: '12:40', end: '13:40', subject: 'Lunch and Learn' },
  { day: 'Monday', start: '13:40', end: '15:20', subject: 'Develop Web Application using Javascripts' },
  { day: 'Monday', start: '15:20', end: '15:40', subject: 'Short Break' },
  { day: 'Monday', start: '15:40', end: '17:20', subject: 'Design Embedded Systems' },
  
  // Tuesday
  { day: 'Tuesday', start: '07:30', end: '09:00', subject: 'Self Study / Devotion' },
  { day: 'Tuesday', start: '09:00', end: '10:40', subject: 'Develop Web Application using PHP' },
  { day: 'Tuesday', start: '10:40', end: '11:00', subject: 'Short Break' },
  { day: 'Tuesday', start: '11:00', end: '12:40', subject: 'Design Graphic User Interface' },
  { day: 'Tuesday', start: '12:40', end: '13:40', subject: 'Lunch and Learn' },
  { day: 'Tuesday', start: '13:40', end: '15:20', subject: 'Maintain Professional Conversation in Upper Technical English' },
  { day: 'Tuesday', start: '15:20', end: '15:40', subject: 'Short Break' },
  { day: 'Tuesday', start: '15:40', end: '16:30', subject: 'English (Extra hour)' },
  { day: 'Tuesday', start: '16:30', end: '17:20', subject: "Students' clubs" },
  
  // Wednesday
  { day: 'Wednesday', start: '07:30', end: '09:00', subject: 'Self Study / Devotion' },
  { day: 'Wednesday', start: '09:00', end: '10:40', subject: 'Apply Fundamentals of Programming Using C' },
  { day: 'Wednesday', start: '10:40', end: '11:00', subject: 'Short Break' },
  { day: 'Wednesday', start: '11:00', end: '12:40', subject: 'Develop Basic Database' },
  { day: 'Wednesday', start: '12:40', end: '13:40', subject: 'Lunch and Learn' },
  { day: 'Wednesday', start: '13:40', end: '14:30', subject: 'Entrepreneurship' },
  { day: 'Wednesday', start: '14:30', end: '15:20', subject: 'Computer Basics' },
  { day: 'Wednesday', start: '15:20', end: '15:40', subject: 'Short Break' },
  { day: 'Wednesday', start: '15:40', end: '17:20', subject: 'Design Electrical and Electronic Circuits and Optical Instruments' },
  
  // Thursday
  { day: 'Thursday', start: '07:30', end: '09:00', subject: 'Self Study / Devotion' },
  { day: 'Thursday', start: '09:00', end: '10:40', subject: 'Design Electrical and Electronic Circuits and Optical Instruments' },
  { day: 'Thursday', start: '10:40', end: '11:00', subject: 'Short Break' },
  { day: 'Thursday', start: '11:00', end: '12:40', subject: 'Design Web User Interface' },
  { day: 'Thursday', start: '12:40', end: '13:40', subject: 'Lunch and Learn' },
  { day: 'Thursday', start: '13:40', end: '14:30', subject: 'Javascript (Extra hour)' },
  { day: 'Thursday', start: '14:30', end: '15:20', subject: 'Develop Web Application using Javascripts' },
  { day: 'Thursday', start: '15:20', end: '15:40', subject: 'Short Break' },
  { day: 'Thursday', start: '15:40', end: '17:20', subject: 'Apply Fundamentals of Programming Using C' },
  
  // Friday
  { day: 'Friday', start: '07:30', end: '09:00', subject: 'Self Study / Devotion' },
  { day: 'Friday', start: '09:00', end: '11:50', subject: 'Math (Algebra, Trig, Prob, Stats)' },
  { day: 'Friday', start: '11:50', end: '12:40', subject: 'Design Embedded Systems' },
  { day: 'Friday', start: '12:40', end: '13:40', subject: 'Lunch and Learn' },
  { day: 'Friday', start: '13:40', end: '14:30', subject: 'Kinyarwanda' },
  { day: 'Friday', start: '14:30', end: '15:20', subject: 'Math (Algebra, Trig, Prob, Stats)' },
  { day: 'Friday', start: '15:20', end: '15:40', subject: 'Short Break' },
  { day: 'Friday', start: '15:40', end: '17:20', subject: 'Lab (Embedded Systems)' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function SchoolTimetable() {
  const [now, setNow] = useState(getRwandaTime());
  const [isTimetableSynced, setIsTimetableSynced] = useState(true);
  const [viewMode, setViewMode] = useState<'agenda' | 'weekly'>('agenda');
  
  // Default to today's day if Mon-Fri, otherwise default to Monday
  const [activeDay, setActiveDay] = useState(() => {
    const dayName = format(getRwandaTime(), 'EEEE');
    return DAYS.includes(dayName) ? dayName : 'Monday';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('isTimetableSynced');
      if (stored !== null) {
        setIsTimetableSynced(stored === 'true');
      }
    }
  }, []);

  const handleToggleSync = (checked: boolean) => {
    setIsTimetableSynced(checked);
    localStorage.setItem('isTimetableSynced', String(checked));
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(getRwandaTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentTimeStr = format(now, 'HH:mm');
  const startOfCurrWeek = startOfWeek(now, { weekStartsOn: 1 });

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const getTimeLeft = (endStr: string) => {
    const nowMinutes = getMinutes(format(now, 'HH:mm'));
    const endMinutes = getMinutes(endStr);
    const diff = endMinutes - nowMinutes;
    if (diff <= 0) return null;
    if (diff >= 60) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m left`;
    }
    return `${diff}m left`;
  };

  const getSubjectIcon = (subject: string) => {
    const sub = subject.toLowerCase();
    if (sub.includes('break') || sub.includes('lunch')) return Coffee;
    if (sub.includes('networking')) return Globe;
    if (sub.includes('c programming') || sub.includes('fundamentals of c') || sub.includes('javascript') || sub.includes('php') || sub.includes('web')) return Laptop;
    if (sub.includes('embedded') || sub.includes('electrical') || sub.includes('electronic') || sub.includes('circuit')) return Cpu;
    return BookOpen;
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* Settings & Controls Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-border/40">
        <div>
           <h2 className="text-3xl font-heading font-black tracking-tight text-foreground uppercase mb-1 flex items-center gap-3">
             <School className="w-8 h-8 text-primary" /> Timetable Portal
           </h2>
           <p className="text-muted-foreground font-semibold text-sm">Your academic class schedules, break logs, and daily timeline.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           {/* View Mode Selector */}
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

           {/* Sync Switch */}
           <div className="bg-card border border-border/60 px-4 h-11 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="flex flex-col select-none">
                <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Sync state</span>
                <span className="text-[10px] font-bold text-foreground leading-none">
                  {isTimetableSynced ? 'Active' : 'Offline'}
                </span>
              </div>
              <Switch 
                checked={isTimetableSynced}
                onCheckedChange={handleToggleSync}
                aria-label="Toggle Timetable Sync"
                className="scale-90"
              />
           </div>

           {/* Current Time */}
           <div className="bg-primary/5 border border-primary/20 px-4 h-11 rounded-xl flex items-center gap-3 shadow-sm">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-primary/60 leading-none mb-0.5">Session Clock</p>
                <p className="text-xs font-heading font-black tabular-nums leading-none">{currentTimeStr}</p>
              </div>
           </div>
        </div>
      </div>

      {/* AGENDA VIEW (Tabbed active day timeline - Spacious, no text wrapping issues) */}
      {viewMode === 'agenda' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Day Selector Tabs */}
          <div className="flex gap-2 justify-center border-b border-border/20 pb-4 overflow-x-auto">
            {DAYS.map((day, idx) => {
              const date = addDays(startOfCurrWeek, idx);
              const isToday = isSameDay(date, now);
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

          {/* Timeline list of selected day's lessons */}
          <div className="space-y-3.5 pt-2">
            {SCHOOL_DATA.filter(l => l.day === activeDay).map((lesson, idx) => {
              const lessonStart = getMinutes(lesson.start);
              const lessonEnd = getMinutes(lesson.end);
              const nowMinutes = getMinutes(currentTimeStr);
              const isToday = isSameDay(addDays(startOfCurrWeek, DAYS.indexOf(activeDay)), now);
              
              const isActive = isTimetableSynced && isToday && nowMinutes >= lessonStart && nowMinutes < lessonEnd;
              const isPast = isToday && nowMinutes >= lessonEnd;
              const isBreak = lesson.subject.toLowerCase().includes('break') || lesson.subject.toLowerCase().includes('lunch');
              const SubjectIcon = getSubjectIcon(lesson.subject);

              return (
                <div 
                  key={idx}
                  className={cn(
                    "p-5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden",
                    isActive ? "bg-primary/5 border-primary shadow-md shadow-primary/5 scale-[1.005]" : 
                    isPast ? "bg-muted/15 border-transparent opacity-45 grayscale" : "bg-card border-border/40 hover:border-primary/20",
                    isBreak && !isActive && !isPast && "bg-muted/10 border-dashed border-border/50 text-muted-foreground"
                  )}
                >
                  {/* Glowing left strip for active class */}
                  {isActive && (
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
                  )}

                  {/* Class Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                      isActive ? "bg-primary/10 border-primary/30 text-primary animate-pulse" :
                      isBreak ? "bg-muted text-muted-foreground border-border/50" : "bg-primary/5 border-primary/10 text-primary"
                    )}>
                      <SubjectIcon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h4 className={cn(
                        "text-base font-bold tracking-tight text-foreground truncate",
                        isPast && "line-through"
                      )}>
                        {lesson.subject}
                      </h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 leading-none">
                        <Clock className="w-3.5 h-3.5" /> {lesson.start} — {lesson.end}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 flex items-center sm:text-right">
                    {isActive ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-primary uppercase bg-primary/15 px-3 py-1 rounded-full border border-primary/20 animate-pulse">
                          {getTimeLeft(lesson.end)}
                        </span>
                        <Zap className="w-4 h-4 text-primary fill-primary animate-bounce" />
                      </div>
                    ) : isPast ? (
                      <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider bg-muted/40 px-2.5 py-1 rounded-lg">
                        Completed
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-primary/60 uppercase tracking-wider bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-lg">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEKLY LEDGER VIEW (Horizontal day bands - takes full width, no squeezed vertical columns) */}
      {viewMode === 'weekly' && (
        <div className="space-y-6">
          {DAYS.map((day, dayIdx) => {
            const date = addDays(startOfCurrWeek, dayIdx);
            const isToday = isSameDay(date, now);
            const dayLessons = SCHOOL_DATA.filter(l => l.day === day);

            return (
              <div 
                key={day} 
                className={cn(
                  "bg-card/45 backdrop-blur-md border border-border/40 rounded-2xl p-5 flex flex-col md:flex-row items-stretch md:items-center gap-6 relative overflow-hidden transition-all duration-300",
                  isToday ? "border-primary shadow-md shadow-primary/5 bg-primary/[0.01]" : "hover:border-primary/20"
                )}
              >
                {/* Day Details Block */}
                <div className={cn(
                  "flex md:flex-col items-center justify-center gap-2 md:gap-0.5 py-3 px-4 rounded-xl border min-w-[90px] shrink-0 text-center",
                  isToday ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted/40 border-border/50 text-foreground"
                )}>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none">{day.slice(0, 3)}</span>
                  <span className="text-xl font-heading font-black leading-none">{format(date, 'd')}</span>
                </div>

                {/* Horizontal flow of class bubbles */}
                <div className="flex-1 flex flex-wrap gap-3 items-center">
                  {dayLessons.map((lesson, idx) => {
                    const lessonStart = getMinutes(lesson.start);
                    const lessonEnd = getMinutes(lesson.end);
                    const nowMinutes = getMinutes(currentTimeStr);
                    const isActive = isTimetableSynced && isToday && nowMinutes >= lessonStart && nowMinutes < lessonEnd;
                    const isPast = isToday && nowMinutes >= lessonEnd;
                    const isBreak = lesson.subject.toLowerCase().includes('break') || lesson.subject.toLowerCase().includes('lunch');

                    return (
                      <div 
                        key={idx}
                        className={cn(
                          "py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-w-[150px] max-w-[200px] shrink-0",
                          isActive ? "bg-primary text-primary-foreground border-primary shadow-sm" : 
                          isPast ? "bg-muted/15 border-transparent opacity-40 grayscale" : "bg-card border-border/50 hover:border-primary/30",
                          isBreak && !isActive && !isPast && "bg-muted/10 border-dashed border-border/40 text-muted-foreground/60"
                        )}
                      >
                        <span className="text-[8px] font-black opacity-60 tracking-wider mb-1 block">
                          {lesson.start} - {lesson.end}
                        </span>
                        <span className={cn("font-bold truncate leading-tight block", isPast && "line-through")}>
                          {lesson.subject}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
