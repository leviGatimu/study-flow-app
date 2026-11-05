import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getAskAIPage } from '@/lib/copilot-actions';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { AskClient } from './AskClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Study: one AI chat. It knows the student's timetable, homework, exams and
 * marks, and asking it to "quiz me on ..." makes a practice set, which opens
 * in the practice runner (/ai/practices). Past chats and practice scores are
 * in the side rail.
 *
 *   ?c=<id>  open that conversation
 */
export default async function StudyPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const requested = (await searchParams).c;
  const sessionId = typeof requested === 'string' && requested.trim() ? requested.trim() : null;

  let data: Awaited<ReturnType<typeof getAskAIPage>> = null;
  try {
    data = await getAskAIPage(sessionId);
  } catch (error) {
    console.error('Study page failed to load', error);
  }

  if (!data) {
    return (
      <Page>
        <PageHeader title="Study" description="Ask the AI, or have it make a practice for you." />
        <PageBody>
          <ErrorState
            title="Your chats could not be loaded"
            description="Something went wrong while fetching them. Your conversations are safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href="/ai">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return (
    <Page bleed>
      <div className="min-h-0 flex-1">
        {/* Keyed so opening another chat starts from that chat's own state. */}
        <AskClient
          key={data.activeSessionId ?? 'new'}
          sessions={data.sessions}
          initialMessages={data.messages}
          activeSessionId={data.activeSessionId}
          suggestions={data.suggestions}
          panel={data.panel}
          practices={data.practices}
          missingSession={Boolean(sessionId) && !data.activeSessionId}
        />
      </div>
    </Page>
  );
}
