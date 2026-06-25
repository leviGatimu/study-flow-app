import { getEventById, getSubjectStats, getMasteryItems, getSubjectSessions } from '@/lib/actions';
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
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MasteryList } from '@/components/MasteryList';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { MasteryItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { examId } = await params;
  const exam = await getEventById(examId);
  if (!exam) notFound();

  const [stats, masteryItems, sessions] = await Promise.all([
    getSubjectStats(exam.title),
    getMasteryItems(exam.title),
    getSubjectSessions(exam.title),
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
        ? '1 Day'
        : `${daysRemaining} Days`;

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-12 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-32">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="space-y-6 border-b border-border/40 pb-10">
        <Link
          href="/exams"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Back to Assessments
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none',
                  exam.priority === 'HIGH'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                )}
              >
                {exam.priority} Priority
              </span>
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-wider bg-muted/30 px-3 py-1 rounded-full border border-border/40 leading-none">
                <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                {format(examDate, 'EEEE, MMMM do, yyyy')}
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tight text-foreground uppercase leading-none">
              {exam.title}
            </h1>
          </div>

          {/* Countdown badge */}
          <div className="flex flex-col items-center justify-center shrink-0 w-48 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <Hourglass className={cn('w-6 h-6 mb-2', isPast ? 'text-muted-foreground' : daysRemaining <= 3 ? 'text-red-500' : daysRemaining <= 7 ? 'text-orange-500' : 'text-primary')} />
            <span className="text-4xl font-heading font-black tracking-tighter text-foreground leading-none">
              {countdownLabel}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">
              {isPast ? 'Past Exam' : 'Remaining'}
            </span>
          </div>
        </div>

        {/* Quick CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/focus?subject=${encodeURIComponent(exam.title)}`}>
            <Button className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-sm gap-2 shadow-md shadow-primary/10 transition-all cursor-pointer">
              <Brain className="w-4 h-4" /> Start Revision Session <ArrowUpRight className="w-4 h-4 opacity-70" />
            </Button>
          </Link>
          <Link href={`/resources/${encodeURIComponent(exam.title)}`}>
            <Button variant="outline" className="h-11 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
              <BookOpen className="w-4 h-4" /> Resources
            </Button>
          </Link>
          <Link href={`/studio/${encodeURIComponent(exam.title)}`}>
            <Button variant="outline" className="h-11 px-6 rounded-xl font-bold text-sm gap-2 cursor-pointer">
              <Sparkles className="w-4 h-4 text-primary" /> Deep Work Studio
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left: readiness + sessions */}
        <div className="xl:col-span-7 space-y-8">
          {/* Readiness */}
          <Card className="bg-card border border-border/60 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-heading font-black uppercase tracking-tight flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Exam Readiness
                </h2>
                <span className="text-3xl font-heading font-black text-primary">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2.5 bg-muted rounded-full" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <StatMini label="Focus Time" value={stats?.timeSpent || '0m'} icon={<Clock className="w-4 h-4 text-primary" />} />
                <StatMini label="Sessions Done" value={`${stats?.completedSessions || 0}/${stats?.totalSessions || 0}`} icon={<CheckCircle2 className="w-4 h-4 text-success" />} />
                <StatMini
                  label="Avg. Session"
                  value={stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                  icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
                />
                <StatMini label="Topics" value={`${topicsDone}/${topicsTotal}`} icon={<ListChecks className="w-4 h-4 text-orange-500" />} />
              </div>
            </div>
          </Card>

          {/* Session log */}
          <Card className="bg-card border border-border/60 rounded-[32px] p-8 shadow-sm">
            <h2 className="text-xl font-heading font-black uppercase tracking-tight flex items-center gap-2 mb-6">
              <CalendarIcon className="w-5 h-5 text-primary" /> Session Log
              <span className="text-[10px] font-black bg-muted text-muted-foreground px-2.5 py-1 rounded-full border ml-1">
                {sessions.length}
              </span>
            </h2>

            {sessions.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground italic text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                No study sessions logged for this subject yet. Start a revision session to build momentum.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((s) => {
                  const status = s.isDone ? 'done' : s.isMissed ? 'missed' : 'pending';
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40"
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
                          <p className="font-bold text-foreground text-sm truncate">{s.subject}</p>
                          <p className="text-[11px] font-bold text-muted-foreground">
                            {format(new Date(s.date), 'EEE, MMM d')} · {s.startTime}–{s.endTime}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shrink-0',
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
          </Card>
        </div>

        {/* Right: topics to cover */}
        <div className="xl:col-span-5 space-y-8">
          <Card className="bg-card border border-border/60 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-heading font-black uppercase tracking-tight flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-orange-500" /> Topics to Cover
                </h2>
                <span className="text-sm font-black text-muted-foreground">
                  {topicsDone}/{topicsTotal} · {topicsPct}%
                </span>
              </div>

              {topicsTotal > 0 && <Progress value={topicsPct} className="h-2 bg-muted rounded-full" />}

              <AddMasteryForm subject={exam.title} />

              <MasteryList items={masteryItems as MasteryItem[]} subject={exam.title} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <p className="text-xl font-heading font-black text-foreground leading-none">{value}</p>
    </div>
  );
}
