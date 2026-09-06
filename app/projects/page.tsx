import { getProjects } from '@/lib/project-actions';
import { ProjectList } from './ProjectList';
import { Rocket } from 'lucide-react';
import { ProjectWithDocs } from '@/lib/types';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DialogTriggerButton } from './DialogTriggerButton';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const projects = await getProjects();

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 animate-in fade-in duration-500">
      <div className="px-4 md:px-8 pt-6 pb-2 border-b border-border/40 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">Project Hub</h1>
          <p className="text-lg text-muted-foreground font-semibold mt-3">Design, document, and deliver.</p>
        </div>
        <DialogTriggerButton />
      </div>

      <div className="px-4 md:px-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-muted/50 border border-border/50 rounded-2xl text-center">
            <Rocket className="w-16 h-16 text-muted-foreground/20 mb-6" />
            <h2 className="text-2xl font-heading font-bold text-muted-foreground">No projects yet</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">Start your first venture today. Your AI Buddy is ready to help you plan.</p>
            <DialogTriggerButton className="mt-8" />
          </div>
        ) : (
          <ProjectList initialProjects={projects as ProjectWithDocs[]} />
        )}
      </div>
    </div>
  );
}
