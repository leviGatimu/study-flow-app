import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, GraduationCap, Layers } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { ensureTasksGenerated, getCurrentUserTimezone } from '@/lib/actions';
import { getScheduleState } from '@/lib/term';
import { byClass, byTerm, getViewScope } from '@/lib/scope';
import { getSchoolLessons } from '@/lib/school-actions';
import { listSubjects } from '@/lib/subject-actions';
import { getZonedNow } from '@/lib/utils';
import { holidaysBetween } from '@/lib/holidays';

import { EdgeKey, ScheduleFrame } from '@/components/schedule/ScheduleFrame';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { QuickAddForm } from '@/components/QuickAddForm';
import { WeekGrid } from './WeekGrid';

import { dayKey, parseDayKey, weekHref } from './schedule-dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadWeek(userId: string, weekStart: Date, weekEnd: Date, today: Date) {
  const scope = await getViewScope(userId);

  // The week's blocks are generated from the study routine on demand, like the
  // dashboard does for today. Only from today onward - a past day's missing
  // block would be created and instantly marked missed - and never past the
  // term's end or while an archived year is open. ensureTasksGenerated is
  // idempotent and does nothing unless a term is running.
  if (!scope?.isArchive && weekEnd >= today) {
    const schedule = await getScheduleState(userId);
    const from = weekStart > today ? weekStart : today;
    const termEnd = schedule.termEndDate ? endOfDay(schedule.termEndDate) : null;
    const to = termEnd && termEnd < weekEnd ? termEnd : weekEnd;
    if (from <= to) await ensureTasksGenerated(from, to);
  }

  const [tasks, lessons, subjects, routineCount] = await Promise.all([
    prisma.task.findMany({
      where: { userId, ...byTerm(scope), isDeleted: false, date: { gte: weekStart, lte: weekEnd } },
      select: {
        id: true,
        subject: true,
        type: true,
        startTime: true,
        endTime: true,
        isDone: true,
        isMissed: true,
        date: true,
      },
      orderBy: { startTime: 'asc' },
    }),
    getSchoolLessons(),
    listSubjects(),
    prisma.scheduleTemplate.count({ where: { userId, ...byClass(scope) } }),
  ]);

  const homework = await prisma.homework.findMany({
    where: { userId, taskId: { in: tasks.map((task) => task.id) } },
    select: { id: true, title: true, taskId: true },
  });

  return { tasks, homework, lessons, subjects, routineCount };
}

/**
 * Week: the section's landing page. The seven days from Monday, each with the
 * school day as one band and the study blocks the routine (or a quick add)
 * put on it.
 */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const tz = await getCurrentUserTimezone();
  const now = getZonedNow(tz);
  const today = startOfDay(now);
  const requested = parseDayKey((await searchParams).week);
  const weekStart = startOfWeek(requested ?? today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const isThisWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 }));

  let data: Awaited<ReturnType<typeof loadWeek>> | null = null;
  try {
    data = await loadWeek(userId, weekStart, weekEnd, today);
  } catch (error) {
    console.error('Week page failed to load', error);
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const holidays = holidaysBetween(tz, dayKey(weekStart), dayKey(weekEnd));
  const done = data?.tasks.filter((t) => t.isDone).length ?? 0;
  const total = data?.tasks.length ?? 0;
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeLabel = `${format(weekStart, sameMonth ? 'd' : 'd MMM')} – ${format(weekEnd, 'd MMMM yyyy')}`;

  return (
    <ScheduleFrame
      title={rangeLabel}
      meta={total > 0 ? `${done} of ${total} study blocks done this week` : 'Nothing planned yet'}
      controls={
        <>
          <Button asChild variant="outline" size="icon-sm" aria-label="Previous week">
            <Link href={weekHref(addWeeks(weekStart, -1))}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-label="Next week">
            <Link href={weekHref(addWeeks(weekStart, 1))}>
              <ChevronRight />
            </Link>
          </Button>
          {!isThisWeek && (
            <Button asChild variant="outline" size="sm">
              <Link href="/timetable">This week</Link>
            </Button>
          )}
        </>
      }
      legend={<EdgeKey />}
      actions={<QuickAddForm subjects={data?.subjects ?? []} variant="default" />}
    >
      {!data ? (
        <div className="p-4 md:p-6">
          <ErrorState
            title="Your week could not be loaded"
            description="Something went wrong reading your schedule. Your data is safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href={isThisWeek ? '/timetable' : weekHref(weekStart)}>Try again</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          {(data.routineCount === 0 || data.lessons.length === 0) && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-border/60 bg-muted/30 px-4 py-2 text-sm text-muted-foreground md:px-5">
              {data.routineCount === 0 && (
                <span className="flex items-center gap-1.5">
                  <Layers aria-hidden="true" className="size-4" /> No study routine yet.{' '}
                  <Link href="/manage" className="font-medium text-primary hover:underline">Set it up</Link>
                </span>
              )}
              {data.lessons.length === 0 && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap aria-hidden="true" className="size-4" /> No school lessons yet.{' '}
                  <Link href="/school-timetable" className="font-medium text-primary hover:underline">Add them</Link>
                </span>
              )}
            </div>
          )}
          {total === 0 && data.routineCount > 0 && weekEnd >= today && (
            <p className="shrink-0 border-b border-border/60 bg-muted/30 px-4 py-2 text-sm text-muted-foreground md:px-5">
              No study blocks this week. Blocks appear while a term is running -{' '}
              <Link href="/year" className="font-medium text-primary hover:underline">check Year &amp; terms</Link> if you expected some.
            </p>
          )}
          <div className="min-h-0 flex-1">
            <WeekGrid days={days} today={today} tasks={data.tasks} homework={data.homework} lessons={data.lessons} holidays={holidays} timezone={tz} initialNow={format(now, "yyyy-MM-dd'T'HH:mm:ss")} />
          </div>
        </div>
      )}
    </ScheduleFrame>
  );
}
