'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { Timer } from 'lucide-react';
import { WeekBoard, type BoardDay } from '@/components/schedule/WeekBoard';
import { Button } from '@/components/ui/button';
import { blockMinutes, entryRange, formatMinutes } from '@/lib/schedule-layout';
import type { ScheduleEntry } from '@/lib/schedule-layout';
import type { Holiday } from '@/lib/holidays';
import { lessonsOn, schoolDayBounds, type SchoolLesson } from '@/lib/school';
import { getZonedNow } from '@/lib/utils';
import { dayKey } from './schedule-dates';
import { statusOf } from './study-block';

export type WeekTask = {
  id: string;
  subject: string;
  type: string;
  startTime: string;
  endTime: string;
  isDone: boolean;
  isMissed: boolean;
  date: Date;
};

/** School stays in the day header so a nine-hour school day cannot swallow the study canvas. */
export function WeekGrid({ days, today, tasks, lessons, holidays, timezone, initialNow }: {
  days: Date[];
  today: Date;
  tasks: WeekTask[];
  lessons: SchoolLesson[];
  holidays: Map<string, Holiday>;
  timezone: string;
  initialNow: string;
}) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(getZonedNow(timezone)), 30000);
    return () => clearInterval(timer);
  }, [timezone]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const boardDays: BoardDay[] = days.map((date) => {
    const holiday = holidays.get(dayKey(date));
    const blocks = tasks.filter((task) => isSameDay(task.date, date));
    const minutes = blocks.reduce((sum, task) => sum + blockMinutes(task.startTime, task.endTime), 0);
    const done = blocks.filter((task) => task.isDone).length;
    const school = holiday ? null : schoolDayBounds(lessons, date.getDay());
    const count = lessonsOn(lessons, date.getDay()).filter((lesson) => !lesson.isBreak).length;
    return {
      key: dayKey(date),
      title: format(date, 'EEEE'),
      dateLabel: format(date, 'd'),
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      note: holiday?.name,
      summary: blocks.length ? `${done}/${blocks.length} · ${formatMinutes(minutes)}` : undefined,
      context: school && (
        <Link href="/school-timetable" title={`School, ${count} lessons`} className="block truncate rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground">
          School {school.start} – {school.end}
        </Link>
      ),
    };
  });
  const entries: ScheduleEntry[] = tasks.map((task) => {
    const status = statusOf(task);
    const range = entryRange(task);
    const onNow = status === 'open' && isSameDay(task.date, today) && nowMinutes >= range.start && nowMinutes < range.end;
    return {
      id: task.id,
      day: dayKey(task.date),
      title: task.subject,
      startTime: task.startTime,
      endTime: task.endTime,
      kind: task.type === 'REVISION' ? 'revision' : 'homework',
      state: onNow ? 'active' : status === 'open' ? undefined : status,
    };
  });

  return (
    <WeekBoard
      label="Your study week"
      days={boardDays}
      entries={entries}
      emptyLabel="Free evening"
      renderActions={(entry) =>
        entry.state === 'done' ? null : (
          <Button asChild>
            <Link href={`/focus/${entry.id}`}>
              <Timer /> Focus on it
            </Link>
          </Button>
        )
      }
    />
  );
}
