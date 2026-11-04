'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, addMonths, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Calendar keys and the initial local date come from one server snapshot. */
export function StreakCalendar({ activeDays, today }: { activeDays: string[]; today: string }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date(`${today}T12:00:00`));
  const active = new Set(activeDays);
  const monthStart = startOfMonth(currentMonth);
  const first = startOfWeek(monthStart, { weekStartsOn: 1 });
  const dates = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  const prefix = format(currentMonth, 'yyyy-MM');
  const count = activeDays.filter((key) => key.startsWith(prefix)).length;

  return <section className="h-full rounded-xl border border-border bg-card p-5 sm:p-7" aria-label="Study activity calendar">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><p className="mb-1 text-xs text-muted-foreground">Study activity</p><h2 className="text-xl font-medium">{format(currentMonth,'MMMM yyyy')}</h2></div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" className="min-h-11" onClick={()=>setCurrentMonth(new Date(`${today}T12:00:00`))}>This month</Button>
        <Button variant="outline" size="icon" className="size-11 rounded-lg" onClick={()=>setCurrentMonth(month=>subMonths(month,1))} aria-label="Previous month"><ChevronLeft /></Button>
        <Button variant="outline" size="icon" className="size-11 rounded-lg" onClick={()=>setCurrentMonth(month=>addMonths(month,1))} aria-label="Next month"><ChevronRight /></Button>
      </div>
    </header>
    <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={format(currentMonth,'MMMM yyyy')}>
      {WEEKDAYS.map(day=><span key={day} className="pb-3 text-center text-xs text-muted-foreground">{day}</span>)}
      {dates.map(date=>{
        const key=format(date,'yyyy-MM-dd');
        const studied=active.has(key);
        const inMonth=isSameMonth(date,currentMonth);
        const isToday=key===today;
        return <div key={key} aria-label={`${format(date,'EEEE d MMMM yyyy')}${studied?', studied':''}${isToday?', today':''}`} className={cn('relative flex min-h-11 items-center justify-center rounded-lg border border-transparent py-4 text-sm tabular-nums sm:min-h-16',inMonth?'text-foreground':'text-muted-foreground/40',studied&&inMonth&&'bg-primary/10 font-semibold text-primary',isToday&&'border-primary')}>
          {date.getDate()}{studied&&inMonth&&<span aria-hidden="true" className="absolute bottom-2 size-1 rounded-full bg-primary" />}
        </div>;
      })}
    </div>
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
      <span>{count} {count===1?'study day':'study days'} this month</span>
      <span className="flex items-center gap-2"><CalendarDays className="size-3.5" />Completed study blocks</span>
    </footer>
  </section>;
}