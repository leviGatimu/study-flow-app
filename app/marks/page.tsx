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
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8 animate-in fade-in duration-500">
      <div className="pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Academic standings</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Track your subject grades, follow term progress, and review targeted study strategies.
        </p>
      </div>

      <MarksClient
        initialReportCards={reportCards as any}
        currentTermSetting={settingsData?.currentTerm || "Term 1"}
        subjects={subjects}
      />
    </div>
  );
}

