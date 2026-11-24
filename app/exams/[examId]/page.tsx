import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Brain,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock,
  FolderOpen,
  ListChecks,
  Target,
  Timer,
  XCircle,
} from 'lucide-react';

import { getCurrentUserTimezone, getEventById, getEvents, getSubjectStats, getMasteryItems, getSubjectSessions } from '@/lib/actions';
import { categoryHref, categoryNames, normaliseCategory } from '@/lib/exam-category';
import { examStatus, examDaysAway, examTimeLabel } from '@/lib/exam-time';
import { ExamStatusRefresh } from '@/components/ExamStatusRefresh';
import { EditExamButton } from '@/components/ExamTimingForm';
import { getExamWithPrep } from '@/lib/exam-actions';
import { getUserId } from '@/lib/auth';
import { MasteryItem } from '@/lib/types';
import { Page, PageBody } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { ExamPlanner } from '@/components/ExamPlanner';
import { DeleteExamButton } from '@/components/ExamsClient';
import { MasteryList } from '@/components/MasteryList';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { ExamGoalPanel } from '@/components/marks/ExamGoalPanel';
import { ExamDetailHero, GLASS_BUTTON, MiniStat, WHITE_BUTTON } from '@/components/exams/exam-ui';
import { loadSubjectProgress } from '@/lib/subject-progress-data';
import { progressKey } from '@/lib/subject-progress';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SESSIONS_SHOWN = 6;

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { examId } = await params;
  const exam = await getEventById(examId);
  if (!exam) notFound();

  // The subject this exam assesses - never its title. Treating "Physics
  // MID-TERM" as a subject showed zeroes everywhere and, through the links
  // and the topic form, created subjects that do not exist. An exam with no
  // subject linked yet shows the link form (in ExamPlanner) and nothing that
  // would need one.
  const subject = exam.subject?.name ?? null;

  const [stats, masteryItems, sessions, prep, allExams, progress] = await Promise.all([
    subject ? getSubjectStats(subject) : null,
    subject ? getMasteryItems(subject) : [],
    subject ? getSubjectSessions(subject) : [],
    getExamWithPrep(examId),
    getEvents(),
    subject ? loadSubjectProgress() : [],
  ]);
  const subjectProgress = subject ? progress.find((p) => progressKey(p.subject) === progressKey(subject)) : undefined;
  const category = normaliseCategory(exam.category);

  const timezone = await getCurrentUserTimezone();
  const now = new Date();
  const examDate = new Date(exam.date);
  const daysRemaining = examDaysAway(exam, timezone, now);
  const status = examStatus(exam, timezone, now);
  const isPast = status === 'DONE';

  const completionRate = stats?.completionRate ?? 0;
  const topicsTotal = masteryItems.length;
  const topicsDone = masteryItems.filter((m) => m.isCompleted).length;
  const encoded = subject ? encodeURIComponent(subject) : null;
  const percent = exam.score !== null && exam.maxScore ? Math.round((exam.score / exam.maxScore) * 100) : null;

  const planner = prep && {
    examId,
    subjectId: prep.exam.subjectId,
    subjectName: prep.exam.subject?.name ?? null,
    subjects: prep.subjects,
    revisionTasks: prep.exam.revisionTasks,
    score: prep.exam.score,
    maxScore: prep.exam.maxScore,
    isPast,
  };

  const back = category ? { href: categoryHref(category), label: category } : { href: '/exams', label: 'All exams' };

  return (
    <Page>
      <ExamStatusRefresh exams={[exam]} timezone={timezone} renderedAt={now.toISOString()} />

      <PageBody className="space-y-6 pt-6">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>

        <ExamDetailHero
          exam={{
            title: exam.title,
            subject,
            category,
            date: format(examDate, 'EEEE d MMMM yyyy'),
            time: examTimeLabel(exam),
            priority: exam.priority,
            days: daysRemaining,
            status: status === 'DONE' ? 'DONE' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'UPCOMING',
            percent,
          }}
          actions={
            <>
              {encoded && !isPast && (
                <Link href={`/ai/practices?subject=${encoded}`} className={WHITE_BUTTON}>
                  <Brain /> Practice
                </Link>
              )}
              {!isPast && (
                <Link href={encoded ? `/focus?subject=${encoded}` : '/focus'} className={GLASS_BUTTON}>
                  <Timer /> Focus
                </Link>
              )}
              {encoded && (
                <Link href={`/resources/${encoded}`} className={GLASS_BUTTON}>
                  <FolderOpen /> Resources
                </Link>
              )}
              <EditExamButton exam={exam} timezone={timezone} categories={categoryNames(allExams)} className={GLASS_BUTTON} />
              <DeleteExamButton
                id={exam.id}
                title={exam.title}
                redirectTo="/exams"
                withLabel
                className={cn(GLASS_BUTTON, 'border-transparent bg-transparent text-white/80 hover:bg-red-500/30 hover:text-white dark:bg-transparent')}
              />
            </>
          }
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="stagger-in min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
            {planner && <ExamPlanner {...planner} show="prepare" />}

            <Panel className="rounded-3xl">
              <PanelTitle
                tone="sky"
                icon={<ListChecks />}
                action={
                  topicsTotal > 0 && (
                    <Pill tone={topicsDone === topicsTotal ? 'success' : 'default'}>
                      {topicsDone}/{topicsTotal} mastered
                    </Pill>
                  )
                }
              >
                Topics to cover
              </PanelTitle>
              {subject ? (
                <div className="space-y-3">
                  {topicsTotal > 0 && <Progress value={Math.round((topicsDone / topicsTotal) * 100)} className="h-2" />}
                  <AddMasteryForm subject={subject} />
                  <MasteryList items={masteryItems as MasteryItem[]} subject={subject} />
                </div>
              ) : (
                <EmptyState
                  icon={<ListChecks />}
                  title="Link a subject first"
                  description="Topics belong to a subject's syllabus. Link this exam to its subject and its topics appear here."
                />
              )}
            </Panel>
          </div>

          <div className="stagger-in min-w-0 space-y-6 lg:col-span-5 xl:col-span-4">
            {planner && <ExamPlanner {...planner} show="result" />}

            {subjectProgress && <ExamGoalPanel progress={subjectProgress} />}

            {subject && (
              <Panel className="rounded-3xl">
                <PanelTitle tone="primary" icon={<Target />}>
                  Your preparation
                </PanelTitle>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat icon={<CheckCircle2 />} tone="emerald" label="Study sessions done" value={`${completionRate}%`}>
                    <Progress value={completionRate} className="mt-3 h-1.5" />
                  </MiniStat>
                  <MiniStat icon={<Clock />} tone="sky" label="Focus time" value={stats?.timeSpent || '0m'} />
                  <MiniStat
                    icon={<Timer />}
                    tone="amber"
                    label="Average session"
                    value={stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                  />
                  <MiniStat
                    icon={<CalendarCheck />}
                    tone="violet"
                    label="Sessions"
                    value={`${stats?.completedSessions || 0} of ${stats?.totalSessions || 0}`}
                  />
                </div>
              </Panel>
            )}

            {subject && (
              <Panel className="rounded-3xl">
                <PanelTitle tone="rose" icon={<CalendarDays />} action={sessions.length > 0 && <Pill>{sessions.length}</Pill>}>
                  Recent sessions
                </PanelTitle>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Blocks on your schedule for {subject} show here, done or missed.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {sessions.slice(0, SESSIONS_SHOWN).map((s) => {
                      const look = s.isDone
                        ? { icon: CheckCircle2, label: 'Done', tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
                        : s.isMissed
                          ? { icon: XCircle, label: 'Missed', tile: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' }
                          : { icon: CircleDashed, label: 'Still to do', tile: 'bg-muted text-muted-foreground' };
                      const Icon = look.icon;
                      return (
                        <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/50">
                          <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', look.tile)}>
                            <Icon aria-label={look.label} className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{format(new Date(s.date), 'EEE d MMM')}</span>
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                            {s.startTime}–{s.endTime}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {sessions.length > SESSIONS_SHOWN && (
                  <Link
                    href={`/subjects?subject=${encoded}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    See all {sessions.length} in {subject}
                    <ChevronRight className="size-4" />
                  </Link>
                )}
              </Panel>
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
