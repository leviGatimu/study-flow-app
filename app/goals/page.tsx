import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReportCards } from "@/lib/marks-actions";
import { getGoals } from "@/lib/goal-actions";
import { getUniqueSubjects } from "@/lib/actions";
import { GoalsClient } from "./GoalsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GoalsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [reportCards, goals, uniqueSubjects] = await Promise.all([
    getReportCards(),
    getGoals(),
    getUniqueSubjects(),
  ]);

  return (
    <GoalsClient 
      initialReportCards={reportCards as any} 
      initialGoals={goals} 
      uniqueSubjects={uniqueSubjects} 
    />
  );
}
