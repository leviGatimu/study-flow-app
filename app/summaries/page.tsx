import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { addDays, format } from 'date-fns';
import { CalendarDays, FileText } from 'lucide-react';

import { getCurrentUserTimezone, getDailySummaries, getSettingsData, getWeeklySummaries } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { getTimeZoneOffsetMinutes } from '@/lib/utils';
import { DEFAULT_DAILY_SUMMARY_TIME, dailySummaryTime as resolveDailySummaryTime } from '@/lib/daily-summary-time';
import { dailyReports, weeklyReports, type ReportKind } from '@/lib/report-model';
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
const DAY = 'yyyy-MM-dd';

/** Report dates are stored as the start of the user's calendar day. */
const keyOf = (d: Date) => format(d, DAY);

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
  let daily: ReturnType<typeof dailyReports> = [];
  let weekly: ReturnType<typeof weeklyReports> = [];
  let urls: Record<string, string> = {};
  let failed = false;
  try {
    const [dailyList, weeklyList, settings, timeZone, scope] = await Promise.all([
      getDailySummaries(),
      getWeeklySummaries(),
      getSettingsData(),
      getCurrentUserTimezone(),
      getViewScope(userId),
    ]);
    dailySummaryTime = resolveDailySummaryTime(settings?.progress?.dailySummaryTime);

    // Homework finished in the span the reports cover, by the user's day.
    const dates = [...dailyList.map((d) => d.date), ...weeklyList.map((w) => w.startDate)];
    const since = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
    const finished = await prisma.homework.findMany({
      where: { userId, ...byTerm(scope), isCompleted: true, completedAt: { gte: addDays(since, -1) } },
      select: { title: true, subject: true, completedAt: true },
      orderBy: { completedAt: 'asc' },
    });
    const byDay = new Map<string, { title: string; subject: string }[]>();
    for (const h of finished) {
      const at = h.completedAt!;
      const local = new Date(at.getTime() + getTimeZoneOffsetMinutes(timeZone, at) * 60_000);
      const key = local.toISOString().slice(0, 10);
      byDay.set(key, [...(byDay.get(key) ?? []), { title: h.title, subject: h.subject }]);
    }
    const byWeek = new Map<string, { title: string; subject: string }[]>();
    const weeks = weeklyList.map((w) => ({ ...w, startKey: keyOf(w.startDate), endKey: keyOf(w.endDate) }));
    for (const [key, items] of byDay) {
      const week = weeks.find((w) => w.startKey <= key && key <= w.endKey);
      if (week) byWeek.set(week.startKey, [...(byWeek.get(week.startKey) ?? []), ...items]);
    }

    daily = dailyReports(dailyList.map((d) => ({ ...d, key: keyOf(d.date) })), byDay);
    weekly = weeklyReports(weeks, byWeek);
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
