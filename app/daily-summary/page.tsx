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
    <div className="space-y-12 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-16 px-4 md:px-8">
      <div className="pt-10 pb-6 border-b border-border/40 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">Daily Summary</h1>
          <p className="text-xl text-muted-foreground font-semibold mt-3">A fresh report every day, generated automatically — plus a lifetime report whenever you want it.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <DailySummaryTimeSetting initialTime={dailySummaryTime} />
          <OverallSummaryButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {summaries.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-muted/30 rounded-[40px] border-2 border-dashed border-border/40">
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No daily summaries yet. Complete a scheduled task to get started.</p>
          </div>
        ) : (
          summaries.map(summary => (
            <DailySummaryCard key={summary.id} summary={summary} />
          ))
        )}
      </div>
    </div>
  );
}
