import Link from 'next/link';
import { redirect } from 'next/navigation';
import { endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { Plus } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getAllTasks, getCurrentUserTimezone, getEvents, getMarkedDays } from '@/lib/actions';
import { getCurrentScheduleState } from '@/lib/term-actions';
import { listSubjects } from '@/lib/subject-actions';
import { byTerm, getViewScope } from '@/lib/scope';
import { getZonedNow } from '@/lib/utils';

import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { QuickAddForm } from '@/components/QuickAddForm';
import { CalendarGrid, type CalendarData } from '@/components/CalendarGrid';

import { dayKey, monthHref, monthKey, parseMonthKey } from '../timetable/schedule-dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Everything the month grid shows, read for exactly the weeks it draws
 * (Monday before the 1st to Sunday after the last day) and nothing more.
 *
 * Dates leave the server as "yyyy-MM-dd" keys computed here, where tasks are
 * stored, so a browser in another timezone cannot shift a block onto the
 * neighbouring day.
 */
async function loadMonth(userId: string, month: Date): Promise<CalendarData> {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const scope = await getViewScope(userId);

  const [tasks, exams, homework, markedDays, schedule] = await Promise.all([
    getAllTasks({ from, to }),
    getEvents(),
    prisma.homework.findMany({
      where: { userId, ...byTerm(scope), dueDate: { gte: from, lte: to } },
      select: { id: true, subject: true, title: true, dueDate: true, isCompleted: true },
      orderBy: { dueDate: 'asc' },
    }),
    getMarkedDays(),
    getCurrentScheduleState(),
  ]);

  const inRange = (d: Date) => d >= from && d <= to;

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      subject: t.subject,
      type: t.type,
      startTime: t.startTime,
      endTime: t.endTime,
      isDone: t.isDone,
      isMissed: t.isMissed,
      hasProof: !!t.workDescription || !!t.proofPdfUrl,
      dateKey: dayKey(t.date),
    })),
    exams: exams
      .filter((e) => inRange(e.date))
      .map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime ?? null,
        priority: e.priority,
        dateKey: dayKey(e.date),
      })),
    homework: homework.map((h) => ({
      id: h.id,
      subject: h.subject,
      title: h.title,
      isCompleted: h.isCompleted,
      dateKey: dayKey(h.dueDate),
    })),
    markedDays: markedDays.filter(inRange).map(dayKey),
    term:
      schedule?.termId && !scope?.isArchive
        ? {
            name: schedule.termName,
            // Instants, not keys: term dates are written from the browser as
            // local midnight (see /year), so the browser is where they are
            // turned back into calendar days.
            start: schedule.termStartDate?.toISOString() ?? null,
            end: schedule.termEndDate?.toISOString() ?? null,
          }
        : null,
  };
}

/** Month: the grid of study blocks, homework deadlines and exams. */
export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const tz = await getCurrentUserTimezone();
  const today = startOfDay(getZonedNow(tz));
  const month = parseMonthKey((await searchParams).month) ?? startOfMonth(today);

  let data: CalendarData | null = null;
  let subjects: { id: string; name: string }[] = [];
  try {
    [data, subjects] = await Promise.all([loadMonth(userId, month), listSubjects()]);
  } catch (error) {
    console.error('Month page failed to load', error);
  }

  return (
    <Page>
      <PageHeader
        title="Month"
        description="Study blocks, homework deadlines and exams, a month at a time. Pick a day to see everything on it."
        actions={
          <QuickAddForm
            subjects={subjects}
            trigger={
              <Button size="lg">
                <Plus /> Add task
              </Button>
            }
          />
        }
      />
      <PageBody>
        {data ? (
          <CalendarGrid
            monthKey={monthKey(month)}
            todayKey={dayKey(today)}
            data={data}
            subjects={subjects}
          />
        ) : (
          <ErrorState
            title="This month could not be loaded"
            description="Something went wrong reading your calendar. Your data is safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href={monthHref(month)}>Try again</Link>
              </Button>
            }
          />
        )}
      </PageBody>
    </Page>
  );
}
