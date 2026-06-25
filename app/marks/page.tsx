import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReportCards } from "@/lib/marks-actions";
import { getSettingsData } from "@/lib/actions";
import { getSubjects } from "@/lib/subject-actions";
import { MarksClient } from "./MarksClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MarksPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [reportCards, settingsData, subjects] = await Promise.all([
    getReportCards(),
    getSettingsData(),
    getSubjects()
  ]);

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-5xl font-heading font-black tracking-tight text-foreground uppercase">Academic Standings</h1>
            <p className="text-xl text-muted-foreground font-semibold mt-3">
              Track your subject grades, analyze term progress, and review targeted study strategies.
            </p>
          </div>
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-4 duration-500 px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <MarksClient 
            initialReportCards={reportCards as any} 
            currentTermSetting={settingsData?.currentTerm || "Term 1"} 
            subjects={subjects}
          />
        </div>
      </div>
    </div>
  );
}

