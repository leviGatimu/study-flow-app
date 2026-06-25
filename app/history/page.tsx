import { getHistoryTasks, syncStreak } from '@/lib/actions';
import { HistoryClient } from './HistoryClient';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoryPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const tasks = await getHistoryTasks();
  const userProgress = await syncStreak();

  return <HistoryClient tasks={tasks as any} userProgress={userProgress} />;
}
