import { getInsightsData, type InsightsScope } from '@/lib/insights-actions';
import { InsightsClient } from './InsightsClient';
import { getUserId } from '@/lib/auth';
import { getScheduleState } from '@/lib/term';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Insights for the year you are in, or for every year you have studied.
 *
 * The scope lives in the URL rather than in client state so the whole page
 * stays server-rendered - the data is computed on the server either way, and a
 * client toggle would mean shipping both datasets or a round trip on click.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { scope: raw } = await searchParams;
  const scope: InsightsScope = raw === 'lifetime' ? 'lifetime' : 'class';

  const [data, schedule] = await Promise.all([
    getInsightsData(scope),
    getScheduleState(userId),
  ]);
  if (!data) redirect('/welcome');

  return (
    <InsightsClient
      data={data}
      scope={scope}
      classLabel={schedule.classLabel}
    />
  );
}
