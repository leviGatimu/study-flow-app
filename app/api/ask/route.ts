import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { getMentorSession, getUserId } from '@/lib/auth';
import { assertWritableScope } from '@/lib/scope';
import { completeCopilotTurn, failCopilotTurn, prepareCopilotTurn } from '@/lib/copilot-server';
import { openTalkStream, TalkUnavailableError } from '@/lib/talk-server';

export const dynamic = 'force-dynamic';

/**
 * POST { sessionId, question, requestId } -> the Study chat's answer as
 * newline-delimited JSON, so the first words show while the rest is written:
 *
 *   {"t":"start","sessionId","session?","userMessage"}
 *   {"t":"delta","text"}              (many)
 *   {"t":"working","what":"practice"} (while a practice set is being made)
 *   {"t":"done","userMessage","reply","practice?"}
 *   {"t":"error","error","userMessage?"}
 *
 * Errors before anything is saved come back as JSON { error } with a status.
 */
export async function POST(request: NextRequest) {
  // A mentor is only looking at the account, and must not spend its AI key.
  const userId = (await getMentorSession()) ? null : await getUserId();
  if (!userId) return NextResponse.json({ error: 'You are signed out. Sign in and try again.' }, { status: 401 });

  let body: { sessionId?: unknown; question?: unknown; requestId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  let turn: Awaited<ReturnType<typeof prepareCopilotTurn>>;
  try {
    await assertWritableScope(userId);
    turn = await prepareCopilotTurn(userId, {
      sessionId: typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : null,
      question: String(body.question ?? ''),
      requestId: String(body.requestId ?? ''),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send that.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const line = (event: object) => encoder.encode(`${JSON.stringify(event)}\n`);
  const start = { t: 'start', sessionId: turn.sessionId, session: turn.session, userMessage: turn.userMessage };

  if (turn.kind === 'answered') {
    revalidatePath('/ai');
    return ndjson(new Blob([line(start), line({ t: 'done', userMessage: turn.userMessage, reply: turn.reply })]).stream());
  }

  let source: ReadableStream<Uint8Array>;
  try {
    ({ stream: source } = await openTalkStream(userId, turn.messages, request.signal, {
      system: turn.system,
      maxOutputTokens: 2048,
      temperature: 0.6,
    }));
  } catch (error) {
    const userMessage = await failCopilotTurn(turn.userMessageId);
    const message =
      error instanceof TalkUnavailableError ? error.message : 'The AI could not answer just now. Check your connection, then retry.';
    if (!(error instanceof TalkUnavailableError)) console.error('Ask AI failed', error);
    return ndjson(new Blob([line(start), line({ t: 'error', error: message, userMessage })]).stream());
  }

  const prepared = turn;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The browser may go away at any point (Stop, a closed tab): writing to
      // a cancelled stream throws, and that must not skip saving.
      const send = (event: object) => {
        try {
          controller.enqueue(line(event));
        } catch {}
      };
      const close = () => {
        try {
          controller.close();
        } catch {}
      };
      send(start);
      const decoder = new TextDecoder();
      const reader = source.getReader();
      let text = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const piece = decoder.decode(value, { stream: true });
          if (!piece) continue;
          text += piece;
          send({ t: 'delta', text: piece });
        }
      } catch {
        // The provider dropped mid-reply: keep what was said.
      }

      if (request.signal.aborted) {
        // The student pressed Stop or left: nothing is saved.
        await failCopilotTurn(prepared.userMessageId).catch(() => {});
        close();
        return;
      }
      if (!text.trim()) {
        const userMessage = await failCopilotTurn(prepared.userMessageId);
        send({ t: 'error', error: 'The AI sent an empty answer. Retry.', userMessage });
        close();
        return;
      }

      try {
        if (/\[\[PRACTICE/.test(text)) send({ t: 'working', what: 'practice' });
        const finished = await completeCopilotTurn(prepared, text);
        revalidatePath('/ai');
        if (finished) send({ t: 'done', ...finished });
        else send({ t: 'error', error: 'Stopped.' });
      } catch (error) {
        console.error('Ask AI: saving the answer failed', error);
        const userMessage = await failCopilotTurn(prepared.userMessageId).catch(() => undefined);
        send({ t: 'error', error: 'The answer could not be saved. Retry.', userMessage });
      }
      close();
    },
    cancel() {
      void source.cancel().catch(() => {});
    },
  });
  return ndjson(stream);
}

function ndjson(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
