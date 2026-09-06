import { getDailySummaries, getSettingsData } from '@/lib/actions';
import { DailySummaryCard } from '@/components/DailySummaryCard';
import { DailySummaryTimeSetting } from '@/components/DailySummaryTimeSetting';
import { OverallSummaryButton } from '@/components/OverallSummaryButton';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DailySummaryPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [summaries, settings] = await Promise.all([
    getDailySummaries(),
    getSettingsData(),
  ]);

  const dailySummaryTime = settings?.progress?.dailySummaryTime ?? "21:00";

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8 animate-in fade-in duration-500">
      <div className="pt-10 pb-6 border-b border-border/40 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Daily summary</h1>
          <p className="text-sm text-muted-foreground mt-2">A fresh report every day, generated automatically — plus a lifetime report whenever you want it.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <DailySummaryTimeSetting initialTime={dailySummaryTime} />
          <OverallSummaryButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {summaries.length === 0 ? (
          <p className="col-span-full text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
            No daily summaries yet. Complete a scheduled task today to get your first one.
          </p>
        ) : (
          summaries.map(summary => (
            <DailySummaryCard key={summary.id} summary={summary} />
          ))
        )}
      </div>
    </div>
  );
}
