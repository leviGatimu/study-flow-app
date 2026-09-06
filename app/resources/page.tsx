import { getUniqueSubjects, getResources, getMasteryItems } from '@/lib/actions';
import Link from 'next/link';
import { BookOpen, ChevronRight, FileText, GraduationCap } from 'lucide-react';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AddResourceForm } from '@/components/AddResourceForm';
import { DeleteSubjectButton } from '@/components/DeleteSubjectButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ResourcesPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const subjects = await getUniqueSubjects();

  // Fetch data for each subject
  const subjectData = await Promise.all(subjects.map(async (name) => {
    const [resources, masteryItems] = await Promise.all([
      getResources(name),
      getMasteryItems(name)
    ]);
    
    const completedMastery = masteryItems.filter(i => i.isCompleted).length;
    const totalMastery = masteryItems.length;
    const masteryPercentage = totalMastery === 0 ? 0 : Math.round((completedMastery / totalMastery) * 100);

    return { 
      name, 
      resourceCount: resources.length,
      masteryPercentage,
      totalMastery
    };
  }));

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Hero */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-medium text-xs">
            <BookOpen className="w-4 h-4 fill-current" />
            Knowledge repository
          </div>
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">Resource Hub</h1>
          <p className="text-base text-muted-foreground font-medium">Manage subject materials and track your mastery progress.</p>
        </div>

        <div className="flex items-center gap-4">
          <AddResourceForm allSubjects={subjects} />
        </div>
      </section>

      <div className="px-4 md:px-8 space-y-8">
        {subjects.length === 0 ? (
          <div className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
            No subjects found. Go to Manage Schedule to add your first study block.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {subjectData.map((subject) => (
              <div key={subject.name} className="relative group">
                <Link
                  href={`/resources/${encodeURIComponent(subject.name)}`}
                  className="block h-full"
                >
                  <div className="bg-card border border-border/60 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <h3 className="font-heading font-bold text-lg mb-4 line-clamp-1 group-hover:text-primary transition-colors duration-200">
                      {subject.name}
                    </h3>

                    {/* Mastery Progress in Card */}
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Mastery</span>
                        <span>{subject.masteryPercentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${subject.masteryPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-xl border border-border/40 w-fit">
                      <FileText className="w-3.5 h-3.5" />
                      {subject.resourceCount} {subject.resourceCount === 1 ? 'resource' : 'resources'}
                    </div>
                  </div>
                </Link>

                {/* Delete button positioned absolute to the card */}
                <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-20">
                  <DeleteSubjectButton subject={subject.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
