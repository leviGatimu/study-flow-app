import { checkAIAvailability, getChatSessions } from '@/lib/ai-actions';
import { syncStreak, getTodayTasks } from '@/lib/actions';
import { AIChatInterface } from './AIChatInterface';
import { AIKeyPrompt } from './AIKeyPrompt';
import { ChatSession } from '@/lib/types';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AIPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [awaitedSearchParams, { available }, userProgress, initialSessions, todayTasks] = await Promise.all([
    searchParams,
    checkAIAvailability(),
    syncStreak(),
    getChatSessions(),
    getTodayTasks()
  ]);

  const initialPrompt = awaitedSearchParams.prompt || "";

  return (
    <div className="flex h-screen flex-col bg-background relative animate-in fade-in duration-500">
      {available ? (
        <AIChatInterface 
          userName={userProgress?.name || 'Student'} 
          userProgress={userProgress}
          initialSessions={initialSessions as ChatSession[]}
          initialTasks={todayTasks}
          initialPrompt={initialPrompt}
        />
      ) : (
        <AIKeyPrompt />
      )}
    </div>
  );
}
