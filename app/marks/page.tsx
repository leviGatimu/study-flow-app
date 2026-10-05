import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReportCards } from "@/lib/marks-actions";
import { getGoals } from "@/lib/goal-actions";
import { getSettingsData } from "@/lib/actions";
import { getSubjects } from "@/lib/subject-actions";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/error-state";
import { MarksClient } from "./MarksClient";
import { GoalsView } from "../goals/GoalsView";
import { marksTabs } from "@/components/PageTabs";
import type { ReportCardType } from "./marks-model";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Marks: report cards, and (?view=goals) the target mark for each subject -
 * formerly two pages.
 */
export default async function MarksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  if ((await searchParams).view === 'goals') return <GoalsView tabs={marksTabs('goals')} />;

  let data: [
    Awaited<ReturnType<typeof getReportCards>>,
    Awaited<ReturnType<typeof getSettingsData>>,
    Awaited<ReturnType<typeof getSubjects>>,
    Awaited<ReturnType<typeof getGoals>>,
  ];
  try {
    // Goals come along so each subject can show its target next to its mark.
    data = await Promise.all([getReportCards(), getSettingsData(), getSubjects(), getGoals()]);
  } catch (error) {
    console.error('Marks failed to load', error);
    return (
      <Page>
        <PageHeader title="Marks" description="Your report cards, term by term, with each subject's mark and how to improve it." />
        {marksTabs('marks')}
        <PageBody>
          <ErrorState
            title="Your marks could not be loaded"
            description="Something went wrong while reading your report cards. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }
  const [reportCards, settingsData, subjects, goals] = data;

  return (
    <MarksClient
      initialReportCards={reportCards as unknown as ReportCardType[]}
      currentTermSetting={settingsData?.currentTerm || "Term 1"}
      subjects={subjects}
      goals={goals.map((g) => ({ subject: g.subject, targetGrade: g.targetGrade }))}
      tabs={marksTabs('marks')}
    />
  );
}
