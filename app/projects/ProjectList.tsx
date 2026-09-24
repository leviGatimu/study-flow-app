'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight, Calendar, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { deleteProject } from '@/lib/project-actions';
import { ProjectWithDocs } from '@/lib/types';

export function ProjectList({ initialProjects }: { initialProjects: ProjectWithDocs[] }) {
  const [projects, setProjects] = useState<ProjectWithDocs[]>(initialProjects);
  const [toDelete, setToDelete] = useState<ProjectWithDocs | null>(null);
  const [deleting, setDeleting] = useState(false);
  const archived = useIsArchived();

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteProject(toDelete.id);
      setProjects((current) => current.filter((p) => p.id !== toDelete.id));
      toast.success('Project deleted.');
    } catch (error) {
      console.error(error);
      toast.error('That project could not be deleted. Try again.');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Panel key={project.id} interactive className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 break-words font-heading text-lg font-bold">
                <Link href={`/projects/${project.id}`} className="hover:text-primary">
                  {project.title}
                </Link>
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                {project.progress === 100 && <Pill tone="success">Done</Pill>}
                {!archived && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete project ${project.title}`}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setToDelete(project)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>

            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Started {format(new Date(project.createdAt), 'MMM yyyy')}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                {project.docs.length} {project.docs.length === 1 ? 'doc' : 'docs'}
              </span>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-end justify-between text-xs font-medium text-muted-foreground">
                <span>Progress</span>
                <span className="text-sm font-bold tabular-nums text-primary">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" aria-label={`${project.title} progress`} />
            </div>

            <Button asChild variant="outline" className="mt-6 w-full">
              <Link href={`/projects/${project.id}`}>
                Open project
                <ArrowRight />
              </Link>
            </Button>
          </Panel>
        ))}
      </div>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        isPending={deleting}
        title="Delete this project?"
        description={`"${toDelete?.title ?? ''}" and all of its docs will be removed.`}
      />
    </>
  );
}
