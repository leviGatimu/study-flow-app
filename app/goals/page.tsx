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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GoalsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let data: [Awaited<ReturnType<typeof getReportCards>>, Awaited<ReturnType<typeof getGoals>>, string[]];
  try {
    data = await Promise.all([getReportCards(), getGoals(), getUniqueSubjects()]);
  } catch (error) {
    console.error('Goals failed to load', error);
    return (
      <Page>
        <PageHeader title="Goals" description="A target mark for each subject, next to your latest mark from Marks." />
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
    />
  );
}
