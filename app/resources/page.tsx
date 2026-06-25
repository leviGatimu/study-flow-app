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
    <div className="space-y-12 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-16 px-4 md:px-8">
      {/* Dynamic Header */}
      <div className="pt-10 pb-6 border-b border-border/40 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
            <BookOpen className="w-4 h-4 fill-current" />
            Knowledge Repository
          </div>
          <h1 className="text-6xl font-heading font-black tracking-tighter text-foreground leading-none">Resource Hub</h1>
          <p className="text-xl text-muted-foreground font-medium">Manage subject materials and track your mastery progress.</p>
        </div>

        <div className="flex items-center gap-4">
          <AddResourceForm allSubjects={subjects} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {subjectData.map((subject) => (
          <div key={subject.name} className="relative group">
            <Link 
              href={`/resources/${encodeURIComponent(subject.name)}`}
              className="block h-full"
            >
              <div className="bg-card border border-border/60 p-8 rounded-[40px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden h-full flex flex-col">
                {/* Decorative Icon */}
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <BookOpen size={120} />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="p-4 bg-primary/10 rounded-[24px] text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>

                <h3 className="text-2xl font-heading font-black mb-6 relative z-10 line-clamp-1 group-hover:text-primary transition-colors">
                  {subject.name}
                </h3>

                {/* Mastery Progress in Card */}
                <div className="space-y-3 mb-8 relative z-10">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <span className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Mastery</span>
                      <span>{subject.masteryPercentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                      <div 
                        className="h-full bg-primary transition-all duration-1000 group-hover:bg-primary shadow-lg shadow-primary/20" 
                        style={{ width: `${subject.masteryPercentage}%` }}
                      />
                  </div>
                </div>
                
                <div className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl border border-border/40 w-fit relative z-10">
                  <FileText className="w-3.5 h-3.5" />
                  {subject.resourceCount} {subject.resourceCount === 1 ? 'Resource' : 'Resources'}
                </div>
              </div>
            </Link>
            
            {/* Delete button positioned absolute to the card */}
            <div className="absolute top-6 right-16 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <DeleteSubjectButton subject={subject.name} />
            </div>
          </div>
        ))}
      </div>

      {subjects.length === 0 && (
        <div className="text-center py-32 bg-muted/5 border-2 border-dashed border-border/40 rounded-[40px]">
          <h2 className="text-2xl font-heading font-bold text-muted-foreground">No subjects found.</h2>
          <p className="text-muted-foreground mt-2">Go to Manage Schedule to add your first study block!</p>
        </div>
      )}
    </div>
  );
}
