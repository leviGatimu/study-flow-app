import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getClassOverview } from '@/lib/term-actions';
import { YearClient } from './YearClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function YearPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const classes = await getClassOverview();

  return <YearClient classes={classes ?? []} />;
}
