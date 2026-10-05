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
 * Ask AI: a chat that knows the student's timetable, homework, exams and weak
 * subjects. Separate from Practice (/ai) on purpose - Practice is the question
 * generator and stays exactly that.
 *
 *   ?c=<id>  open that conversation
 */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const requested = (await searchParams).c;
  const sessionId = typeof requested === 'string' && requested.trim() ? requested.trim() : null;

  let data: Awaited<ReturnType<typeof getAskAIPage>> = null;
  try {
    data = await getAskAIPage(sessionId);
  } catch (error) {
    console.error('Ask AI page failed to load', error);
  }

  if (!data) {
    return (
      <Page>
        <PageHeader title="Ask AI" description="A study copilot that knows your schedule." />
        <PageBody>
          <ErrorState
            title="Your chats could not be loaded"
            description="Something went wrong while fetching them. Your conversations are safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href="/ask">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return (
    <Page bleed>
      {/* Keyed so opening another chat starts from that chat's own state. */}
      <AskClient
        key={data.activeSessionId ?? 'new'}
        sessions={data.sessions}
        initialMessages={data.messages}
        activeSessionId={data.activeSessionId}
        suggestions={data.suggestions}
        panel={data.panel}
        missingSession={Boolean(sessionId) && !data.activeSessionId}
      />
    </Page>
  );
}
