import { redirect } from 'next/navigation';
import { getHistoryTasks, syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import type { TaskWithTemplate } from '@/lib/types';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { HistoryClient } from './HistoryClient';
import { InsightsView } from '../insights/InsightsView';
import { historyTabs } from '@/components/PageTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * History: two views of what you have done.
 *   (default)       Completed work - every block finished or missed
 *   ?view=overview  the year at a glance (formerly Insights), &scope=lifetime
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; scope?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { view, scope } = await searchParams;
  if (view === 'overview') {
    return <InsightsView scope={scope === 'lifetime' ? 'lifetime' : 'class'} tabs={historyTabs('overview')} />;
  }

  let tasks: Awaited<ReturnType<typeof getHistoryTasks>>;
  let userProgress: Awaited<ReturnType<typeof syncStreak>>;
  try {
    [tasks, userProgress] = await Promise.all([getHistoryTasks(), syncStreak()]);
  } catch (error) {
    console.error('History failed to load', error);
    return (
      <Page>
        <PageHeader title="History" description="Every study block you finished, and the ones you missed." />
        {historyTabs('log')}
        <PageBody>
          <ErrorState
            title="Your history could not be loaded"
            description="Something went wrong while reading your finished work. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }

  return <HistoryClient tasks={tasks as TaskWithTemplate[]} userProgress={userProgress} tabs={historyTabs('log')} />;
}
