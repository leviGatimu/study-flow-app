import { getTodayTasks } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TimeClient } from './TimeClient';
import { TaskWithTemplate } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TimePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const todayTasks = await getTodayTasks();

  return (
    <main className="bg-background min-h-screen">
      <TimeClient todayTasks={todayTasks as TaskWithTemplate[]} />
    </main>
  );
}
