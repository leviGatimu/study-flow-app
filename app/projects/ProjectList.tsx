'use client';

import { useState } from 'react';
import { 
  Rocket, Calendar, Trash2, 
  ArrowRight, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { deleteProject } from '@/lib/project-actions';
import { format } from 'date-fns';
import Link from 'next/link';
import { ProjectWithDocs } from '@/lib/types';

export function ProjectList({ initialProjects }: { initialProjects: ProjectWithDocs[] }) {
  const [projects, setProjects] = useState<ProjectWithDocs[]>(initialProjects);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {projects.map((project, idx) => (
        <div 
          key={project.id}
          className="group relative bg-card border border-border/60 rounded-[40px] p-8 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-6"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
             <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-500">
               <Rocket className="w-8 h-8" />
             </div>
             <Button 
               variant="ghost" 
               size="icon" 
               className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
               onClick={() => handleDelete(project.id)}
             >
               <Trash2 className="w-5 h-5" />
             </Button>
          </div>

          {/* Title & Stats */}
          <div className="space-y-4 mb-8">
            <h3 className="text-3xl font-heading font-black tracking-tight group-hover:text-primary transition-colors">
              {project.title}
            </h3>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase tracking-widest">
                 <Calendar className="w-3.5 h-3.5" />
                 {format(new Date(project.createdAt), 'MMM yyyy')}
               </div>
               <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase tracking-widest">
                 <Clock className="w-3.5 h-3.5" />
                 {project.docs.length} Docs
               </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-4 mb-10">
            <div className="flex justify-between items-end">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Execution Level</span>
               <span className="text-sm font-black text-primary">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-3 rounded-full bg-muted shadow-inner" />
          </div>

          {/* Footer Action */}
          <Link href={`/projects/${project.id}`}>
            <Button className="w-full h-14 rounded-[20px] bg-foreground text-background font-bold gap-3 hover:bg-primary hover:text-white transition-all shadow-lg hover:shadow-primary/20 group/btn">
              OPEN PROJECT <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </Link>

          {project.progress === 100 && (
            <div className="absolute -top-3 -right-3 bg-success text-white p-2 rounded-xl shadow-xl border-4 border-background scale-110">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
