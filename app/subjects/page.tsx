import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSubjects } from "@/lib/subject-actions";
import { prisma } from "@/lib/prisma";
import { SubjectsClient } from "./SubjectsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SubjectsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [subjects, resources, homeworks, goals, reportCards, tutorModules, studioNotes] = await Promise.all([
    getSubjects(),
    prisma.resource.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.homework.findMany({ where: { userId }, orderBy: { dueDate: 'asc' } }),
    prisma.subjectGoal.findMany({ where: { userId } }),
    prisma.reportCard.findMany({
      where: { userId },
      include: { grades: true },
      orderBy: { createdAt: 'asc' } // Ascending so chart runs chronologically
    }),
    prisma.tutorModule.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.studioNote.findMany({ where: { userId } }),
  ]);

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Dynamic Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-5xl font-heading font-black tracking-tight text-foreground uppercase">
              Subjects Hub <span className="text-primary font-bold text-3xl opacity-80">({subjects.length})</span>
            </h1>
            <p className="text-xl text-muted-foreground font-semibold mt-3">
              Your academic command center. Manage courses, track performance growth, and organize study assets in one place.
            </p>
          </div>
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-4 duration-500 px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <SubjectsClient
            initialSubjects={subjects}
            initialResources={resources}
            initialHomeworks={homeworks}
            initialGoals={goals}
            initialReportCards={reportCards as any}
            initialTutorModules={tutorModules}
            initialNotes={studioNotes}
          />
        </div>
      </div>
    </div>
  );
}
