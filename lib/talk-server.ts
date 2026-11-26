import { prisma } from '@/lib/prisma';
import {
  geminiChunkText,
  ollamaChunkText,
  openAIChunkText,
  streamLines,
  TALK_LIMITS,
  TALK_SYSTEM_PROMPT,
  type TalkMessage,
} from '@/lib/talk';

/**
 * The fast path behind "Talk it out". Unlike askAIBuddy it does not list the
 * key's models first (a whole extra round trip), uses no tools, saves nothing,
 * and streams: the first words show while the rest is still being written.
 */

// Lite first: no thinking step, so the first words arrive in well under a second.
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
const OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/** How long a provider may take to START answering before the next one is tried. */
const FIRST_BYTE_MS = { cloud: 15_000, ollama: 4_000 };

type Attempt = { label: string; open: (signal: AbortSignal) => Promise<Response>; chunk: (line: string) => string };

/** What to tell the model and how long it may answer. Defaults are Talk it out's. */
export type TalkOptions = { system?: string; maxOutputTokens?: number; temperature?: number };
type Settings = { system: string; maxOutputTokens: number; temperature: number };

export class TalkUnavailableError extends Error {}

export async function openTalkStream(
  userId: string,
  messages: TalkMessage[],
  signal: AbortSignal,
  options: TalkOptions = {},
): Promise<{ provider: string; stream: ReadableStream<Uint8Array> }> {
  const settings: Settings = {
    system: options.system ?? TALK_SYSTEM_PROMPT,
    maxOutputTokens: options.maxOutputTokens ?? TALK_LIMITS.maxOutputTokens,
    temperature: options.temperature ?? 0.8,
  };
  const progress = await prisma.userProgress.findUnique({
    where: { userId },
    select: {
      geminiApiKey: true,
      openaiApiKey: true,
      primaryAiProvider: true,
      ollamaEnabled: true,
      ollamaBaseUrl: true,
      ollamaModel: true,
    },
  });

  const gemini = progress?.geminiApiKey?.trim();
  const openai = progress?.openaiApiKey?.trim();
  const cloud: Attempt[] = [];
  const geminiAttempts = gemini ? GEMINI_MODELS.map((model) => geminiAttempt(gemini, model, messages, settings)) : [];
  const openaiAttempts = openai ? [openAIAttempt(openai, messages, settings)] : [];
  if (progress?.primaryAiProvider === 'openai') cloud.push(...openaiAttempts, ...geminiAttempts);
  else cloud.push(...geminiAttempts, ...openaiAttempts);

  const local = progress?.ollamaEnabled
    ? [ollamaAttempt(progress.ollamaBaseUrl, progress.ollamaModel, messages, settings)]
    : [];
  const attempts = progress?.primaryAiProvider === 'ollama' ? [...local, ...cloud] : [...cloud, ...local];

  if (attempts.length === 0) {
    throw new TalkUnavailableError('No AI is set up yet. Add a Gemini or OpenAI key in Settings > AI.');
  }

  const failures: string[] = [];
  for (const attempt of attempts) {
    if (signal.aborted) break;
    // The start-up timeout must only cover the wait for the first byte, so it
    // is cleared once the provider answers: a long reply is never cut off.
    const controller = new AbortController();
    const stopOnLeave = () => controller.abort();
    signal.addEventListener('abort', stopOnLeave, { once: true });
    const timer = setTimeout(
      () => controller.abort(),
      attempt.label.startsWith('Ollama') ? FIRST_BYTE_MS.ollama : FIRST_BYTE_MS.cloud,
    );
    try {
      const response = await attempt.open(controller.signal);
      clearTimeout(timer);
      if (!response.ok || !response.body) {
        failures.push(`${attempt.label}: ${response.status}`);
        signal.removeEventListener('abort', stopOnLeave);
        continue;
      }
      return { provider: attempt.label, stream: toTextStream(response.body, attempt.chunk) };
    } catch (error) {
      clearTimeout(timer);
      signal.removeEventListener('abort', stopOnLeave);
      failures.push(`${attempt.label}: ${error instanceof Error ? error.name : 'failed'}`);
    }
  }
  console.warn(`Talk it out: every AI failed (${failures.join('; ')})`);
  throw new TalkUnavailableError(
    failures.some((f) => f.endsWith(': 429'))
      ? 'Your AI key has run out of free messages for now. Try again later, or add another key in Settings > AI.'
      : 'The AI is not answering right now. Check your internet, or try again in a minute.',
  );
}

function toTextStream(body: ReadableStream<Uint8Array>, chunk: (line: string) => string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = streamLines(body);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const next = await lines.next();
          if (next.done) {
            controller.close();
            return;
          }
          const text = chunk(next.value);
          if (text) {
            controller.enqueue(encoder.encode(text));
            return;
          }
        }
      } catch {
        // The provider dropped mid-reply: keep what was said.
        controller.close();
      }
    },
    async cancel() {
      await lines.return(undefined);
    },
  });
}

function geminiAttempt(key: string, model: string, messages: TalkMessage[], settings: Settings): Attempt {
  return {
    label: `Gemini ${model}`,
    chunk: geminiChunkText,
    open: (signal) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: settings.system }] },
          contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          generationConfig: { maxOutputTokens: settings.maxOutputTokens, temperature: settings.temperature },
        }),
      }),
  };
}

function openAIAttempt(key: string, messages: TalkMessage[], settings: Settings): Attempt {
  return {
    label: `OpenAI ${OPENAI_MODEL}`,
    chunk: openAIChunkText,
    open: (signal) =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          stream: true,
          max_tokens: settings.maxOutputTokens,
          temperature: settings.temperature,
          messages: [
            { role: 'system', content: settings.system },
            ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
          ],
        }),
      }),
  };
}

function ollamaAttempt(baseUrl: string | null, model: string | null, messages: TalkMessage[], settings: Settings): Attempt {
  const url = (baseUrl?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  return {
    label: 'Ollama (offline)',
    chunk: ollamaChunkText,
    open: async (signal) => {
      // No model chosen in Settings: use the first one installed.
      let name = model?.trim();
      if (!name) {
        const tags = await fetch(`${url}/api/tags`, { signal, cache: 'no-store' });
        name = tags.ok ? (await tags.json())?.models?.[0]?.name : undefined;
        if (!name) return new Response(null, { status: 503 });
      }
      return fetch(`${url}/api/chat`, {
        method: 'POST',
        signal,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: name,
          stream: true,
          options: { num_predict: settings.maxOutputTokens, temperature: settings.temperature },
          messages: [
            { role: 'system', content: settings.system },
            ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
          ],
        }),
      });
    },
  };
}
