import { Suspense } from 'react';

import { getSettingsData } from '@/lib/actions';
import SettingsInterface from './SettingsInterface';
import { PageSkeleton } from '@/components/PageSkeleton';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const settingsData = await getSettingsData();
  if (!settingsData) redirect('/welcome');

  // ?tab= opens a specific section, and useSearchParams needs a boundary.
  return (
    <Suspense fallback={<PageSkeleton layout="list" cards={4} />}>
      <SettingsInterface initialData={settingsData} />
    </Suspense>
  );
}
