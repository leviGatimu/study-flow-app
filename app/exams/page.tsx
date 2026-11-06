import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { Brain, CalendarClock, ChevronRight } from 'lucide-react';

import { getEvents, getSubjectStats, getMasteryItems, getCurrentUserTimezone } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { examStatus, examDaysAway, examTimeLabel } from '@/lib/exam-time';
import { ExamStatusRefresh } from '@/components/ExamStatusRefresh';
import { isSubjectSimilar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ExamsClient } from '@/components/ExamsClient';
import { ExamsView, type ExamRowData } from '@/components/exams/ExamsView';
import { UploadTimetableDialog } from '@/components/UploadTimetableDialog';
import { categoryNames, normaliseCategory, summariseCategories } from '@/lib/exam-category';
import { listSubjects } from '@/lib/subject-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [events, params, timezone, subjects] = await Promise.all([getEvents(), searchParams, getCurrentUserTimezone(), listSubjects()]);

  // ?subject= narrows the page to one subject; its page in Subjects links here.
  // An exam not yet linked to a subject is matched on its title, for the
  // filter only - the title is never used as a subject anywhere else.
  const subjectFilter = (Array.isArray(params.subject) ? params.subject[0] : params.subject)?.trim() || null;
  const shown = subjectFilter
    ? events.filter((e) => isSubjectSimilar(e.subject?.name ?? e.title, subjectFilter))
    : events;

  const now = new Date();
  const rows: ExamRowData[] = shown.map((exam) => {
    const status = examStatus(exam, timezone, now);
    return {
      id: exam.id,
      title: exam.title,
      subject: exam.subject?.name ?? null,
      category: normaliseCategory(exam.category),
      at: new Date(exam.date).getTime(),
      when: [format(new Date(exam.date), 'EEE d MMM yyyy'), examTimeLabel(exam)].filter(Boolean).join(' · '),
      days: examDaysAway(exam, timezone, now),
      inProgress: status === 'IN_PROGRESS',
      isDone: status === 'DONE',
      percent: exam.score !== null && exam.maxScore ? Math.round((exam.score / exam.maxScore) * 1000) / 10 : null,
      priority: exam.priority,
    };
  });

  const nextRow = rows.filter((r) => !r.isDone).sort((a, b) => a.at - b.at)[0] ?? null;
  const next = nextRow ? shown.find((e) => e.id === nextRow.id) ?? null : null;
  const nextSubject = next?.subject?.name ?? null;
  const [stats, mastery] = nextSubject
    ? await Promise.all([getSubjectStats(nextSubject), getMasteryItems(nextSubject)])
    : [null, []];
  const topicsDone = mastery.filter((m) => m.isCompleted).length;

  // Averages cover a whole sitting, so they are worked out from every exam even
  // while the list is narrowed to one subject.
  const categories = summariseCategories(events);
  const names = categoryNames(events);
  const pickable = events.map((e) => ({
    id: e.id,
    title: e.title,
    subject: e.subject?.name ?? null,
    date: new Date(e.date).toISOString(),
    category: normaliseCategory(e.category),
  }));

  return (
    <Page>
      <ExamStatusRefresh exams={shown} timezone={timezone} renderedAt={now.toISOString()} />
      <PageHeader
        title="Exams"
        meta={
          subjectFilter ? (
            <>
              Showing {subjectFilter} only.{' '}
              <Link href="/exams" className="font-medium text-primary hover:underline">
                Show all subjects
              </Link>
            </>
          ) : undefined
        }
        actions={
          <>
            <UploadTimetableDialog />
            <ExamsClient categories={names} subjects={subjects} />
          </>
        }
      />

      <PageBody className="space-y-6 pt-6">
        {nextRow && next && (
          <section aria-label="Next exam" className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
            <div className="min-w-0 flex-1 basis-72">
              <p className="text-xs font-semibold text-primary">Next exam</p>
              <Link href={`/exams/${next.id}`} className="mt-0.5 block break-words font-heading text-xl font-bold tracking-tight text-foreground hover:text-primary">
                {next.title}
                {nextRow.category && <span className="font-medium text-muted-foreground"> · {nextRow.category}</span>}
              </Link>
              <p className="text-sm text-muted-foreground">{nextRow.when}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-heading text-3xl font-black tabular-nums tracking-tight text-foreground">
                {nextRow.inProgress ? 'Now' : nextRow.days === 0 ? 'Today' : nextRow.days}
              </p>
              {!nextRow.inProgress && nextRow.days > 0 && (
                <p className="text-xs font-semibold text-muted-foreground">{nextRow.days === 1 ? 'day' : 'days'} left</p>
              )}
            </div>

            {nextSubject && (
              <dl className="flex shrink-0 gap-6 text-sm">
                <div>
                  <dt className="text-muted-foreground">Sessions done</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{stats?.completionRate ?? 0}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Focus time</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{stats?.timeSpent || '0m'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Topics</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{mastery.length ? `${topicsDone}/${mastery.length}` : '0'}</dd>
                </div>
              </dl>
            )}

            <div className="flex shrink-0 flex-wrap gap-2">
              {nextSubject && (
                <Button asChild variant="outline">
                  <Link href={`/ai/practices?subject=${encodeURIComponent(nextSubject)}`}>
                    <Brain /> Practice
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link href={`/exams/${next.id}`}>
                  Open <ChevronRight />
                </Link>
              </Button>
            </div>
          </section>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={subjectFilter ? `No ${subjectFilter} exams yet` : 'No exams yet'}
            description="Add an exam when its date is announced, or upload your exam timetable and add them all at once."
            action={
              <>
                <UploadTimetableDialog />
                <ExamsClient variant="outline" categories={names} subjects={subjects} />
              </>
            }
          />
        ) : (
          <ExamsView exams={rows} categories={categories} pickable={pickable} names={names} />
        )}
      </PageBody>
    </Page>
  );
}
