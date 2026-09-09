import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getSetupSnapshot } from '@/lib/setup-actions';
import { SetupWizard } from './SetupWizard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * First-run setup.
 *
 * Reachable at any time - "Run setup again" in Settings comes here, and so does
 * every unfinished item on the dashboard checklist, via ?step=. It is not a
 * one-shot screen and does not disappear once completed, because the questions
 * it asks (what year am I in, when does term end, which subjects) are exactly
 * the ones whose answers change every few months.
 */
export default async function SetupPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const snapshot = await getSetupSnapshot();
  if (!snapshot) redirect('/welcome');

  // The wizard reads ?step= to jump straight at one item, and useSearchParams
  // has to sit under a boundary for that.
  return (
    <Suspense fallback={null}>
      <SetupWizard initial={snapshot} />
    </Suspense>
  );
}
