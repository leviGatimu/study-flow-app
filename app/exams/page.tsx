import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock } from 'lucide-react';

import { getEvents, getSubjectStats, getMasteryItems, getCurrentUserTimezone } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { toExamRow } from '@/lib/exam-rows';
import { ExamStatusRefresh } from '@/components/ExamStatusRefresh';
import { isSubjectSimilar } from '@/lib/utils';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ExamsClient } from '@/components/ExamsClient';
import { ExamsView, type ExamRowData } from '@/components/exams/ExamsView';
import { NextExamHero } from '@/components/exams/exam-ui';
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
  const rows: ExamRowData[] = shown.map((exam) => toExamRow(exam, timezone, now));

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

      <PageBody className="space-y-10 pt-6">
        {nextRow && next && (
          <NextExamHero
            exam={{
              id: next.id,
              title: next.title,
              subject: nextSubject,
              category: nextRow.category,
              when: nextRow.when,
              days: nextRow.days,
              inProgress: nextRow.inProgress,
              stats: nextSubject
                ? {
                    sessions: stats?.completionRate ?? 0,
                    focus: stats?.timeSpent || '0m',
                    topics: mastery.length ? `${topicsDone}/${mastery.length}` : '0',
                  }
                : null,
            }}
          />
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
