import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSubjects } from "@/lib/subject-actions";
import { prisma } from "@/lib/prisma";
import { byClass, byTerm, getViewScope } from "@/lib/scope";
import { extensionOf } from "@/lib/library";
import { Page } from "@/components/ui/page";
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

  const [subjects, resources, homeworks, goals, reportCards, studioNotes, exams, mastery] = await Promise.all([
    getSubjects(),
    prisma.resource.findMany({
      where: { userId, ...byClass(scope), type: { not: 'FOLDER' } },
      select: { id: true, subject: true, title: true, type: true, url: true, folder: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.homework.findMany({ where: { userId, ...byTerm(scope) }, orderBy: { dueDate: 'asc' } }),
    prisma.subjectGoal.findMany({ where: { userId, ...byClass(scope) } }),
    prisma.reportCard.findMany({
      where: { userId, ...byTerm(scope) },
      // Nested includes are out of the tombstone extension's reach.
      include: { grades: { where: { deletedAt: null } } },
      orderBy: { createdAt: 'asc' } // Ascending so chart runs chronologically
    }),
    // Notes are no longer shown or edited on the subject page. Ones written
    // before are still useful context for the study buddy, so they are read.
    prisma.studioNote.findMany({
      where: { userId, ...byClass(scope) },
      select: { id: true, subject: true, content: true },
    }),
    prisma.examEvent.findMany({
      where: { userId, ...byTerm(scope) },
      select: { id: true, title: true, date: true, subject: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.masteryItem.findMany({
      where: { userId, ...byClass(scope) },
      select: { id: true, subject: true, title: true, isCompleted: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // The file extension is worked out here: the helper reads paths with node's
  // `path`, which the client bundle does not have.
  const resourceItems = resources.map((r) => ({
    ...r,
    ext: r.type === 'FILE' ? extensionOf(r.url) || extensionOf(r.title) : '',
  }));

  // The header lives in SubjectsClient: whether the page shows the subject
  // list or one subject depends on ?subject=, which changes on the client
  // without a server round trip.
  return (
    <Page>
      <SubjectsClient
        initialSubjects={subjects}
        initialResources={resourceItems}
        initialHomeworks={homeworks}
        initialGoals={goals}
        initialReportCards={reportCards}
        initialNotes={studioNotes}
        initialExams={exams}
        initialMastery={mastery}
      />
    </Page>
  );
}
