import { getEvents, syncStreak, getSubjectStats, getMasteryItems } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Target, 
  Flame, 
  Brain, 
  ChevronRight, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  History,
  GraduationCap,
  LayoutGrid,
  Award,
  Sparkles,
  Hourglass,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ExamsClient, DeleteExamButton } from '@/components/ExamsClient';
import { UploadTimetableDialog } from '@/components/UploadTimetableDialog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExamsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [events, streakData] = await Promise.all([
    getEvents(),
    syncStreak()
  ]);

  const now = startOfDay(new Date());
  const upcomingExams = events
    .filter(e => !isAfter(now, new Date(e.date)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastExams = events
    .filter(e => isAfter(now, new Date(e.date)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const nearestExam = upcomingExams[0];
  const nearestStats = nearestExam ? await getSubjectStats(nearestExam.title) : null;
  const nearestMastery = nearestExam ? await getMasteryItems(nearestExam.title) : [];
  
  const daysRemaining = nearestExam ? differenceInDays(new Date(nearestExam.date), now) : 0;

  // Extract month and day number for calendar badge UI
  const examMonth = nearestExam ? format(new Date(nearestExam.date), 'MMM') : '';
  const examDay = nearestExam ? format(new Date(nearestExam.date), 'dd') : '';

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-12 space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32">
      
      {/* Dynamic background glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Header section */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10 border-b border-border/40 pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <GraduationCap className="w-3.5 h-3.5" /> Exam & Assessment Center
          </div>
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground uppercase">
            Assessments
          </h1>
          <p className="text-xl text-muted-foreground font-semibold max-w-2xl leading-relaxed">
            Track your upcoming exam dates, monitor preparation levels, and plan study focuses to stay prepared.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <UploadTimetableDialog />
          <ExamsClient events={events} />

          <div className="h-11 px-5 bg-card border border-border/50 shadow-sm rounded-xl flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
              <div className="absolute inset-0 bg-orange-500 blur-lg opacity-25" />
            </div>
            <div>
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Study Streak</p>
              <p className="text-base font-heading font-black text-foreground leading-none">{streakData?.currentStreak || 0} Days</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main upcoming target section */}
      {nearestExam ? (
        <section className="space-y-8">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-heading font-black tracking-tight uppercase tracking-wider text-muted-foreground">Next Upcoming Exam</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Main Hero Card displaying closest exam */}
            <div className="xl:col-span-8">
              <Card className="h-full bg-card/40 backdrop-blur-xl border-border/40 rounded-[32px] p-8 md:p-12 relative overflow-hidden shadow-xl group transition-all duration-500 hover:border-primary/30">
                
                {/* Subtle Ambient Glow */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] -z-10 translate-x-1/4 -translate-y-1/4" />
                
                <div className="relative z-10 flex flex-col md:flex-row h-full items-center md:items-stretch justify-between gap-8 md:gap-12">
                  
                  {/* Left: Info details */}
                  <div className="flex flex-col justify-between flex-1 gap-8 text-center md:text-left">
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none",
                          nearestExam.priority === 'HIGH' 
                            ? "bg-red-500/10 text-red-500 border-red-500/20" 
                            : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {nearestExam.priority} Priority
                        </span>
                        
                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-wider bg-muted/30 px-3 py-1 rounded-full border border-border/40 leading-none">
                          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                          {format(new Date(nearestExam.date), 'EEEE, MMMM do')}
                        </div>
                      </div>

                      <Link href={`/exams/${nearestExam.id}`} className="group/title inline-block">
                        <h3 className="text-3xl md:text-5xl font-heading font-black tracking-tight text-foreground uppercase leading-tight line-clamp-2 group-hover/title:text-primary transition-colors">
                          {nearestExam.title}
                        </h3>
                      </Link>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center md:justify-start w-full gap-3">
                      <Link href={`/focus?subject=${encodeURIComponent(nearestExam.title)}`} className="w-full sm:max-w-xs">
                        <Button className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-sm gap-2 shadow-md shadow-primary/10 transition-all cursor-pointer">
                          <Brain className="w-4 h-4" />
                          Start Revision Session
                          <ArrowUpRight className="w-4 h-4 opacity-75" />
                        </Button>
                      </Link>
                      <Link href={`/exams/${nearestExam.id}`} className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full h-12 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
                          View Full Prep <ArrowUpRight className="w-4 h-4 opacity-75" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Right: Premium Digital Flip Calendar Clock (Replaces circular SVG) */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-60 md:w-64 bg-muted/20 border border-border/30 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
                    
                    {/* Calendar Badge Icon sheet */}
                    <div className="w-24 h-24 bg-card border border-border/40 rounded-2xl overflow-hidden shadow-md flex flex-col mb-4">
                      <div className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest text-center py-1 border-b border-border/20 leading-none">
                        {examMonth}
                      </div>
                      <div className="flex-1 flex items-center justify-center text-4xl font-heading font-black text-foreground leading-none">
                        {examDay}
                      </div>
                    </div>

                    <div className="text-center space-y-1">
                      <span className="text-4xl font-heading font-black tracking-tighter text-foreground drop-shadow-[0_0_15px_rgba(var(--primary),0.1)] block">
                        {daysRemaining === 0 ? "Today" : daysRemaining === 1 ? "1 Day" : `${daysRemaining} Days`}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Remaining</span>
                    </div>

                    {/* Progress Slider Track indicating timeframe (Critical alert if < 3 days) */}
                    <div className="w-full mt-6 space-y-1">
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden border border-border/10">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            daysRemaining <= 3 ? "bg-red-500" : daysRemaining <= 7 ? "bg-orange-500" : "bg-primary"
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, (1 - daysRemaining / 30) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/60 text-center block">
                        Timeline Threshold
                      </span>
                    </div>
                  </div>

                </div>
              </Card>
            </div>

            {/* Preparation Bento stats cards */}
            <div className="xl:col-span-4 flex flex-col gap-6">
              {/* Readiness Card */}
              <Card className="flex-1 bg-card/40 backdrop-blur-xl border-border/40 rounded-[24px] p-6 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -z-10" />
                <div className="relative z-10 space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" /> Subject Readiness
                    </h4>
                    <span className="text-2xl font-heading font-black text-primary">{nearestStats?.completionRate || 0}%</span>
                  </div>
                  
                  <Progress value={nearestStats?.completionRate || 0} className="h-2 bg-muted rounded-full" />

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary/60" /> Focus Time
                      </p>
                      <p className="text-xl font-heading font-black text-foreground leading-none">{nearestStats?.timeSpent || '0m'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Zap className="w-3 h-3 text-primary/60" /> Sessions
                      </p>
                      <p className="text-xl font-heading font-black text-foreground leading-none">{nearestStats?.completedSessions || 0}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Mastered Topics Checklist Card */}
              <Card className="flex-1 bg-card/40 backdrop-blur-xl border-border/40 rounded-[24px] p-6 shadow-sm relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Study Topics
                    </h4>
                    
                    <Link href={`/resources?subject=${encodeURIComponent(nearestExam.title)}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {nearestMastery.length === 0 ? (
                      <div className="p-4 bg-muted/20 rounded-xl border border-dashed border-border/50 text-xs font-bold text-muted-foreground italic text-center py-6">
                        No custom study topics tracked yet.
                      </div>
                    ) : (
                      nearestMastery.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/30 border border-border/30 rounded-xl">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300", 
                            item.isCompleted 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
                              : "bg-muted text-muted-foreground border-border"
                          )}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">{item.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>
      ) : (
        <Card className="h-[320px] flex flex-col items-center justify-center bg-card/40 backdrop-blur-xl border border-dashed border-border rounded-[32px] p-8 space-y-6 text-center shadow-md relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5" />
           <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-inner relative z-10">
              <CalendarIcon className="w-8 h-8 text-primary" />
           </div>
           <div className="space-y-2 relative z-10 max-w-md">
              <h2 className="text-2xl font-heading font-black tracking-tight text-foreground uppercase">No Exams Scheduled</h2>
              <p className="text-muted-foreground font-semibold text-sm leading-relaxed">Your exam schedule is currently clear. Click below to add your first assessment.</p>
           </div>
           <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
              <UploadTimetableDialog />
              <ExamsClient events={events} />
           </div>
        </Card>
      )}

      {/* Future scheduled exams pipeline list */}
      {upcomingExams.length > 1 && (
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <h3 className="text-2xl font-heading font-black tracking-tight uppercase flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" /> Future Assessments
            </h3>
            <div className="px-3.5 py-1 bg-muted rounded-full text-[9px] font-black uppercase tracking-wider text-muted-foreground border">
              {upcomingExams.length - 1} Scheduled
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {upcomingExams.slice(1).map((exam) => {
              const days = differenceInDays(new Date(exam.date), now);
              const isCritical = exam.priority === 'HIGH';
              
              return (
                <Card 
                  key={exam.id} 
                  className={cn(
                    "group relative bg-card/45 backdrop-blur-md border border-border/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[200px]"
                  )}
                >
                  {/* Whole-card link to exam detail (siblings stay clickable via higher z-index) */}
                  <Link
                    href={`/exams/${exam.id}`}
                    aria-label={`View prep for ${exam.title}`}
                    className="absolute inset-0 z-10 rounded-2xl"
                  />

                  {/* Delete Trigger */}
                  <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <DeleteExamButton id={exam.id} />
                  </div>

                  <div className="space-y-5 relative z-0 pointer-events-none">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-2 h-2 rounded-full border border-black/10",
                        isCritical ? "bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" : "bg-primary"
                      )} />
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                        {format(new Date(exam.date), 'MMMM dd, yyyy')}
                      </span>
                    </div>

                    <h4 className="text-xl font-heading font-black text-foreground group-hover:text-primary transition-colors line-clamp-2 pr-6 uppercase leading-tight">
                      {exam.title}
                    </h4>
                  </div>

                  <div className="flex items-end justify-between border-t border-border/40 pt-4 mt-6">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">Countdown</p>
                      <p className="text-2xl font-heading font-black text-foreground leading-none">
                        {days} <span className="text-xs font-semibold text-muted-foreground uppercase tracking-normal">Days</span>
                      </p>
                    </div>
                    
                    <Link href={`/focus?subject=${encodeURIComponent(exam.title)}`} className="relative z-20" title="Start revision session">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-10 h-10 rounded-xl border transition-all duration-300 cursor-pointer",
                          isCritical
                            ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                            : "bg-muted/60 border-border/60 text-foreground hover:bg-primary hover:text-primary-foreground"
                        )}
                      >
                        <Brain className="w-4.5 h-4.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Historical past exams list */}
      {pastExams.length > 0 && (
        <section className="space-y-6 pt-6 border-t border-border/40">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-xl font-heading font-black tracking-tight text-muted-foreground uppercase tracking-wider">
              Completed Milestones
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pastExams.slice(0, 8).map((exam) => (
              <Link
                href={`/exams/${exam.id}`}
                key={exam.id}
                className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-xl grayscale opacity-70 hover:grayscale-0 hover:opacity-100 hover:bg-card hover:border-emerald-500/20 transition-all duration-300 group"
              >
                <div className="overflow-hidden pr-3 space-y-0.5">
                  <p className="text-sm font-bold text-foreground truncate pr-2 group-hover:text-emerald-500 transition-colors uppercase">
                    {exam.title}
                  </p>
                  <p className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">
                    Completed {format(new Date(exam.date), 'MMM yyyy')}
                  </p>
                </div>
                
                <div className="w-8 h-8 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 group-hover:text-emerald-500 transition-all duration-300">
                  <Award className="w-4.5 h-4.5 text-muted-foreground group-hover:text-emerald-500" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
