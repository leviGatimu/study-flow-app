import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getStudyHome } from '@/lib/ai-study-actions';
import { AiStudy } from './AiStudy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * AI Study — the only AI destination.
 *
 * /tutor and /notes-ai now redirect here. They were never three products; they
 * were one assistant behind three doors, none of which knew anything about the
 * student standing in front of it.
 */
export default async function AiStudyPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const home = await getStudyHome();
  if (!home) redirect('/welcome');

  return <AiStudy home={home} />;
}
