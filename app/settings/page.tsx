import { Suspense } from 'react';

import { getSettingsData } from '@/lib/actions';
import { getTourContext } from '@/lib/tour-actions';
import SettingsInterface from './SettingsInterface';
import { PageSkeleton } from '@/components/PageSkeleton';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  // The tour's read-only counts double as the setup status (subjects, study week).
  const [settingsData, tour] = await Promise.all([getSettingsData(), getTourContext()]);
  if (!settingsData) redirect('/welcome');

  // ?tab= opens a specific section, and useSearchParams needs a boundary.
  return (
    <Suspense fallback={<PageSkeleton layout="list" cards={4} />}>
      <SettingsInterface
        initialData={settingsData}
        counts={{ subjects: tour?.subjectCount ?? 0, studyBlocks: tour?.templateCount ?? 0 }}
      />
    </Suspense>
  );
}
