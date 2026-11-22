import { NextResponse, type NextRequest } from 'next/server';

import { getMentorSession, getUserId } from '@/lib/auth';
import { readTalkMessages } from '@/lib/talk';
import { openTalkStream, TalkUnavailableError } from '@/lib/talk-server';

export const dynamic = 'force-dynamic';

/**
 * POST { messages: [{ role: 'user' | 'model', text }] } -> the reply as a
 * plain-text stream. Nothing is stored: the conversation lives on the device.
 * Errors before the first word come back as JSON { error } with a status.
 */
export async function POST(request: NextRequest) {
  // A mentor is only looking at the account, and must not spend its AI key.
  const userId = (await getMentorSession()) ? null : await getUserId();
  if (!userId) return NextResponse.json({ error: 'You are signed out. Sign in and try again.' }, { status: 401 });

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  const messages = readTalkMessages(body.messages);
  if (!messages) return NextResponse.json({ error: 'Nothing to answer.' }, { status: 400 });

  try {
    const { provider, stream } = await openTalkStream(userId, messages, request.signal);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Talk-Provider': provider,
      },
    });
  } catch (error) {
    if (error instanceof TalkUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error('Talk it out failed', error);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
