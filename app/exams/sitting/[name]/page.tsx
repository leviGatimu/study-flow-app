import { notFound, redirect } from 'next/navigation';

import { getCurrentUserTimezone, getEvents } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { categoryFromSlug, categoryNames, inCategory, normaliseCategory, summariseCategories } from '@/lib/exam-category';
import { toExamRow } from '@/lib/exam-rows';
import { ExamStatusRefresh } from '@/components/ExamStatusRefresh';
import { Page, PageBody } from '@/components/ui/page';
import { SittingView } from '@/components/exams/SittingView';

export const dynamic = 'force-dynamic';

/**
 * One category of exams ("Midterm 1", "End of term"): every exam in it,
 * coming up and done, with its results. /exams/sitting/_none lists the
 * exams that have no category.
 */
export default async function SittingPage({ params }: { params: Promise<{ name: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const wanted = categoryFromSlug((await params).name);
  if (!wanted) notFound();

  const [events, timezone] = await Promise.all([getEvents(), getCurrentUserTimezone()]);
  const exams = wanted.none ? events.filter((e) => !normaliseCategory(e.category)) : events.filter((e) => inCategory(e, wanted.name));
  if (exams.length === 0) notFound();

  const now = new Date();
  const rows = exams.map((exam) => toExamRow(exam, timezone, now));
  // The first spelling seen wins, as on the Exams page.
  const summary = wanted.none ? null : summariseCategories(exams)[0] ?? null;
  const name = wanted.none ? null : summary?.name ?? wanted.name;

  return (
    <Page>
      <ExamStatusRefresh exams={exams} timezone={timezone} renderedAt={now.toISOString()} />
      <PageBody className="space-y-8 pt-8">
        <SittingView
          name={name}
          exams={rows}
          average={summary?.average ?? null}
          names={categoryNames(events)}
          pickable={events.map((e) => ({
            id: e.id,
            title: e.title,
            subject: e.subject?.name ?? null,
            date: new Date(e.date).toISOString(),
            category: normaliseCategory(e.category),
          }))}
        />
      </PageBody>
    </Page>
  );
}
