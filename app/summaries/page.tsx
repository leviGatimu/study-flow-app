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
    <div className="space-y-12 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-16 px-4 md:px-8">
      <div className="pt-10 pb-6 border-b border-border/40">
        <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">Performance Transcripts</h1>
        <p className="text-xl text-muted-foreground font-semibold mt-3">Access your historical weekly study logs and download certified PDF academic summaries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {summaries.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-muted/30 rounded-[40px] border-2 border-dashed border-border/40">
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No summaries generated yet.</p>
          </div>
        ) : (
          summaries.map(summary => (
            <SummaryCard key={summary.id} summary={summary} />
          ))
        )}
      </div>
    </div>
  );
}
