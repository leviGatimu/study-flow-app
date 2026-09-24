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
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Panel, PanelTitle } from '@/components/ui/panel';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A month of study days. `activeDays` are "yyyy-MM-dd" keys computed on the
 * server, so a day is active by its calendar date, not by a timestamp that
 * shifts with the browser's time zone.
 */
export function StreakCalendar({ activeDays }: { activeDays: string[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const active = new Set(activeDays);
  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const activeThisMonth = calendarDays.filter((d) => active.has(format(d, 'yyyy-MM-dd'))).length;

  return (
    <Panel className="h-full">
      <PanelTitle
        icon={<Calendar />}
        action={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight />
            </Button>
          </>
        }
      >
        {format(currentMonth, 'MMMM yyyy')}
      </PanelTitle>

      <p className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="size-2 rounded-full bg-orange-500" aria-hidden="true" />
        {activeThisMonth === 0 ? 'No study days this month' : `Studied on ${activeThisMonth} ${activeThisMonth === 1 ? 'day' : 'days'} this month`}
      </p>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}

        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {calendarDays.map((date) => {
          const isActive = active.has(format(date, 'yyyy-MM-dd'));
          const isToday = isSameDay(date, today);
          return (
            <div
              key={date.toISOString()}
              className={cn(
                'flex aspect-square items-center justify-center rounded-xl text-sm font-bold tabular-nums',
                isActive ? 'bg-orange-500 text-white' : 'bg-muted/40 text-muted-foreground',
                isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
              )}
            >
              {format(date, 'd')}
              <span className="sr-only">{isActive ? ', studied' : ''}{isToday ? ', today' : ''}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
