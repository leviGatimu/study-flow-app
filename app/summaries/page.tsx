import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, FileText } from 'lucide-react';

import { getDailySummaries, getSettingsData, getWeeklySummaries } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { SummaryCard } from '@/components/SummaryCard';
import { DailySummaryCard } from '@/components/DailySummaryCard';
import { DailySummaryTimeSetting } from '@/components/DailySummaryTimeSetting';
import { OverallSummaryButton } from '@/components/OverallSummaryButton';
import { Segmented } from '../insights/Segmented';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type View = 'daily' | 'weekly';

const DESCRIPTION = 'A graded report for each day and each week, generated automatically. Download any of them as a PDF.';

/**
 * Reports: the daily and weekly summaries on one page (the old Daily summary
 * page redirects here). The view lives in the URL so a link can open either
 * one.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { view: raw } = await searchParams;
  const view: View = raw === 'weekly' ? 'weekly' : 'daily';

  let dailySummaryTime = '21:00';
  let daily: Awaited<ReturnType<typeof getDailySummaries>> = [];
  let weekly: Awaited<ReturnType<typeof getWeeklySummaries>> = [];
  let failed = false;
  try {
    // Both lists are read whichever view is on screen: reading a list is
    // what generates any report in it that is due (getDailySummaries is the
    // only place daily reports are created), so neither may depend on which
    // tab was opened.
    const [dailyList, weeklyList, settings] = await Promise.all([
      getDailySummaries(),
      getWeeklySummaries(),
      getSettingsData(),
    ]);
    daily = dailyList;
    weekly = weeklyList;
    dailySummaryTime = settings?.progress?.dailySummaryTime ?? '21:00';
  } catch (error) {
    console.error('Reports failed to load', error);
    failed = true;
  }

  let body: React.ReactNode;
  if (failed) {
    body = (
      <ErrorState
        title="Your reports could not be loaded"
        description="Something went wrong while reading your summaries. Reload the page to try again."
      />
    );
  } else if (view === 'daily') {
    body =
      daily.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No daily reports yet"
          description={`A report is written at ${dailySummaryTime} on any day you finish a scheduled block. Finish one today to get your first.`}
          action={
            <Button asChild>
              <Link href="/">Go to today</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {daily.map((summary) => (
            <DailySummaryCard key={summary.id} summary={summary} />
          ))}
        </div>
      );
  } else {
    body =
      weekly.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No weekly reports yet"
          description="A weekly report is written after each full week of scheduled study. Until then, your daily reports cover each day."
          action={
            <Button asChild variant="outline">
              <Link href="/summaries">See daily reports</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {weekly.map((summary) => (
            <SummaryCard key={summary.id} summary={summary} />
          ))}
        </div>
      );
  }

  return (
    <Page>
      <PageHeader
        title="Reports"
        description={DESCRIPTION}
        actions={
          <>
            <DailySummaryTimeSetting initialTime={dailySummaryTime} />
            <OverallSummaryButton />
          </>
        }
      />
      <PageBody>
        <Segmented
          label="Report period"
          value={view}
          options={[
            { value: 'daily', label: `Daily (${daily.length})`, href: '/summaries' },
            { value: 'weekly', label: `Weekly (${weekly.length})`, href: '/summaries?view=weekly' },
          ]}
        />
        {body}
      </PageBody>
    </Page>
  );
}
