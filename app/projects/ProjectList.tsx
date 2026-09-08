'use client';

import { useState } from 'react';
import { 
  Rocket, Calendar, Trash2, 
  ArrowRight, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { deleteProject } from '@/lib/project-actions';
import { useIsArchived } from '@/components/ArchiveContext';
import { format } from 'date-fns';
import Link from 'next/link';
import { ProjectWithDocs } from '@/lib/types';

export function ProjectList({ initialProjects }: { initialProjects: ProjectWithDocs[] }) {
  const [projects, setProjects] = useState<ProjectWithDocs[]>(initialProjects);

  const archived = useIsArchived();

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group relative bg-card border border-border/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
             <div className="p-4 bg-primary/10 rounded-xl text-primary">
               <Rocket className="w-8 h-8" />
             </div>
             {!archived && (
               <Button
                 variant="ghost"
                 size="icon"
                 aria-label={`Delete project "${project.title}"`}
                 className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                 onClick={() => handleDelete(project.id)}
               >
                 <Trash2 className="w-5 h-5" />
               </Button>
             )}
          </div>

          {/* Title & Stats */}
          <div className="space-y-4 mb-8">
            <h3 className="text-2xl font-heading font-bold tracking-tight group-hover:text-primary transition-colors">
              {project.title}
            </h3>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                 <Calendar className="w-3.5 h-3.5" />
                 {format(new Date(project.createdAt), 'MMM yyyy')}
               </div>
               <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                 <Clock className="w-3.5 h-3.5" />
                 {project.docs.length} Docs
               </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-4 mb-10">
            <div className="flex justify-between items-end">
               <span className="text-xs font-medium text-muted-foreground">Execution level</span>
               <span className="text-sm font-bold text-primary">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-3 rounded-full bg-muted shadow-inner" />
          </div>

          {/* Footer Action */}
          <Link href={`/projects/${project.id}`}>
            <Button className="w-full h-12 rounded-xl font-bold gap-2">
              Open project <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          {project.progress === 100 && (
            <div className="absolute -top-3 -right-3 bg-success text-success-foreground p-2 rounded-xl shadow-md border-2 border-background">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
