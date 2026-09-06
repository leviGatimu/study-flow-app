import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getClassOverview, getCurrentScheduleState } from '@/lib/term-actions';
import { YearClient } from './YearClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function YearPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [classes, schedule] = await Promise.all([
    getClassOverview(),
    getCurrentScheduleState(),
  ]);

  return <YearClient classes={classes ?? []} schedule={schedule} />;
}
