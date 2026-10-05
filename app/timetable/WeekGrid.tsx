import { format, isSameDay } from 'date-fns';
import { PartyPopper } from 'lucide-react';

import { DayBlock, DayColumns, blockMinutes, formatMinutes } from '@/components/DayColumns';
import type { Holiday } from '@/lib/holidays';
import { lessonsOn, schoolDayBounds, toMinutes, type SchoolLesson } from '@/lib/school';
import { cn } from '@/lib/utils';

import { dayKey } from './schedule-dates';
import { statusOf } from './study-block';

/**
 * The Week page's seven days: study blocks, the school day as one band,
 * holidays, and each day's done count and total. Presentational - the page
 * loads the rows and passes them in - so the layout can be rendered with any
 * data, which is how it is checked visually.
 */
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

type DayItem =
  | { kind: 'school'; start: string; end: string; lessons: number }
  | { kind: 'task'; start: string; task: WeekTask };

function dayItems(date: Date, tasks: WeekTask[], lessons: SchoolLesson[], isHoliday: boolean): DayItem[] {
  const items: DayItem[] = tasks
    .filter((t) => isSameDay(t.date, date))
    .map((task) => ({ kind: 'task' as const, start: task.startTime, task }));

  // School is shut on a public holiday too.
  const school = isHoliday ? null : schoolDayBounds(lessons, date.getDay());
  if (school) {
    items.push({
      kind: 'school',
      start: school.start,
      end: school.end,
      lessons: lessonsOn(lessons, date.getDay()).filter((l) => !l.isBreak).length,
    });
  }
  return items.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function WeekGrid({
  days,
  today,
  tasks,
  lessons,
  holidays,
}: {
  days: Date[];
  today: Date;
  tasks: WeekTask[];
  lessons: SchoolLesson[];
  holidays: Map<string, Holiday>;
}) {
  return (
    <DayColumns
      label="This week, Monday to Sunday"
      days={days.map((date) => {
        const holiday = holidays.get(dayKey(date)) ?? null;
        const items = dayItems(date, tasks, lessons, !!holiday);
        const blocks = items.filter((i) => i.kind === 'task');
        const minutes = blocks.reduce((sum, i) => sum + blockMinutes(i.task.startTime, i.task.endTime), 0);
        const done = blocks.filter((i) => i.task.isDone).length;
        return {
          key: dayKey(date),
          title: format(date, 'EEEE'),
          subtitle: format(date, 'd MMM'),
          isToday: isSameDay(date, today),
          note: holiday && (
            <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <PartyPopper aria-hidden="true" className="size-3 shrink-0" />
              {holiday.name}
            </p>
          ),
          empty: holiday ? 'Routine off for the holiday.' : 'Nothing planned.',
          summary:
            blocks.length > 0
              ? { label: `${done} / ${blocks.length} done`, value: formatMinutes(minutes) }
              : null,
          items: items.map((item) => {
            if (item.kind === 'school') {
              return (
                <DayBlock
                  key="school"
                  accent="school"
                  href="/school-timetable"
                  time={`${item.start} – ${item.end}`}
                  title="School"
                  meta={`${item.lessons} ${item.lessons === 1 ? 'lesson' : 'lessons'}`}
                />
              );
            }
            const status = statusOf(item.task);
            const revision = item.task.type === 'REVISION';
            return (
              <DayBlock
                key={item.task.id}
                accent={revision ? 'revision' : 'homework'}
                state={status === 'open' ? 'open' : status}
                srLabel={revision ? 'Revision' : 'Homework'}
                time={`${item.task.startTime} – ${item.task.endTime}`}
                title={item.task.subject}
                titleClassName={cn(item.task.isDone && 'text-muted-foreground line-through')}
                meta={
                  <>
                    <span className="tabular-nums">{formatMinutes(blockMinutes(item.task.startTime, item.task.endTime))}</span>
                    {status === 'done' && <span className="font-semibold text-success">· Done</span>}
                    {status === 'missed' && <span className="font-semibold text-destructive">· Missed</span>}
                  </>
                }
              />
            );
          }),
        };
      })}
    />
  );
}
