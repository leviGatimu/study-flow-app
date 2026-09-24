import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byClass, getViewScope } from '@/lib/scope';
import { getSubjects } from '@/lib/subject-actions';
import { StudyHub, type StudyHubData } from './StudyHub';

export const dynamic = 'force-dynamic';

/**
 * The Study hub: one door to every study tool, each showing the single fact
 * that makes it worth opening, plus a studio link per subject.
 *
 * Sticky notes, projects, study sets and studio notes are all class-scoped, so
 * every count follows the academic year being viewed. The focus counters live
 * on UserProgress and are account-wide - the page says "all time" for them.
 */
export default async function StudyPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const scope = await getViewScope(userId);
  const inYear = { userId, ...byClass(scope) };

  const [subjects, notes, projects, studySets, studioNotes, progress] = await Promise.all([
    getSubjects(),
    prisma.stickyNote.findMany({ where: inYear, select: { isDone: true } }),
    prisma.project.findMany({
      where: inYear,
      select: { title: true, status: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.tutorModule.findMany({
      where: inYear,
      select: { title: true, subject: true },
      orderBy: { createdAt: 'desc' },
    }),
    // Only studios with something written in them; the content itself is not
    // needed here and can be long.
    prisma.studioNote.findMany({
      where: { ...inYear, content: { not: '' } },
      select: { subject: true, updatedAt: true },
    }),
    prisma.userProgress.findUnique({
      where: { userId },
      select: { focusSessions: true, totalFocusMinutes: true },
    }),
  ]);

  const notesEditedAt = new Map(studioNotes.map((n) => [n.subject, n.updatedAt.toISOString()]));
  const setsPerSubject = new Map<string, number>();
  for (const set of studySets) {
    setsPerSubject.set(set.subject, (setsPerSubject.get(set.subject) ?? 0) + 1);
  }

  const data: StudyHubData = {
    now: new Date().toISOString(),
    notes: { total: notes.length, open: notes.filter((n) => !n.isDone).length },
    projects: {
      active: projects.filter((p) => p.status === 'ACTIVE').length,
      total: projects.length,
      latestTitle: projects[0]?.title ?? null,
    },
    studySets: { total: studySets.length, latestTitle: studySets[0]?.title ?? null },
    focus: {
      sessions: progress?.focusSessions ?? 0,
      minutes: progress?.totalFocusMinutes ?? 0,
    },
    subjects: subjects.map((s) => ({
      name: s.name,
      notesUpdatedAt: notesEditedAt.get(s.name) ?? null,
      studySets: setsPerSubject.get(s.name) ?? 0,
    })),
  };

  return <StudyHub data={data} />;
}
