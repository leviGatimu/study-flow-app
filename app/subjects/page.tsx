import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSubjects } from "@/lib/subject-actions";
import { prisma } from "@/lib/prisma";
import { byClass, byTerm, getViewScope } from "@/lib/scope";
import { SubjectsClient } from "./SubjectsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SubjectsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  // This page queries Prisma itself instead of going through lib/, so it has
  // to apply the academic-year scope itself. Without it, a new year opened
  // showing the previous year's resources, homework, goals and report cards.
  const scope = await getViewScope(userId);

  const [subjects, resources, homeworks, goals, reportCards, tutorModules, studioNotes] = await Promise.all([
    getSubjects(),
    prisma.resource.findMany({ where: { userId, ...byClass(scope) }, orderBy: { createdAt: 'desc' } }),
    prisma.homework.findMany({ where: { userId, ...byTerm(scope) }, orderBy: { dueDate: 'asc' } }),
    prisma.subjectGoal.findMany({ where: { userId, ...byClass(scope) } }),
    prisma.reportCard.findMany({
      where: { userId, ...byTerm(scope) },
      include: { grades: true },
      orderBy: { createdAt: 'asc' } // Ascending so chart runs chronologically
    }),
    prisma.tutorModule.findMany({ where: { userId, ...byClass(scope) }, orderBy: { createdAt: 'desc' } }),
    prisma.studioNote.findMany({ where: { userId, ...byClass(scope) } }),
  ]);

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Hero */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
            Subjects Hub <span className="text-primary font-bold text-2xl opacity-80">({subjects.length})</span>
          </h1>
          <p className="text-base text-muted-foreground font-medium mt-2 max-w-2xl">
            Your academic command center. Manage courses, track performance growth, and organize study assets in one place.
          </p>
        </div>
      </section>

      <div className="px-4 md:px-8">
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
  );
}
