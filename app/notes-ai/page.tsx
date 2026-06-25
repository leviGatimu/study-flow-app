import { checkAIAvailability, getAiNotes } from '@/lib/ai-actions';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AIKeyPrompt } from '@/app/ai/AIKeyPrompt';
import AiNotesClient from './AiNotesClient';

export const dynamic = 'force-dynamic';

export default async function AiNotesPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [{ available }, notes] = await Promise.all([
    checkAIAvailability(),
    getAiNotes()
  ]);

  return (
    <div className="flex h-screen flex-col bg-background relative animate-in fade-in duration-500">
      {available ? (
        <AiNotesClient initialNotes={notes} />
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-card/40 backdrop-blur-xl border border-border/40 rounded-[32px] p-10 shadow-2xl">
            <AIKeyPrompt />
          </div>
        </div>
      )}
    </div>
  );
}
