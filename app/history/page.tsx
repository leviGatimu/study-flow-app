import { redirect } from 'next/navigation';
import { getHistoryTasks, syncStreak } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import type { TaskWithTemplate } from '@/lib/types';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { HistoryClient } from './HistoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoryPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let tasks: Awaited<ReturnType<typeof getHistoryTasks>>;
  let userProgress: Awaited<ReturnType<typeof syncStreak>>;
  try {
    [tasks, userProgress] = await Promise.all([getHistoryTasks(), syncStreak()]);
  } catch (error) {
    console.error('History failed to load', error);
    return (
      <Page>
        <PageHeader title="History" description="Every study block you finished, and the ones you missed." />
        <PageBody>
          <ErrorState
            title="Your history could not be loaded"
            description="Something went wrong while reading your finished work. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }

  return <HistoryClient tasks={tasks as TaskWithTemplate[]} userProgress={userProgress} />;
}
