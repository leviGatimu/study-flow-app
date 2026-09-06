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
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 animate-in fade-in duration-500">
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Academic Ranks</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Track your level progression and showcase your academic consistency.
        </p>
      </div>

      <div className="px-4 md:px-8">
        <RankRoadmap userProgress={userProgress} />
      </div>
    </div>
  );
}

