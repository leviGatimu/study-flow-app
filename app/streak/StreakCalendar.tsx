'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';

export function StreakCalendar({ activeTimestamps }: { activeTimestamps: number[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const activeDates = new Set(activeTimestamps);
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="bg-card border border-border/60 rounded-[40px] p-6 md:p-10 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <h3 className="text-2xl font-heading font-black flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
            title="Previous month"
            className="p-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            title="Next month"
            className="p-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 relative z-10">
        <div className="w-2 h-2 rounded-full bg-orange-500" /> Active
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 md:gap-3 relative z-10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 pb-2">
            {day}
          </div>
        ))}

        {/* Padding for first day of month */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {calendarDays.map((date) => {
          const isActive = activeDates.has(startOfDay(date).getTime());
          const isToday = isSameDay(date, today);

          return (
            <div
              key={date.toString()}
              className={`
                aspect-square rounded-2xl flex items-center justify-center text-sm font-black transition-all relative
                ${isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105' : 'bg-muted/30 text-muted-foreground/40'}
                ${isToday && !isActive ? 'border-2 border-primary/40 text-primary' : ''}
              `}
            >
              {format(date, 'd')}
              {isToday && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
