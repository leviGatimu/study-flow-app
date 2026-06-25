"use client";

import { Brain, Plus, Search, FileText, Sparkles, Target, LayoutGrid, ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getTutorModules } from "@/lib/tutor-actions";
import { TutorModule } from "@/lib/types";

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-orange-500' : 'text-destructive';
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} className="stroke-muted" strokeWidth="5" fill="none" />
        <circle
          cx="28" cy="28" r={r}
          className={cn('transition-all duration-1000', tone)}
          stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-black', tone)}>{score}</span>
    </div>
  );
}

export default function TutorClient() {
  const [modules, setModules] = useState<TutorModule[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      const m = await getTutorModules();
      setModules(m as any);
      setIsLoaded(true);
    }
    loadData();
  }, []);

  const filteredModules = modules.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      
      {/* Premium, Clean Header */}
      <header className="px-6 md:px-12 py-12 md:py-16 border-b border-border/40 bg-card/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/textures/cubes.png')] opacity-[0.02] dark:opacity-[0.04] pointer-events-none" />
        
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20">
              <Brain className="w-3 h-3" /> Cognitive Training
            </div>
            <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tighter">AI Quiz Generator</h1>
            <p className="text-lg text-muted-foreground font-medium max-w-xl">
              Upload your documents and let the AI generate interactive, targeted practice quizzes to test your mastery.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/tutor/new">
              <Button className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-primary hover:text-primary-foreground font-bold text-base gap-2 shadow-lg hover:-translate-y-0.5 transition-all">
                <Plus className="w-5 h-5" /> Generate New Quiz
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 mt-12 space-y-8">
        
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <LayoutGrid className="w-5 h-5 text-muted-foreground" /> Your Quiz Library
           </h2>
           <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search by title or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-4 bg-muted/40 border border-border/60 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
              />
           </div>
        </div>

        {/* Quiz Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {!isLoaded ? (
              [1,2,3,4,5,6].map(i => (
                 <div key={i} className="h-48 rounded-[24px] bg-muted/30 animate-pulse border border-border/40" />
              ))
           ) : filteredModules.length === 0 ? (
             <div className="col-span-full py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/60 rounded-[32px] bg-muted/5">
                <div className="w-20 h-20 bg-muted/50 rounded-2xl flex items-center justify-center mb-6">
                   <Target className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">
                   {searchQuery ? "No matching quizzes found" : "Your library is empty"}
                </h3>
                <p className="text-muted-foreground font-medium mt-2 mb-6 max-w-sm">
                   {searchQuery ? "Try adjusting your search terms." : "Click the button above to generate your first AI-powered practice quiz."}
                </p>
                {!searchQuery && (
                  <Link href="/tutor/new">
                    <Button variant="outline" className="rounded-full h-12 px-6 font-bold">
                      Create Quiz
                    </Button>
                  </Link>
                )}
             </div>
           ) : (
             filteredModules.map((module) => {
               const count = (() => { try { return JSON.parse(module.questions || "[]").length; } catch { return 0; } })();
               const scored = module.score !== null && module.score !== undefined;
               const s = module.score || 0;
               return (
                 <Link key={module.id} href={`/tutor/${module.id}`} className="block group">
                   <Card className="relative h-full overflow-hidden rounded-[28px] border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] hover:border-primary/40 flex flex-col">

                     {/* Score-tinted ambient glow */}
                     <div className={cn(
                       "absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl -z-0 opacity-20 group-hover:opacity-45 transition-opacity duration-500",
                       scored && s >= 80 ? "bg-emerald-500" :
                       scored && s >= 50 ? "bg-orange-500" :
                       scored ? "bg-destructive" : "bg-primary"
                     )} />

                     <div className="relative z-10 flex items-center justify-between mb-5">
                       <span className="inline-flex text-[10px] font-black uppercase tracking-wider text-muted-foreground px-3 py-1 bg-muted rounded-full truncate max-w-[60%]">
                          {module.subject}
                       </span>
                       <span className="text-[10px] font-bold text-muted-foreground/70">
                          {format(new Date(module.createdAt), "MMM d, yyyy")}
                       </span>
                     </div>

                     <div className="relative z-10 flex items-start gap-4 flex-1">
                        {scored ? (
                          <ScoreRing score={s} />
                        ) : (
                          <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Sparkles className="w-6 h-6" />
                          </div>
                        )}
                        <h3 className="text-xl font-heading font-black text-foreground line-clamp-3 leading-snug group-hover:text-primary transition-colors pt-0.5">
                           {module.title}
                        </h3>
                     </div>

                     <div className="relative z-10 mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                           <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {count} Qs</span>
                           {scored && (
                             <span className={cn(
                               "flex items-center gap-1 uppercase tracking-wider",
                               s >= 80 ? "text-emerald-600" : s >= 50 ? "text-orange-600" : "text-destructive"
                             )}>
                               <Trophy className="w-3.5 h-3.5" /> {s >= 80 ? "Mastered" : s >= 50 ? "Intermediate" : "Review"}
                             </span>
                           )}
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-black text-primary group-hover:gap-2.5 transition-all">
                           {scored ? "Review" : "Start"} <ArrowRight className="w-4 h-4" />
                        </span>
                     </div>
                   </Card>
                 </Link>
               );
             })
           )}
        </div>
      </div>
    </div>
  );
}
