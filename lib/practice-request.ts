/**
 * The Study chat's practice requests, as plain functions (no Prisma, no
 * `@/` imports) so test/practice-request.test.mjs can run them directly.
 *
 * The model asks for a practice set by ending its reply with
 *   [[PRACTICE {"subject":"...","topic":"...","count":10,"style":"MIXED"}]]
 * and the saved reply keeps a reference to the set it made instead:
 *   [[practice:<setId>]]
 */

export type PracticeStyle = 'MIXED' | 'MULTIPLE_CHOICE' | 'WRITTEN' | 'TRUE_FALSE';

const REQUEST = /\[\[PRACTICE\s*(\{[\s\S]*?\})\s*\]\]/;
const REFERENCE = /\[\[practice:([A-Za-z0-9_-]{1,64})\]\]/g;
const STYLES: PracticeStyle[] = ['MIXED', 'MULTIPLE_CHOICE', 'WRITTEN', 'TRUE_FALSE'];

export type ParsedPracticeRequest =
  | { kind: 'none' }
  | { kind: 'invalid'; before: string; reason: string }
  | { kind: 'request'; before: string; subject: string; topic: string; count: number; style: PracticeStyle };

/**
 * Read a request line out of a reply. `subjects` are the student's own
 * subject names: a close match is used so the set files under it.
 */
export function parsePracticeRequest(text: string, subjects: string[]): ParsedPracticeRequest {
  const match = text.match(REQUEST);
  if (!match) return { kind: 'none' };
  const before = text.replace(REQUEST, '').trimEnd();

  let raw: { subject?: unknown; topic?: unknown; count?: unknown; style?: unknown };
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return { kind: 'invalid', before, reason: 'I could not set that practice up. Ask again and name the topic.' };
  }
  const topic = String(raw.topic ?? '').trim().slice(0, 300);
  if (!topic) return { kind: 'invalid', before, reason: 'Tell me which topic to test you on and I will make the practice.' };

  const asked = String(raw.subject ?? '').trim();
  const lower = asked.toLowerCase();
  const subject =
    subjects.find((s) => s.toLowerCase() === lower) ??
    (lower ? subjects.find((s) => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())) : undefined) ??
    (asked || topic).slice(0, 120);

  const count = Math.max(5, Math.min(20, Math.round(Number(raw.count) || 10)));
  const style = STYLES.includes(raw.style as PracticeStyle) ? (raw.style as PracticeStyle) : 'MIXED';
  return { kind: 'request', before, subject, topic, count, style };
}

/** The reference line saved in place of a request. */
export const practiceReference = (setId: string) => `[[practice:${setId}]]`;

/** Lift the practice references out of a saved reply. */
export function splitPracticeRefs(content: string): { text: string; practiceIds: string[] } {
  const practiceIds = [...content.matchAll(REFERENCE)].map((m) => m[1]);
  return { text: practiceIds.length ? content.replace(REFERENCE, '').trimEnd() : content, practiceIds };
}

/** What the model sees of an earlier reply: the reference as plain words. */
export function practiceRefsForModel(content: string): string {
  return content.replace(REFERENCE, '(A practice set was made.)');
}
