import { syncStreak } from "@/lib/actions";
import { RankRoadmap } from "@/components/RankRoadmap";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RanksPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const userProgress = await syncStreak();

  if (!userProgress) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">Academic Ranks</h1>
          <p className="text-xl text-muted-foreground font-semibold mt-3">
            Track your level progression and showcase your academic consistency.
          </p>
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-4 duration-500 px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <RankRoadmap userProgress={userProgress} />
        </div>
      </div>
    </div>
  );
}

