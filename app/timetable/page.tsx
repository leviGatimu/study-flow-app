import { prisma } from '@/lib/prisma';
import { startOfWeek, endOfWeek, addDays, format, isSameDay } from 'date-fns';
import { getUserId } from "@/lib/auth";
import { byTerm, getViewScope } from '@/lib/scope';
import { redirect } from "next/navigation";
import { TimetableClient } from './TimetableClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TimetablePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(today, { weekStartsOn: 1 });   // Sunday

  // Tasks belong to a term, so this week is this week OF THE YEAR YOU HAVE
  // OPEN. In a finished year that is usually empty, which is correct: those
  // dates are in the past and its blocks live under their own dates.
  const scope = await getViewScope(userId);

  const weekTasks = await prisma.task.findMany({
    where: {
      userId,
      ...byTerm(scope),
      date: { gte: start, lte: end },
      isDeleted: false
    },
    orderBy: { startTime: 'asc' }
  });

  // Map tasks to serializable objects for Client Component
  const serializedTasks = weekTasks.map(t => ({
    id: t.id,
    startTime: t.startTime,
    endTime: t.endTime,
    subject: t.subject,
    isDone: t.isDone,
    isMissed: t.isMissed,
    type: t.type,
    date: t.date.toISOString()
  }));

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Timetable</h1>
            <p className="text-sm text-muted-foreground mt-1">
              A detailed view of your entire academic week.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <TimetableClient
            initialTasks={serializedTasks}
            startOfWeekStr={start.toISOString()}
          />
        </div>
      </div>
    </div>
  );
}