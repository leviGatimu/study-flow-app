import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Brain, CalendarDays, CheckCircle2, CircleDashed, FolderOpen, ListChecks, Target, Timer, XCircle } from 'lucide-react';

import { getCurrentUserTimezone, getEventById, getEvents, getSubjectStats, getMasteryItems, getSubjectSessions } from '@/lib/actions';
import { categoryNames, normaliseCategory } from '@/lib/exam-category';
import { examStatus, examDaysAway, examTimeLabel } from '@/lib/exam-time';
import { ExamStatusRefresh } from '@/components/ExamStatusRefresh';
import { EditExamButton } from '@/components/ExamTimingForm';
import { getExamWithPrep } from '@/lib/exam-actions';
import { getUserId } from '@/lib/auth';
import { MasteryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { ExamPlanner } from '@/components/ExamPlanner';
import { DeleteExamButton } from '@/components/ExamsClient';
import { MasteryList } from '@/components/MasteryList';
import { AddMasteryForm } from '@/components/AddMasteryForm';

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

  const [stats, masteryItems, sessions, prep, allExams] = await Promise.all([
    subject ? getSubjectStats(subject) : null,
    subject ? getMasteryItems(subject) : [],
    subject ? getSubjectSessions(subject) : [],
    getExamWithPrep(examId),
    getEvents(),
  ]);
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

  return (
    <Page>
      <ExamStatusRefresh exams={[exam]} timezone={timezone} renderedAt={now.toISOString()} />
      <PageHeader
        back={{ href: '/exams', label: 'All exams' }}
        title={<span className="break-words">{exam.title}</span>}
        highlight={
          isPast
            ? { label: 'Result', value: percent !== null ? `${percent}%` : 'Marks pending' }
            : {
                label: 'Time left',
                value: status === 'IN_PROGRESS' ? 'In progress' : daysRemaining === 0 ? 'Today' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
              }
        }
        description={[category, format(examDate, 'EEEE d MMMM yyyy'), examTimeLabel(exam)].filter(Boolean).join(' · ')}
        meta={
          exam.priority === 'HIGH' ? <Pill tone="danger">High priority</Pill> : exam.priority === 'LOW' ? <Pill>Low priority</Pill> : undefined
        }
      />

      <PageBody className="space-y-6 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {encoded && !isPast && (
            <Button asChild>
              <Link href={`/ai/practices?subject=${encoded}`}>
                <Brain /> Practice
              </Link>
            </Button>
          )}
          {!isPast && (
            <Button asChild variant="outline">
              <Link href={encoded ? `/focus?subject=${encoded}` : '/focus'}>
                <Timer /> Focus
              </Link>
            </Button>
          )}
          {encoded && (
            <Button asChild variant="outline">
              <Link href={`/resources/${encoded}`}>
                <FolderOpen /> Resources
              </Link>
            </Button>
          )}
          <EditExamButton exam={exam} timezone={timezone} categories={categoryNames(allExams)} />
          <div className="ml-auto">
            <DeleteExamButton id={exam.id} title={exam.title} redirectTo="/exams" withLabel />
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
            {planner && <ExamPlanner {...planner} show="prepare" />}

            <Panel>
              <PanelTitle
                icon={<ListChecks />}
                action={topicsTotal > 0 && <Pill tone={topicsDone === topicsTotal ? 'success' : 'default'}>{topicsDone}/{topicsTotal} mastered</Pill>}
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
                  title="Link a subject first"
                  description="Topics belong to a subject's syllabus. Link this exam to its subject and its topics appear here."
                />
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-5 xl:col-span-4">
            {planner && <ExamPlanner {...planner} show="result" />}

            {subject && (
              <Panel>
                <PanelTitle icon={<Target />}>Your preparation</PanelTitle>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Study sessions done</span>
                    <span className="font-heading text-lg font-bold tabular-nums text-foreground">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                </div>
                <dl className="mt-3 divide-y divide-border/60 text-sm">
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Focus time</dt>
                    <dd className="font-medium tabular-nums">{stats?.timeSpent || '0m'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Average session</dt>
                    <dd className="font-medium tabular-nums">{stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Sessions</dt>
                    <dd className="font-medium tabular-nums">{stats?.completedSessions || 0} of {stats?.totalSessions || 0}</dd>
                  </div>
                </dl>
              </Panel>
            )}

            {subject && (
              <Panel>
                <PanelTitle icon={<CalendarDays />} action={sessions.length > 0 && <Pill>{sessions.length}</Pill>}>
                  Recent sessions
                </PanelTitle>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Blocks on your schedule for {subject} show here, done or missed.</p>
                ) : (
                  <ul className="divide-y divide-border/60 text-sm">
                    {sessions.slice(0, SESSIONS_SHOWN).map((s) => (
                      <li key={s.id} className="flex items-center gap-2.5 py-2">
                        {s.isDone ? (
                          <CheckCircle2 aria-label="Done" className="size-4 shrink-0 text-success" />
                        ) : s.isMissed ? (
                          <XCircle aria-label="Missed" className="size-4 shrink-0 text-destructive" />
                        ) : (
                          <CircleDashed aria-label="Still to do" className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{format(new Date(s.date), 'EEE d MMM')}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{s.startTime}–{s.endTime}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sessions.length > SESSIONS_SHOWN && (
                  <Link href={`/subjects?subject=${encoded}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                    See all {sessions.length} in {subject}
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
