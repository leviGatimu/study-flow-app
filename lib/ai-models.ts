/**
 * Which Gemini model to call, chosen from what the key can actually see.
 *
 * Google retires model ids on its own schedule (gemini-1.5-*, then 2.0, then
 * "gemini-2.5-pro is no longer available to new users"), so a hard-coded
 * preference list goes stale and the app ends up calling whatever the listing
 * happens to put first. Instead, rank the listed models: text-generating ones
 * only, stable before preview, newest version first, Flash before Pro (fast,
 * and the one free keys have quota for). The caller walks this list and moves
 * on when a model answers "not found / no longer available".
 */

export type GeminiListedModel = { name?: string; supportedGenerationMethods?: string[] };

/** Used when the listing itself cannot be fetched; the -latest aliases follow Google's current release. */
export const GEMINI_FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-pro-latest'];

// Variants that cannot hold a normal text chat.
const SPECIALISED = /(embedding|aqa|tts|audio|image|imagen|veo|live|native|robotics|computer-use|learnlm|gemma)/;

function version(name: string) {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function tier(name: string) {
  if (name.includes('flash-lite')) return 1;
  if (name.includes('flash')) return 3;
  if (name.includes('pro')) return 2;
  return 0;
}

const isPreview = (name: string) => /(preview|exp|experimental)/.test(name);
// Free-tier keys get no Pro quota at all ("limit: 0"), so Pro is tried last.
const isPro = (name: string) => name.includes('pro');
const isAlias = (name: string) => name.endsWith('-latest');

/** Model ids (without "models/"), best first. */
export function rankGeminiModels(listed: GeminiListedModel[]): string[] {
  const names = listed
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => m.name?.replace(/^models\//, '') ?? '')
    .filter((name) => name.startsWith('gemini') && !SPECIALISED.test(name));

  return [...new Set(names)].sort((a, b) =>
    Number(isPro(a)) - Number(isPro(b)) ||
    Number(isAlias(b)) - Number(isAlias(a)) ||
    Number(isPreview(a)) - Number(isPreview(b)) ||
    version(b) - version(a) ||
    tier(b) - tier(a) ||
    a.localeCompare(b)
  );
}

const RETIRED = /\b404\b|not found|no longer available|is not supported for generatecontent|deprecated/i;
const QUOTA = /\b429\b|quota|resource.?exhausted|rate.?limit|too many requests/i;
const KEY = /\b(401|403)\b|api key not valid|invalid api key|permission denied|incorrect api key/i;

/**
 * True when the failure belongs to this one model - retired, or out of quota
 * (quotas are per model) - so the next model should be tried.
 */
export function isModelUnavailableError(message: string) {
  return RETIRED.test(message) || QUOTA.test(message);
}

/** One short, plain line per failed attempt, for the message the person sees. */
export function describeAIFailure(model: string, message: string) {
  if (QUOTA.test(message)) return `${model}: no quota left on this key`;
  if (RETIRED.test(message)) return `${model}: no longer offered by the provider`;
  if (KEY.test(message)) return `${model}: the key was rejected`;
  if (/timed? ?out|abort/i.test(message)) return `${model}: took too long to answer`;
  return `${model}: ${message.replace(/\s+/g, ' ').slice(0, 140)}`;
}

/** OpenAI chat models only (no image, audio, embedding, moderation or search variants), preferred ones first. */
const OPENAI_NON_CHAT = /(audio|realtime|tts|transcribe|image|dall-e|whisper|embedding|moderation|search|instruct|davinci|babbage|codex|computer-use|deep-research)/;
export function rankOpenAIModels(ids: string[], preferred: string[] = []): string[] {
  const chat = [...new Set(ids)].filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !OPENAI_NON_CHAT.test(id));
  const rank = (id: string) => { const i = preferred.indexOf(id); return i === -1 ? preferred.length : i; };
  // Undated ids ("gpt-4o-mini") before dated snapshots ("gpt-4o-mini-2024-07-18").
  const dated = (id: string) => Number(/\d{4}-\d{2}-\d{2}$/.test(id));
  return chat.sort((a, b) => rank(a) - rank(b) || dated(a) - dated(b) || b.localeCompare(a));
}
