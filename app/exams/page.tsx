import { getEvents, syncStreak, getSubjectStats, getMasteryItems } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, differenceInDays, isAfter, startOfDay } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Flame,
  Brain,
  ChevronRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  History,
  LayoutGrid,
  Award,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ExamsClient, DeleteExamButton } from '@/components/ExamsClient';
import { UploadTimetableDialog } from '@/components/UploadTimetableDialog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function priorityLabel(priority: string) {
  return priority === 'HIGH' ? 'High priority' : priority === 'LOW' ? 'Low priority' : 'Normal priority';
}

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
  // See the note in [examId]/page.tsx: the exam's TITLE is not its subject.
  const nearestSubject = nearestExam
    ? ((nearestExam as any).subject?.name ?? nearestExam.title)
    : null;
  const [nearestStats, nearestMastery] = nearestExam
    ? await Promise.all([getSubjectStats(nearestSubject!), getMasteryItems(nearestSubject!)])
    : [null, []];

  const daysRemaining = nearestExam ? differenceInDays(new Date(nearestExam.date), now) : 0;

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Assessments</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Track your upcoming exam dates, monitor preparation levels, and plan study focuses to stay prepared.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <UploadTimetableDialog />
          <ExamsClient events={events} />

          <div className="h-11 px-5 bg-card border border-border/60 shadow-sm rounded-xl flex items-center gap-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Study streak</p>
              <p className="text-base font-heading font-bold text-foreground leading-none">{streakData?.currentStreak || 0} days</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 space-y-8">
        {/* Main upcoming target section */}
        {nearestExam ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">Next Upcoming Exam</h2>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Main Hero Card displaying closest exam */}
              <div className="xl:col-span-8">
                <div className="h-full bg-card border border-border/60 shadow-sm rounded-2xl p-8 md:p-10">
                  <div className="flex flex-col md:flex-row h-full items-center md:items-stretch justify-between gap-8 md:gap-12">

                    {/* Left: Info details */}
                    <div className="flex flex-col justify-between flex-1 gap-8 text-center md:text-left">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border",
                            nearestExam.priority === 'HIGH'
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {priorityLabel(nearestExam.priority)}
                          </span>

                          <span className="flex items-center gap-2 text-muted-foreground text-xs font-medium bg-muted/40 px-3 py-1 rounded-full border border-border/40">
                            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                            {format(new Date(nearestExam.date), 'EEEE, MMMM do')}
                          </span>
                        </div>

                        <Link href={`/exams/${nearestExam.id}`} className="group/title inline-block">
                          <h3 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-foreground leading-tight line-clamp-2 group-hover/title:text-primary transition-colors">
                            {nearestExam.title}
                          </h3>
                        </Link>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center md:justify-start w-full gap-3">
                        <Link href={`/focus?subject=${encodeURIComponent(nearestExam.title)}`} className="w-full sm:max-w-xs">
                          <Button className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-sm gap-2 shadow-sm transition-all cursor-pointer">
                            <Brain className="w-4 h-4" />
                            Start revision session
                            <ArrowUpRight className="w-4 h-4 opacity-75" />
                          </Button>
                        </Link>
                        <Link href={`/exams/${nearestExam.id}`} className="w-full sm:w-auto">
                          <Button variant="outline" className="w-full h-12 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
                            View full prep <ArrowUpRight className="w-4 h-4 opacity-75" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Right: countdown */}
                    <div className="flex flex-col items-center justify-center shrink-0 w-60 md:w-64 bg-muted/30 border border-border/40 rounded-2xl p-6">
                      <span className="text-xs font-medium text-muted-foreground mb-2">
                        {format(new Date(nearestExam.date), 'MMM d, yyyy')}
                      </span>

                      <div className="text-center space-y-1">
                        <span className="text-4xl font-heading font-black tracking-tight text-foreground block">
                          {daysRemaining === 0 ? "Today" : daysRemaining === 1 ? "1 day" : `${daysRemaining} days`}
                        </span>
                        {daysRemaining > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">Remaining</span>
                        )}
                      </div>

                      <div className="w-full mt-6">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              daysRemaining <= 3 ? "bg-destructive" : daysRemaining <= 7 ? "bg-orange-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.max(0, Math.min(100, (1 - daysRemaining / 30) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Preparation stats cards */}
              <div className="xl:col-span-4 flex flex-col gap-6">
                {/* Readiness Card */}
                <div className="flex-1 bg-card border border-border/60 shadow-sm rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" /> Subject Readiness
                  </h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Completion</span>
                    <span className="text-2xl font-heading font-bold text-primary">{nearestStats?.completionRate || 0}%</span>
                  </div>

                  <Progress value={nearestStats?.completionRate || 0} className="h-2 bg-muted rounded-full" />

                  <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-border/40">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary/60" /> Focus time
                      </p>
                      <p className="text-xl font-heading font-bold text-foreground leading-none">{nearestStats?.timeSpent || '0m'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary/60" /> Sessions
                      </p>
                      <p className="text-xl font-heading font-bold text-foreground leading-none">{nearestStats?.completedSessions || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Mastered Topics Checklist Card */}
                <div className="flex-1 bg-card border border-border/60 shadow-sm rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" /> Study Topics
                    </h3>

                    <Link href={`/resources?subject=${encodeURIComponent(nearestExam.title)}`} aria-label="View all study topics">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {nearestMastery.length === 0 ? (
                      <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                        No study topics tracked yet. Add topics from the exam page to build your syllabus.
                      </p>
                    ) : (
                      nearestMastery.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/30 border border-border/40 rounded-xl">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border",
                            item.isCompleted
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border"
                          )}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center bg-card border border-border/60 shadow-sm rounded-2xl p-10 space-y-5 text-center">
            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">No Exams Scheduled</h2>
              <p className="text-sm text-muted-foreground">Your exam schedule is currently clear. Add your first assessment below.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <UploadTimetableDialog />
              <ExamsClient events={events} />
            </div>
          </div>
        )}

        {/* Future scheduled exams pipeline list */}
        {upcomingExams.length > 1 && (
          <section className="space-y-6 pt-2">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-primary" /> Future Assessments
              </h2>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border/40">
                {upcomingExams.length - 1} scheduled
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {upcomingExams.slice(1).map((exam) => {
                const days = differenceInDays(new Date(exam.date), now);
                const isCritical = exam.priority === 'HIGH';

                return (
                  <div
                    key={exam.id}
                    className="group relative bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]"
                  >
                    {/* Whole-card link to exam detail (siblings stay clickable via higher z-index) */}
                    <Link
                      href={`/exams/${exam.id}`}
                      aria-label={`View prep for ${exam.title}`}
                      className="absolute inset-0 z-10 rounded-2xl"
                    />

                    {/* Delete Trigger */}
                    <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <DeleteExamButton id={exam.id} />
                    </div>

                    <div className="space-y-4 relative z-0 pointer-events-none">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isCritical ? "bg-destructive" : "bg-primary"
                        )} />
                        <span className="text-xs font-medium text-muted-foreground">
                          {format(new Date(exam.date), 'MMMM d, yyyy')}
                        </span>
                      </div>

                      <h3 className="text-xl font-heading font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 pr-6 leading-tight">
                        {exam.title}
                      </h3>
                    </div>

                    <div className="flex items-end justify-between border-t border-border/40 pt-4 mt-6">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">Countdown</p>
                        <p className="text-2xl font-heading font-bold text-foreground leading-none">
                          {days} <span className="text-xs font-medium text-muted-foreground">days</span>
                        </p>
                      </div>

                      <Link href={`/focus?subject=${encodeURIComponent(exam.title)}`} className="relative z-20" aria-label={`Start revision session for ${exam.title}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "w-10 h-10 rounded-xl border transition-colors cursor-pointer",
                            isCritical
                              ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-white"
                              : "bg-muted/60 border-border/60 text-foreground hover:bg-primary hover:text-primary-foreground"
                          )}
                        >
                          <Brain className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Historical past exams list */}
        {pastExams.length > 0 && (
          <section className="space-y-6 pt-6 border-t border-border/40">
            <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              Completed Milestones
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pastExams.slice(0, 8).map((exam) => (
                <Link
                  href={`/exams/${exam.id}`}
                  key={exam.id}
                  className="flex items-center justify-between p-4 bg-muted/30 border border-border/40 rounded-xl hover:bg-card hover:border-primary/20 transition-colors group"
                >
                  <div className="overflow-hidden pr-3 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground truncate pr-2 group-hover:text-primary transition-colors">
                      {exam.title}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Completed {format(new Date(exam.date), 'MMM yyyy')}
                    </p>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                    <Award className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
