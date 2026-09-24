import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import {
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  FolderOpen,
  ListChecks,
  Target,
  Timer,
  XCircle,
} from 'lucide-react';

import { getEventById, getSubjectStats, getMasteryItems, getSubjectSessions } from '@/lib/actions';
import { getExamWithPrep } from '@/lib/exam-actions';
import { getUserId } from '@/lib/auth';
import { MasteryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { ExamPlanner } from '@/components/ExamPlanner';
import { DeleteExamButton } from '@/components/ExamsClient';
import { MasteryList } from '@/components/MasteryList';
import { AddMasteryForm } from '@/components/AddMasteryForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const [stats, masteryItems, sessions, prep] = await Promise.all([
    subject ? getSubjectStats(subject) : null,
    subject ? getMasteryItems(subject) : [],
    subject ? getSubjectSessions(subject) : [],
    getExamWithPrep(examId),
  ]);

  const today = startOfDay(new Date());
  const examDate = startOfDay(new Date(exam.date));
  const daysRemaining = differenceInCalendarDays(examDate, today);
  const isPast = daysRemaining < 0;

  const completionRate = stats?.completionRate ?? 0;
  const topicsTotal = masteryItems.length;
  const topicsDone = masteryItems.filter((m) => m.isCompleted).length;
  const encoded = subject ? encodeURIComponent(subject) : null;

  return (
    <Page>
      <PageHeader
        back={{ href: "/exams", label: "All exams" }}
        title={exam.title}
        highlight={
          isPast
            ? { label: "Exam", value: "Finished" }
            : {
                label: "Time left",
                value: daysRemaining === 0 ? "Today" : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`,
              }
        }
        description={[format(examDate, 'EEEE d MMMM yyyy'), subject].filter(Boolean).join(' · ')}
        meta={
          exam.priority === 'HIGH' ? (
            <Pill tone="danger">High priority</Pill>
          ) : exam.priority === 'LOW' ? (
            <Pill>Low priority</Pill>
          ) : undefined
        }
        actions={
          <>
            {encoded && !isPast && (
              <Button asChild size="lg">
                <Link href={`/ai?subject=${encoded}`}>
                  <Brain /> Practice
                </Link>
              </Button>
            )}
            {encoded && (
              <Button asChild size="lg" variant="outline">
                <Link href={`/resources/${encoded}`}>
                  <FolderOpen /> Resources
                </Link>
              </Button>
            )}
            {!isPast && (
              <Button asChild size="lg" variant="outline">
                <Link href={encoded ? `/focus?subject=${encoded}` : '/focus'}>
                  <Timer /> Focus
                </Link>
              </Button>
            )}
            <DeleteExamButton id={exam.id} title={exam.title} redirectTo="/exams" withLabel />
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7">
            {prep && (
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
            )}

            {subject && (
              <Panel>
                <PanelTitle icon={<CalendarDays />} action={sessions.length > 0 && <Pill>{sessions.length}</Pill>}>
                  {subject} sessions
                </PanelTitle>
                {sessions.length === 0 ? (
                  <EmptyState
                    title="No study sessions yet"
                    description={`Sessions on your timetable for ${subject} show here, done or missed. Plan revision above to add some.`}
                  />
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => {
                      const status = s.isDone ? 'done' : s.isMissed ? 'missed' : 'pending';
                      return (
                        <ListRow
                          key={s.id}
                          leading={
                            status === 'done' ? (
                              <CheckCircle2 className="size-5 shrink-0 text-success" />
                            ) : status === 'missed' ? (
                              <XCircle className="size-5 shrink-0 text-destructive" />
                            ) : (
                              <CircleDashed className="size-5 shrink-0 text-muted-foreground" />
                            )
                          }
                          title={s.subject}
                          subtitle={`${format(new Date(s.date), 'EEE d MMM')} · ${s.startTime}–${s.endTime}`}
                          trailing={
                            <Pill tone={status === 'done' ? 'success' : status === 'missed' ? 'danger' : 'default'}>
                              {status === 'done' ? 'Done' : status === 'missed' ? 'Missed' : s.type === 'REVISION' ? 'Revision' : 'Homework'}
                            </Pill>
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </Panel>
            )}
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-5">
            <Panel>
              <PanelTitle icon={<Target />}>{isPast ? 'This exam' : 'Countdown'}</PanelTitle>
              <div className="grid grid-cols-2 gap-4">
                <Stat
                  label={isPast ? 'Sat' : 'Time left'}
                  value={
                    isPast
                      ? `${-daysRemaining}d ago`
                      : daysRemaining === 0
                        ? 'Today'
                        : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`
                  }
                  tone={isPast ? 'default' : daysRemaining <= 3 ? 'danger' : daysRemaining <= 7 ? 'warning' : 'primary'}
                />
                {subject && <Stat label="Sessions done" value={`${completionRate}%`} />}
              </div>
              {subject && (
                <>
                  <Progress value={completionRate} className="mt-4 h-2" />
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/40 pt-4 sm:grid-cols-3">
                    <Stat label="Focus time" icon={<Clock />} value={stats?.timeSpent || '0m'} />
                    <Stat
                      label="Avg. session"
                      icon={<BarChart3 />}
                      value={stats && stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                     
                    />
                    <Stat
                      label="Sessions"
                      icon={<CheckCircle2 />}
                      value={`${stats?.completedSessions || 0}/${stats?.totalSessions || 0}`}
                     
                    />
                  </div>
                </>
              )}
            </Panel>

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
        </div>
      </PageBody>
    </Page>
  );
}
