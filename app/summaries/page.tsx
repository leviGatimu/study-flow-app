import { getWeeklySummaries } from '@/lib/actions';
import { SummaryCard } from '@/components/SummaryCard';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function SummariesPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const summaries = await getWeeklySummaries();

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8 animate-in fade-in duration-500">
      <div className="pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Performance transcripts</h1>
        <p className="text-sm text-muted-foreground mt-2">Your historical weekly study logs, with certified PDF summaries you can download any time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {summaries.length === 0 ? (
          <p className="col-span-full text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
            No summaries yet. Complete a full week of scheduled tasks and one will generate automatically.
          </p>
        ) : (
          summaries.map(summary => (
            <SummaryCard key={summary.id} summary={summary} />
          ))
        )}
      </div>
    </div>
  );
}
