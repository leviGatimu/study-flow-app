import { getProjectById } from '@/lib/project-actions';
import { notFound } from 'next/navigation';
import { ProjectInterface } from './ProjectInterface';
import { ProjectWithDocs } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectById(projectId);

  if (!project) notFound();

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <ProjectInterface project={project as ProjectWithDocs} />
    </div>
  );
}
