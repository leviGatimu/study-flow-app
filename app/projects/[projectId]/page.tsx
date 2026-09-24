import { notFound, redirect } from 'next/navigation';

import { getProjectById } from '@/lib/project-actions';
import { getUserId } from '@/lib/auth';
import { ProjectWithDocs } from '@/lib/types';
import { ProjectInterface } from './ProjectInterface';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  // getProjectById includes docs without the soft-delete filter (a nested
  // include is outside the Prisma extension's reach), so a deleted doc would
  // otherwise come straight back on the refresh that follows deleting it.
  const docs = project.docs.filter((doc) => !doc.deletedAt);

  return <ProjectInterface project={{ ...project, docs } as ProjectWithDocs} />;
}
