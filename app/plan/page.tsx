import { redirect } from 'next/navigation';
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { ensureTasksGenerated, getCurrentUserTimezone } from '@/lib/actions';
import { getScheduleState } from '@/lib/term';
import { byClass, byTerm, getViewScope } from '@/lib/scope';
import { getZonedNow } from '@/lib/utils';

import { PlanHub } from './PlanHub';
import { buildAgenda, dayKey, yearFact, type PlanHubData } from './plan-model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AGENDA_DAYS = 7;
const OVERDUE_SHOWN = 5;

/**
 * Plan: the hub over Calendar, This Week, Weekly Timetable and Year & Terms.
 *
 * Every read is scoped to the year being viewed, like the pages it links to,
 * and the whole page is six queries run together.
 */
export default async function PlanPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const tz = await getCurrentUserTimezone();
  const now = getZonedNow(tz);
  const today = startOfDay(now);
  const agendaEnd = endOfDay(addDays(today, AGENDA_DAYS - 1));
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // The agenda would read "nothing planned" for days whose blocks simply have
  // not been generated yet. This is the same idempotent, term-gated generation
  // the dashboard and calendar already run; it does nothing while paused.
  await ensureTasksGenerated(today, agendaEnd);

  const scope = await getViewScope(userId);
  const taskFrom = weekStart < today ? weekStart : today;
  const taskTo = weekEnd > agendaEnd ? weekEnd : agendaEnd;

  const [tasks, monthBlocks, exams, homework, templates, schedule] = await Promise.all([
    prisma.task.findMany({
      where: { userId, ...byTerm(scope), isDeleted: false, date: { gte: taskFrom, lte: taskTo } },
      select: { date: true, isDone: true, isMissed: true, subject: true, startTime: true },
    }),
    prisma.task.count({
      where: { userId, ...byTerm(scope), isDeleted: false, date: { gte: monthStart, lte: monthEnd } },
    }),
    // From the start of the month onward: covers this month's count, the
    // agenda window and the next exam in one read. Exams are few per term.
    prisma.examEvent.findMany({
      where: { userId, ...byTerm(scope), date: { gte: monthStart } },
      select: { id: true, title: true, kind: true, startTime: true, date: true },
      orderBy: { date: 'asc' },
    }),
    prisma.homework.findMany({
      where: { userId, ...byTerm(scope), isCompleted: false, dueDate: { lte: agendaEnd } },
      select: { id: true, subject: true, title: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.scheduleTemplate.findMany({
      where: { userId, ...byClass(scope) },
      select: { dayOfWeek: true },
    }),
    getScheduleState(userId),
  ]);

  const weekTasks = tasks.filter((t) => t.date >= weekStart && t.date <= weekEnd);
  const overdue = homework.filter((h) => h.dueDate < today);
  const nextExam = exams.find((e) => e.date >= today) ?? null;

  const data: PlanHubData = {
    todayKey: dayKey(today),
    isArchive: scope?.isArchive ?? false,
    calendar: {
      monthLabel: format(today, 'MMMM'),
      monthBlocks,
      monthExams: exams.filter((e) => e.date <= monthEnd).length,
      nextExam: nextExam ? { id: nextExam.id, title: nextExam.title, dateKey: dayKey(nextExam.date) } : null,
    },
    week: { done: weekTasks.filter((t) => t.isDone).length, total: weekTasks.length },
    timetable: {
      blocks: templates.length,
      days: new Set(templates.map((t) => t.dayOfWeek)).size,
    },
    year: yearFact(schedule, today, { isArchive: scope?.isArchive ?? false, label: scope?.label ?? null }),
    agenda: buildAgenda(dayKey(today), AGENDA_DAYS, tasks, homework, exams),
    overdueHomework: overdue.slice(0, OVERDUE_SHOWN).map((h) => ({
      id: h.id,
      subject: h.subject,
      title: h.title,
      dateKey: dayKey(h.dueDate),
    })),
    overdueCount: overdue.length,
  };

  return <PlanHub data={data} />;
}
