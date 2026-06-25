import { getInsightsData } from '@/lib/insights-actions';
import { InsightsClient } from './InsightsClient';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InsightsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const data = await getInsightsData();
  if (!data) redirect('/welcome');

  return <InsightsClient data={data} />;
}
