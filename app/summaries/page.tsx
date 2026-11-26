import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { CalendarDays, FileText } from 'lucide-react';

import { getSettingsData } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { DEFAULT_DAILY_SUMMARY_TIME, dailySummaryTime as resolveDailySummaryTime } from '@/lib/daily-summary-time';
import { type ReportData, type ReportKind } from '@/lib/report-model';
import { loadReports } from '@/lib/report-load';
import { fileReports, filedReportUrls } from '@/lib/report-filing';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { DailySummaryTimeSetting } from '@/components/DailySummaryTimeSetting';
import { OverallSummaryButton } from '@/components/OverallSummaryButton';
import { ReportsBrowser } from '@/components/reports/ReportsBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DESCRIPTION = 'A graded report for each day and each week, written automatically and saved as a PDF in Resources › Reports.';

/**
 * Reports: the list on the left, the chosen report on the right. Reading the
 * lists is what writes any report that is due (getDailySummaries is the only
 * place daily reports are created), so both are always read. Each new report
 * is then filed as a PDF in Resources, after the response is sent.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; r?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const params = await searchParams;
  const view: ReportKind = params.view === 'weekly' ? 'weekly' : 'daily';

  let dailySummaryTime = DEFAULT_DAILY_SUMMARY_TIME;
  let daily: ReportData[] = [];
  let weekly: ReportData[] = [];
  let urls: Record<string, string> = {};
  let failed = false;
  try {
    const [loaded, settings] = await Promise.all([loadReports(userId), getSettingsData()]);
    dailySummaryTime = resolveDailySummaryTime(settings?.progress?.dailySummaryTime);
    const { scope } = loaded;
    daily = loaded.daily;
    weekly = loaded.weekly;
    urls = await filedReportUrls(userId, scope);

    const toFile = [...daily, ...weekly];
    after(async () => {
      await fileReports(userId, scope, toFile);
    });
  } catch (error) {
    console.error('Reports failed to load', error);
    failed = true;
  }

  const reports = view === 'daily' ? daily : weekly;

  let body: React.ReactNode;
  if (failed) {
    body = (
      <ErrorState
        title="Your reports could not be loaded"
        description="Something went wrong while reading your summaries. Reload the page to try again."
      />
    );
  } else if (daily.length === 0 && weekly.length === 0) {
    body = (
      <EmptyState
        icon={<CalendarDays />}
        title="No reports yet"
        description={`A report is written at ${dailySummaryTime} on any day you have study blocks. Finish one today to get your first.`}
        action={
          <Button asChild>
            <Link href="/">Go to today</Link>
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <ReportsBrowser
          view={view}
          reports={reports}
          counts={{ daily: daily.length, weekly: weekly.length }}
          initialId={params.r ?? null}
          urls={urls}
        />
        {reports.length === 0 && (
          <EmptyState
            icon={<FileText />}
            title={view === 'weekly' ? 'No weekly reports yet' : 'No daily reports yet'}
            description={
              view === 'weekly'
                ? 'A weekly report is written after each full week of study blocks. Until then, the daily reports cover each day.'
                : `A report is written at ${dailySummaryTime} on any day you have study blocks.`
            }
          />
        )}
      </>
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
      <PageBody>{body}</PageBody>
    </Page>
  );
}
