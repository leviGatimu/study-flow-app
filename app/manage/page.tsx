import { getTemplates } from '@/lib/actions';
import { ManageClient } from './ManageClient';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSubjects } from '@/lib/subject-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManageSchedulePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [templates, subjects] = await Promise.all([
    getTemplates(),
    getSubjects()
  ]);

  return <ManageClient initialTemplates={templates} subjects={subjects} />;
}
