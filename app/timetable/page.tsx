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
import { lessonsOn, schoolDayBounds, toMinutes, type SchoolLesson } from '@/lib/school';
import { getZonedNow } from '@/lib/utils';

import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { QuickAddForm } from '@/components/QuickAddForm';
import { cn } from '@/lib/utils';

import { parseDayKey, weekHref } from './schedule-dates';
import { StudyLegend, StudyTypeIcon, StudyTypePill, statusOf, studyBlockClass } from './study-block';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type WeekTask = {
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

function dayItems(date: Date, tasks: WeekTask[], lessons: SchoolLesson[]): DayItem[] {
  const items: DayItem[] = tasks
    .filter((t) => isSameDay(t.date, date))
    .map((task) => ({ kind: 'task' as const, start: task.startTime, task }));

  const school = schoolDayBounds(lessons, date.getDay());
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

              <div className="space-y-3">
                {days.map((date) => {
                  const items = dayItems(date, data.tasks, data.lessons);
                  const isToday = isSameDay(date, today);
                  return (
                    <Panel
                      key={date.toISOString()}
                      padded={false}
                      className={cn(
                        'flex flex-col gap-4 p-4 md:flex-row md:p-5',
                        isToday && 'border-primary/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 md:w-32 md:shrink-0 md:flex-col md:items-start md:justify-start">
                        <div>
                          <p className="font-heading text-lg font-bold text-foreground">
                            {format(date, 'EEEE')}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {format(date, 'd MMM')}
                          </p>
                        </div>
                        {isToday && (
                          <Button asChild variant="outline" size="sm">
                            <Link href="/">Today</Link>
                          </Button>
                        )}
                      </div>

                      {items.length === 0 ? (
                        <p className="self-center text-sm font-medium text-muted-foreground">
                          Nothing planned.
                        </p>
                      ) : (
                        <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {items.map((item) =>
                            item.kind === 'school' ? (
                              <li key="school">
                                <Link
                                  href="/school-timetable"
                                  className="flex h-full flex-col gap-1 rounded-xl border border-border bg-muted/50 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                >
                                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                    {item.start} – {item.end}
                                  </span>
                                  <span className="flex items-center gap-2 font-bold text-foreground">
                                    <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                    School
                                  </span>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {item.lessons} {item.lessons === 1 ? 'lesson' : 'lessons'}
                                  </span>
                                </Link>
                              </li>
                            ) : (
                              <li
                                key={item.task.id}
                                className={cn(
                                  'flex flex-col gap-1 p-3',
                                  studyBlockClass(item.task.type, statusOf(item.task))
                                )}
                              >
                                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                  {item.task.startTime} – {item.task.endTime}
                                </span>
                                <span
                                  className={cn(
                                    'flex min-w-0 items-center gap-2 font-bold text-foreground',
                                    item.task.isDone && 'line-through decoration-2 opacity-70'
                                  )}
                                >
                                  <StudyTypeIcon type={item.task.type} />
                                  <span className="truncate">{item.task.subject}</span>
                                </span>
                                <span>
                                  <StudyTypePill type={item.task.type} status={statusOf(item.task)} />
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </Panel>
                  );
                })}
              </div>

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

