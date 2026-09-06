import { getResources, getMasteryItems, getSubjectStats } from '@/lib/actions';
import { AddResourceForm } from '@/components/AddResourceForm';
import { DeleteResourceButton } from '@/components/DeleteResourceButton';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { MasteryList } from '@/components/MasteryList';
import { 
  FileText, Link as LinkIcon, 
  ChevronLeft, GraduationCap, 
  BookOpen, Sparkles,
  BarChart3, Clock, Target, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Resource, MasteryItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function SubjectResourcesPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const decodedSubject = decodeURIComponent(subject);
  
  const resources = await getResources(decodedSubject);
  const masteryItems = await getMasteryItems(decodedSubject);
  const stats = await getSubjectStats(decodedSubject);

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Subject Header */}
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40 space-y-4">
        <Link href="/resources" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to subjects
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-primary/10 rounded-xl text-primary">
               <GraduationCap className="w-6 h-6" />
             </div>
             <div>
               <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">{decodedSubject}</h1>
               <p className="text-base text-muted-foreground font-medium mt-1">Study materials and syllabus tracking.</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href={`/studio/${encodeURIComponent(decodedSubject)}`}>
               <Button className="h-12 px-6 rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Sparkles className="w-5 h-5" />
                  Deep work studio
               </Button>
            </Link>

            {/* Subject Quick Stats */}
            {stats && (
              <div className="flex items-center gap-4 bg-card border border-border/60 p-2 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-muted/30 border border-border/40">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground leading-none">Time spent</p>
                      <p className="text-lg font-black text-foreground">{stats.timeSpent}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-muted/30 border border-border/40">
                    <Target className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground leading-none">Mastery</p>
                      <p className="text-lg font-black text-foreground">{stats.completionRate}%</p>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Mastery & Analytics */}
        <div className="lg:col-span-7 space-y-6">
           {/* Detailed Subject Stats */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatMiniCard
                label="Total sessions"
                value={stats?.totalSessions || 0}
                icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
              />
              <StatMiniCard
                label="Completed"
                value={stats?.completedSessions || 0}
                icon={<CheckCircle2 className="w-5 h-5 text-success" />}
              />
              <StatMiniCard
                label="Avg. session"
                value={stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                icon={<Clock className="w-5 h-5 text-orange-500" />}
              />
           </div>

           <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-primary" />
                 Syllabus Mastery
               </h2>
               <AddMasteryForm subject={decodedSubject} />
             </div>

             <MasteryList
                items={masteryItems as MasteryItem[]}
                subject={decodedSubject}
              />
           </div>
        </div>

        {/* Right Column: Resources */}
        <div className="lg:col-span-5 space-y-6">
           <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Resources
               </h2>
               <AddResourceForm subject={decodedSubject} />
             </div>

             <div className="space-y-4">
               {resources.length === 0 ? (
                 <div className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                   No resources yet. Add a link or upload a file above.
                 </div>
               ) : (
                 resources.map((res: Resource) => (
                   <div
                    key={res.id}
                    className="group flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors duration-200"
                   >
                     <div className="flex items-center gap-4">
                       <div className={cn(
                         "p-3 rounded-xl shrink-0",
                         res.type === 'FILE' ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600"
                       )}>
                         {res.type === 'FILE' ? <FileText className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                       </div>
                       <div className="min-w-0">
                         <p className="font-bold text-foreground leading-none mb-1.5 truncate group-hover:text-primary transition-colors duration-200">{res.title}</p>
                         <p className="text-xs font-medium text-muted-foreground">{res.type}</p>
                       </div>
                     </div>

                     <div className="flex items-center gap-2 shrink-0 ml-3">
                       <a
                        href={res.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${res.title}`}
                        className="p-2.5 rounded-xl bg-background border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors duration-200"
                       >
                         <ChevronLeft className="w-4 h-4 rotate-180" />
                       </a>
                       <DeleteResourceButton id={res.id} subject={decodedSubject} />
                     </div>
                   </div>
                 ))
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatMiniCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <Card className="p-6 border border-border/60 rounded-2xl shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors duration-200">
      <div className="p-3 bg-muted/50 rounded-xl shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground leading-none mb-1.5">{label}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </Card>
  );
}
