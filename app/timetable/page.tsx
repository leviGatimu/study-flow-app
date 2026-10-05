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
import { ChevronLeft, ChevronRight, GraduationCap, Layers, Plus } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { ensureTasksGenerated, getCurrentUserTimezone } from '@/lib/actions';
import { getScheduleState } from '@/lib/term';
import { byClass, byTerm, getViewScope } from '@/lib/scope';
import { getSchoolLessons } from '@/lib/school-actions';
import { listSubjects } from '@/lib/subject-actions';
import { getZonedNow } from '@/lib/utils';
import { holidaysBetween } from '@/lib/holidays';

import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { QuickAddForm } from '@/components/QuickAddForm';
import { WeekGrid } from './WeekGrid';

import { dayKey, parseDayKey, weekHref } from './schedule-dates';
import { StudyLegend } from './study-block';

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

  return { tasks, lessons, subjects, routineCount };
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
  const today = startOfDay(getZonedNow(tz));
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
    <Page>
      <PageHeader
        title="Week"
        description="Your study blocks and school day, Monday to Sunday."
        highlight={{ label: 'This week', value: total > 0 ? `${done} / ${total} done` : 'Nothing planned' }}
        actions={
          <QuickAddForm
            subjects={data?.subjects ?? []}
            trigger={
              <Button size="lg">
                <Plus /> Add task
              </Button>
            }
          />
        }
      />
      <PageBody>
        {!data ? (
          <ErrorState
            title="Your week could not be loaded"
            description="Something went wrong reading your schedule. Your data is safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href={isThisWeek ? '/timetable' : weekHref(weekStart)}>Try again</Link>
              </Button>
            }
          />
        ) : (
          <>
            {(data.routineCount === 0 || data.lessons.length === 0) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.routineCount === 0 && (
                  <EmptyState
                    icon={<Layers />}
                    title="No study routine yet"
                    description="Add the study blocks you repeat every week and they will fill this page on their own."
                    action={
                      <Button asChild>
                        <Link href="/manage">Set up your study routine</Link>
                      </Button>
                    }
                  />
                )}
                {data.lessons.length === 0 && (
                  <EmptyState
                    icon={<GraduationCap />}
                    title="No school lessons yet"
                    description="Add your school timetable to see when you are in class alongside your study blocks."
                    action={
                      <Button asChild variant="outline">
                        <Link href="/school-timetable">Add school lessons</Link>
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            <Section
              title={rangeLabel}
              actions={
                <>
                  {!isThisWeek && (
                    <Button asChild variant="outline">
                      <Link href="/timetable">This week</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="icon" aria-label="Previous week">
                    <Link href={weekHref(addWeeks(weekStart, -1))}>
                      <ChevronLeft />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="icon" aria-label="Next week">
                    <Link href={weekHref(addWeeks(weekStart, 1))}>
                      <ChevronRight />
                    </Link>
                  </Button>
                </>
              }
            >
              <StudyLegend
                extra={
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-5 rounded border border-border bg-muted" />
                    School
                  </span>
                }
              />

              <WeekGrid days={days} today={today} tasks={data.tasks} lessons={data.lessons} holidays={holidays} />

              {total === 0 && data.routineCount > 0 && weekEnd >= today && (
                <p className="text-sm text-muted-foreground">
                  No study blocks this week. Blocks appear while a term is running -{' '}
                  <Link href="/year" className="font-medium text-primary hover:underline">
                    check Year &amp; terms
                  </Link>{' '}
                  if you expected some.
                </p>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </Page>
  );
}

