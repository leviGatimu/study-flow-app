import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { getReportCards } from "@/lib/marks-actions";
import { getGoals } from "@/lib/goal-actions";
import { getUniqueSubjects } from "@/lib/actions";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/error-state";
import { GoalsClient } from "./GoalsClient";
import type { ReportCardType } from "./goals-model";

/** The Goals tab of Marks (formerly its own page). */
export async function GoalsView({ tabs }: { tabs: React.ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let data: [Awaited<ReturnType<typeof getReportCards>>, Awaited<ReturnType<typeof getGoals>>, string[]];
  try {
    data = await Promise.all([getReportCards(), getGoals(), getUniqueSubjects()]);
  } catch (error) {
    console.error('Goals failed to load', error);
    return (
      <Page>
        <PageHeader title="Marks" description="A target mark for each subject, next to your latest mark." />
        {tabs}
        <PageBody>
          <ErrorState
            title="Your goals could not be loaded"
            description="Something went wrong while reading your targets and marks. Reload the page to try again."
          />
        </PageBody>
      </Page>
    );
  }
  const [reportCards, goals, uniqueSubjects] = data;

  return (
    <GoalsClient
      initialReportCards={reportCards as unknown as ReportCardType[]}
      initialGoals={goals}
      uniqueSubjects={uniqueSubjects}
      tabs={tabs}
    />
  );
}
