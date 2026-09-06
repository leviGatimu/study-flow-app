import { getAllTasks, getMarkedDays, getEvents } from '@/lib/actions';
import { getCurrentScheduleState } from '@/lib/term-actions';
import { getSubjects } from '@/lib/subject-actions';
import { CalendarGrid } from '@/components/CalendarGrid';
import { TaskWithTemplate } from '@/lib/types';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CalendarPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const tasks = await getAllTasks();
  const markedDays = await getMarkedDays();
  const exams = await getEvents();
  const subjects = await getSubjects();
  // The end-of-school marker now comes from the active term's end date,
  // not the legacy UserProgress.schoolEndDate flag.
  const schedule = await getCurrentScheduleState();

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your study blocks and deadlines.
          </p>
        </div>
      </div>

      <div className="px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <CalendarGrid tasks={tasks as TaskWithTemplate[]} exams={exams} markedDays={markedDays} subjects={subjects} termEndDate={schedule?.termEndDate ?? null} />
        </div>
      </div>
    </div>
  );
}
