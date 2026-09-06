import { getEventById, getSubjectStats, getMasteryItems, getSubjectSessions } from '@/lib/actions';
import { getExamWithPrep } from '@/lib/exam-actions';
import { ExamPlanner } from '@/components/ExamPlanner';
import { getUserId } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInDays, startOfDay } from 'date-fns';
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  Target,
  BarChart3,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Brain,
  Sparkles,
  BookOpen,
  ListChecks,
  ArrowUpRight,
  Hourglass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MasteryList } from '@/components/MasteryList';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { MasteryItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function priorityLabel(priority: string) {
  return priority === 'HIGH' ? 'High priority' : priority === 'LOW' ? 'Low priority' : 'Normal priority';
}

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { examId } = await params;
  const exam = await getEventById(examId);
  if (!exam) notFound();

  // The subject this exam assesses. Until Phase 5 this was exam.title, so
  // "Physics MID-TERM" looked up a subject that does not exist and every
  // preparation panel below silently showed zeroes.
  const subjectKey = exam.subject?.name ?? exam.title;

  const [stats, masteryItems, sessions, prep] = await Promise.all([
    getSubjectStats(subjectKey),
    getMasteryItems(subjectKey),
    getSubjectSessions(subjectKey),
    getExamWithPrep(examId),
  ]);

  const now = startOfDay(new Date());
  const examDate = startOfDay(new Date(exam.date));
  const daysRemaining = differenceInDays(examDate, now);
  const isPast = daysRemaining < 0;

  const completionRate = stats?.completionRate ?? 0;
  const topicsTotal = masteryItems.length;
  const topicsDone = masteryItems.filter((m) => m.isCompleted).length;
  const topicsPct = topicsTotal > 0 ? Math.round((topicsDone / topicsTotal) * 100) : 0;

  const countdownLabel = isPast
    ? 'Completed'
    : daysRemaining === 0
      ? 'Today'
      : daysRemaining === 1
        ? '1 day'
        : `${daysRemaining} days`;

  return (
    <>
      {prep && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-6">
          <ExamPlanner
            examId={examId}
            subjectId={prep.exam.subjectId}
            subjectName={prep.exam.subject?.name ?? null}
            subjects={prep.subjects}
            revisionTasks={prep.exam.revisionTasks}
            score={prep.exam.score}
            maxScore={prep.exam.maxScore}
            isPast={isPast}
          />
        </div>
      )}
      <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto px-4 md:px-8 pb-16 animate-in fade-in duration-500">

        {/* Header */}
        <header className="space-y-6 border-b border-border/40 pb-8 pt-6">
          <Link
            href="/exams"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to assessments
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border',
                    exam.priority === 'HIGH'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-primary/10 text-primary border-primary/20'
                  )}
                >
                  {priorityLabel(exam.priority)}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground text-xs font-medium bg-muted/40 px-3 py-1 rounded-full border border-border/40">
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                  {format(examDate, 'EEEE, MMMM do, yyyy')}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight text-foreground leading-tight">
                {exam.title}
              </h1>
            </div>

            {/* Countdown badge */}
            <div className="flex flex-col items-center justify-center shrink-0 w-48 bg-card border border-border/60 shadow-sm rounded-2xl p-6">
              <Hourglass className={cn('w-6 h-6 mb-2', isPast ? 'text-muted-foreground' : daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-orange-500' : 'text-primary')} />
              <span className="text-4xl font-heading font-black tracking-tight text-foreground leading-none">
                {countdownLabel}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-2">
                {isPast ? 'Past exam' : 'Remaining'}
              </span>
            </div>
          </div>

          {/* Quick CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/focus?subject=${encodeURIComponent(exam.title)}`}>
              <Button className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-sm gap-2 shadow-sm transition-all cursor-pointer">
                <Brain className="w-4 h-4" /> Start revision session <ArrowUpRight className="w-4 h-4 opacity-70" />
              </Button>
            </Link>
            <Link href={`/resources/${encodeURIComponent(exam.title)}`}>
              <Button variant="outline" className="h-11 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
                <BookOpen className="w-4 h-4" /> Resources
              </Button>
            </Link>
            <Link href={`/studio/${encodeURIComponent(exam.title)}`}>
              <Button variant="outline" className="h-11 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
                <Sparkles className="w-4 h-4 text-primary" /> Deep work studio
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: readiness + sessions */}
          <div className="xl:col-span-7 space-y-6">
            {/* Readiness */}
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Exam Readiness
                </h2>
                <span className="text-2xl font-heading font-bold text-primary">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2.5 bg-muted rounded-full" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 mt-2">
                <StatMini label="Focus time" value={stats?.timeSpent || '0m'} icon={<Clock className="w-4 h-4 text-primary" />} />
                <StatMini label="Sessions done" value={`${stats?.completedSessions || 0}/${stats?.totalSessions || 0}`} icon={<CheckCircle2 className="w-4 h-4 text-success" />} />
                <StatMini
                  label="Avg. session"
                  value={stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                  icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
                />
                <StatMini label="Topics" value={`${topicsDone}/${topicsTotal}`} icon={<ListChecks className="w-4 h-4 text-orange-500" />} />
              </div>
            </div>

            {/* Session log */}
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-primary" /> Session Log
                <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border/40">
                  {sessions.length}
                </span>
              </h2>

              {sessions.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                  No study sessions logged for this subject yet. Start a revision session to build momentum.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((s) => {
                    const status = s.isDone ? 'done' : s.isMissed ? 'missed' : 'pending';
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {status === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          ) : status === 'missed' ? (
                            <XCircle className="w-5 h-5 text-destructive shrink-0" />
                          ) : (
                            <CircleDashed className="w-5 h-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{s.subject}</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {format(new Date(s.date), 'EEE, MMM d')} · {s.startTime}–{s.endTime}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-medium px-3 py-1 rounded-full border shrink-0',
                            status === 'done'
                              ? 'bg-success/10 text-success border-success/20'
                              : status === 'missed'
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : 'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          {status === 'done' ? 'Done' : status === 'missed' ? 'Missed' : s.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: topics to cover */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-orange-500" /> Topics to Cover
                </h2>
                <span className="text-sm font-medium text-muted-foreground">
                  {topicsDone}/{topicsTotal} · {topicsPct}%
                </span>
              </div>

              {topicsTotal > 0 && <Progress value={topicsPct} className="h-2 bg-muted rounded-full mb-4" />}

              <div className="space-y-4">
                <AddMasteryForm subject={subjectKey} />
                <MasteryList items={masteryItems as MasteryItem[]} subject={subjectKey} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatMini({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <p className="text-xl font-heading font-bold text-foreground leading-none">{value}</p>
    </div>
  );
}
