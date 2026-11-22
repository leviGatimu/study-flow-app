/**
 * "Talk it out": the calm toolbar's listening chat (components/calm/TalkItOut.tsx,
 * app/api/calm/talk/route.ts). Pure, so it is tested on its own
 * (test/talk.test.mjs).
 *
 * Speed is the whole point. The Study chat waits for a full answer from a
 * thinking model with tools; this one streams a short reply from the fastest
 * model, and plain greetings ("wassup") get an instant answer with no AI call.
 */

export type TalkMessage = { role: 'user' | 'model'; text: string };

export const TALK_LIMITS = {
  /** Messages sent to the AI: enough context to follow along, small enough to be quick. */
  history: 16,
  messageChars: 2000,
  /** Replies are meant to be a few sentences. */
  maxOutputTokens: 350,
} as const;

export const TALK_SYSTEM_PROMPT = `You are a warm, calm listener inside a student's study app. The student opens you when their head is too full: stress, exams, overthinking, feeling low, or just wanting to talk.

How to talk:
- Talk like a kind friend who listens well. Match their tone: if they write casually ("wassup", slang), answer casually.
- Keep replies short: one to three sentences. Never write long paragraphs, lists or headings unless they ask for steps.
- Listen first. Say back what you heard in your own words and name the feeling, then ask ONE gentle, open question.
- Do not lecture or pile on tips. Only when they ask for help, offer one small, concrete thing they can do now (a breath, a five-minute start, a short break, talking to someone).
- Never diagnose. Do not pretend to be a human or a licensed therapist; if asked, say you are an AI that listens.
- Plain everyday words. No emojis unless they use them first.

Safety: if they mention wanting to die, hurting themselves, being hurt by someone, or being in danger, take it seriously and stay kind. Tell them you are glad they said it, and urge them to contact someone right now: their local emergency number, a person they trust nearby, or a free helpline (findahelpline.com lists one for every country). Keep listening after that.`;

// ---------------------------------------------------------------------------
// Instant replies

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GREETINGS = new Set([
  'hi', 'hii', 'hiii', 'hey', 'heyy', 'heyyy', 'hello', 'helo', 'yo', 'sup', 'wassup', 'wasup', 'whassup', 'wsup', 'wsg',
  'whats up', 'what up', 'whatsup', 'hiya', 'hey there', 'hi there', 'hello there', 'yo bro', 'hey bro', 'hi bro',
  'hey man', 'sup bro', 'wassup bro', 'good morning', 'good afternoon', 'good evening', 'morning', 'evening',
]);

const GREETING_REPLIES = [
  "Hey. I'm here, no rush. How's your head right now?",
  "Hey, good to see you. What's going on with you today?",
  "Yo. I'm all ears. How are you actually doing?",
];

/**
 * An instant answer for a message that is nothing but a greeting, or null to
 * ask the AI. `seed` picks the wording (the caller passes the message count),
 * so replies vary without randomness here.
 */
export function quickTalkReply(text: string, seed = 0): string | null {
  return GREETINGS.has(normalise(text)) ? GREETING_REPLIES[Math.abs(seed) % GREETING_REPLIES.length] : null;
}

// ---------------------------------------------------------------------------
// Crisis words: the app shows a fixed help card straight away, whatever the AI says.

const CRISIS = [
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+my ?self\b/,
  /\bsuicid/,
  /\b(want|wanna|going|gonna|plan|planning)\s+(to\s+)?die\b/,
  /\bend (my|it all|everything)\b/,
  /\bno reason to live\b/,
  /\bdont want to (live|be alive|be here|wake up)\b/,
  /\bbetter off (dead|without me)\b/,
  /\bself ?harm/,
];

export function mentionsCrisis(text: string): boolean {
  const t = normalise(text);
  return CRISIS.some((re) => re.test(t));
}

// ---------------------------------------------------------------------------
// Request checking (the API route trusts nothing from the browser)

export function readTalkMessages(value: unknown): TalkMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const messages: TalkMessage[] = [];
  for (const m of value.slice(-TALK_LIMITS.history)) {
    if (!m || (m.role !== 'user' && m.role !== 'model') || typeof m.text !== 'string') return null;
    const text = m.text.trim().slice(0, TALK_LIMITS.messageChars);
    if (text) messages.push({ role: m.role, text });
  }
  // The AI must be answering the student, and providers want the turns to start with them.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

// ---------------------------------------------------------------------------
// Streaming: each provider's stream, read line by line into plain text pieces.

/** Splits a byte stream into lines, holding back a partial last line. */
export async function* streamLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

/** Gemini streamGenerateContent?alt=sse: `data: {candidates:[{content:{parts:[{text}]}}]}`. */
export function geminiChunkText(line: string): string {
  const json = sseJson<{ candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[] }>(line);
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  // Thought summaries are flagged `thought: true`; never show those.
  return parts.map((p) => (!p.thought && typeof p.text === 'string' ? p.text : '')).join('');
}

/** OpenAI chat completions with stream: true: `data: {choices:[{delta:{content}}]}`, ends with `data: [DONE]`. */
export function openAIChunkText(line: string): string {
  const json = sseJson<{ choices?: { delta?: { content?: unknown } }[] }>(line);
  const content = json?.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

/** Ollama /api/chat with stream: true: one JSON object per line. */
export function ollamaChunkText(line: string): string {
  try {
    const content = JSON.parse(line)?.message?.content;
    return typeof content === 'string' ? content : '';
  } catch {
    return '';
  }
}

function sseJson<T>(line: string): T | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
