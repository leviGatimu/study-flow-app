'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ScheduleBoard, type ScheduleDay } from '@/components/ScheduleBoard';
import { blockMinutes, formatMinutes } from '@/lib/schedule-layout';
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

  const boardDays: ScheduleDay[] = days.map((date) => {
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
      note: holiday?.name,
      summary: blocks.length ? `${done}/${blocks.length} done · ${formatMinutes(minutes)}` : 'No study blocks',
      context: school && <Link href="/school-timetable"><strong>School · {count} lessons</strong>{school.start} – {school.end}</Link>,
    };
  });
  const entries: ScheduleEntry[] = tasks.map((task) => {
    const status = statusOf(task);
    return {
      id: task.id,
      day: dayKey(task.date),
      title: task.subject,
      startTime: task.startTime,
      endTime: task.endTime,
      kind: task.type === 'REVISION' ? 'revision' : 'homework',
      state: status === 'open' ? undefined : status,
    };
  });

  return <ScheduleBoard
    title="Your study week"
    description="School hours above, your study blocks below"
    days={boardDays}
    entries={entries}
    emptyLabel="Free evening"
    nowMinutes={now.getHours() * 60 + now.getMinutes()}
  />;
}
