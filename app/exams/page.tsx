import Link from 'next/link';
import { redirect } from 'next/navigation';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { Brain, CalendarClock, CheckCircle2, Clock, FolderOpen, History, ListChecks, Target } from 'lucide-react';

import { getEvents, getSubjectStats, getMasteryItems } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { isSubjectSimilar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { ListRow, Pill } from '@/components/ui/list-row';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { ExamsClient, DeleteExamButton } from '@/components/ExamsClient';
import { UploadTimetableDialog } from '@/components/UploadTimetableDialog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Exam = Awaited<ReturnType<typeof getEvents>>[number];

function priorityPill(priority: string) {
  if (priority === 'HIGH') return <Pill tone="danger">High priority</Pill>;
  if (priority === 'LOW') return <Pill>Low priority</Pill>;
  return null;
}

function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function countdownTone(days: number) {
  return days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'default';
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [events, params] = await Promise.all([getEvents(), searchParams]);

  // ?subject= narrows the page to one subject; its page in Subjects links here.
  // An exam not yet linked to a subject is matched on its title, for the
  // filter only - the title is never used as a subject anywhere else.
  const subjectFilter = (Array.isArray(params.subject) ? params.subject[0] : params.subject)?.trim() || null;
  const shown = subjectFilter
    ? events.filter((e) => isSubjectSimilar(e.subject?.name ?? e.title, subjectFilter))
    : events;

  const today = startOfDay(new Date());
  const daysUntil = (e: Exam) => differenceInCalendarDays(startOfDay(new Date(e.date)), today);
  const upcoming = shown.filter((e) => daysUntil(e) >= 0).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const past = shown.filter((e) => daysUntil(e) < 0).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const next = upcoming[0] ?? null;
  const nextSubject = next?.subject?.name ?? null;
  const [stats, mastery] = nextSubject
    ? await Promise.all([getSubjectStats(nextSubject), getMasteryItems(nextSubject)])
    : [null, []];
  const topicsDone = mastery.filter((m) => m.isCompleted).length;

  return (
    <Page>
      <PageHeader
        title="Exams"
        description="Every exam coming up, soonest first. Open one to plan its revision and record how it went."
        meta={
          subjectFilter ? (
            <>
              Showing {subjectFilter} only.{' '}
              <Link href="/exams" className="font-medium text-primary hover:underline">
                Show all subjects
              </Link>
            </>
          ) : upcoming.length > 0 ? (
            `${upcoming.length} coming up`
          ) : undefined
        }
        actions={
          <>
            <UploadTimetableDialog />
            <ExamsClient />
          </>
        }
      />

      <PageBody>
        {next ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-8">
              <PanelTitle icon={<CalendarClock />} action={priorityPill(next.priority)}>
                Next exam
              </PanelTitle>
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 space-y-2">
                  <Link href={`/exams/${next.id}`} className="group block">
                    <p className="line-clamp-2 font-heading text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {next.title}
                    </p>
                  </Link>
                  <p className="text-sm font-medium text-muted-foreground">
                    {format(new Date(next.date), 'EEEE d MMMM yyyy')}
                    {nextSubject && ` · ${nextSubject}`}
                  </p>
                </div>
                <div className="shrink-0 md:text-right">
                  <p className="font-heading text-5xl font-black tracking-tight tabular-nums text-foreground">
                    {daysUntil(next) === 0 ? 'Today' : daysUntil(next)}
                  </p>
                  {daysUntil(next) > 0 && (
                    <p className="text-sm font-bold text-muted-foreground">
                      {daysUntil(next) === 1 ? 'day' : 'days'} left
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-6">
                <Button asChild variant="outline">
                  <Link href={`/exams/${next.id}`}>
                    <CalendarClock /> Plan revision
                  </Link>
                </Button>
                {nextSubject && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/ai?subject=${encodeURIComponent(nextSubject)}`}>
                        <Brain /> Practice {nextSubject}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/resources/${encodeURIComponent(nextSubject)}`}>
                        <FolderOpen /> Resources
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </Panel>

            <Panel className="lg:col-span-4">
              <PanelTitle icon={<Target />}>Readiness</PanelTitle>
              {nextSubject ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Study sessions done</span>
                      <span className="font-heading text-2xl font-bold text-primary tabular-nums">
                        {stats?.completionRate ?? 0}%
                      </span>
                    </div>
                    <Progress value={stats?.completionRate ?? 0} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4">
                    <Stat label="Focus time" icon={<Clock />} value={stats?.timeSpent || '0m'} />
                    <Stat
                      label="Topics mastered"
                      icon={<ListChecks />}
                      value={mastery.length ? `${topicsDone}/${mastery.length}` : '0'}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Not linked to a subject"
                  description="Link this exam to its subject to see focus time, sessions and syllabus progress."
                  action={
                    <Button asChild variant="outline">
                      <Link href={`/exams/${next.id}`}>Link a subject</Link>
                    </Button>
                  }
                />
              )}
            </Panel>
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClock />}
            title={subjectFilter ? `No ${subjectFilter} exams coming up` : 'No exams coming up'}
            description="Add an exam when its date is announced, or upload your exam timetable and add them all at once."
            action={
              <>
                <UploadTimetableDialog />
                <ExamsClient variant="outline" />
              </>
            }
          />
        )}

        {upcoming.length > 1 && (
          <Section title="Coming up" description="After the next one, in date order.">
            <Panel>
              <div className="space-y-3">
                {upcoming.slice(1).map((exam) => (
                  <ExamRow key={exam.id} exam={exam} days={daysUntil(exam)} />
                ))}
              </div>
            </Panel>
          </Section>
        )}

        {past.length > 0 && (
          <Section title="Past exams" description="Record a result on any exam that does not have one yet.">
            <Panel>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {past.slice(0, 12).map((exam) => (
                  <ListRow
                    key={exam.id}
                    href={`/exams/${exam.id}`}
                    leading={<History className="size-5 shrink-0 text-muted-foreground" />}
                    title={exam.title}
                    subtitle={format(new Date(exam.date), 'd MMM yyyy')}
                    trailing={
                      exam.score !== null && exam.maxScore ? (
                        <Pill tone="success">
                          <CheckCircle2 /> {Math.round((exam.score / exam.maxScore) * 100)}%
                        </Pill>
                      ) : (
                        <Pill>Add result</Pill>
                      )
                    }
                  />
                ))}
              </div>
            </Panel>
          </Section>
        )}
      </PageBody>
    </Page>
  );
}

function ExamRow({ exam, days }: { exam: Exam; days: number }) {
  return (
    <ListRow
      title={
        <Link href={`/exams/${exam.id}`} className="hover:text-primary focus-visible:underline focus-visible:outline-none">
          {exam.title}
        </Link>
      }
      subtitle={[format(new Date(exam.date), 'EEE d MMM'), exam.subject?.name].filter(Boolean).join(' · ')}
      trailing={
        <>
          <span className="hidden sm:contents">{priorityPill(exam.priority)}</span>
          <Pill tone={countdownTone(days)}>{countdownLabel(days)}</Pill>
          <DeleteExamButton id={exam.id} title={exam.title} />
        </>
      }
    />
  );
}
