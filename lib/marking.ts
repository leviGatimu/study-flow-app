/**
 * Marking objective questions - one policy for the instant feedback in the
 * runner and the score the server saves, so they can never disagree.
 *
 * Two rules this module exists to enforce (audit S01, S09):
 *
 * 1. Nothing is ever right because it is CONTAINED in the answer, or contains
 *    it. "a" is not "database"; "not mitochondrion" is not "mitochondrion". A
 *    blank that does not match exactly is UNCERTAIN - the server sends it to
 *    the written marker, where synonyms and spellings can be judged - never
 *    silently right or wrong.
 *
 * 2. Structured answers travel as JSON (a list of chosen options, an order of
 *    items, a term->definition map), never as human-readable delimited text.
 *    Options legitimately contain commas, pipes and colons. Answers saved by
 *    older versions, and expected answers the generator wrote as delimited
 *    text, are read against the question's actual options, so "1,000, 2,000"
 *    is two options and not four fragments.
 *
 * Pure and dependency-free so `node --test` can import it directly.
 */

export type MarkableItem = {
  type: string;
  options: string[];
  items: string[];
  answer: string;
};

export type MarkStatus = 'MARKED' | 'UNCERTAIN';

export type ObjectiveMark = { score: number; status: MarkStatus };

/** Lowercase, drop punctuation that never changes meaning, collapse spaces. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Blanks also ignore a leading article: "the mitochondrion" = "mitochondrion". */
function normaliseBlank(value: string): string {
  return normalise(value).replace(/^(the|a|an) /, '');
}

/** Encode a structured answer for storage. */
export function encodeAnswer(value: string[] | Record<string, string>): string {
  return JSON.stringify(value);
}

function parseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Split delimited legacy text into known values. Fragments are re-joined with
 * the delimiter until they spell a known value, so a delimiter inside a value
 * survives. Fragments that never spell one are kept as typed, so a wrong
 * legacy answer stays wrong rather than vanishing.
 */
function splitKnown(text: string, delimiter: string, known: string[]): string[] {
  const byNorm = new Map(known.map((k) => [normalise(k), k]));
  const fragments = text.split(delimiter);
  const out: string[] = [];
  let i = 0;
  while (i < fragments.length) {
    let matched = false;
    // Longest join first, so "1,000" wins over "1" when both are options.
    for (let j = fragments.length; j > i; j--) {
      const candidate = fragments.slice(i, j).join(delimiter);
      const hit = byNorm.get(normalise(candidate));
      if (hit !== undefined) {
        out.push(hit);
        i = j;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const raw = fragments[i].trim();
      if (raw) out.push(raw);
      i++;
    }
  }
  return out;
}

/** The options chosen in a MULTIPLE_SELECT answer. */
export function decodeSelection(item: MarkableItem, value: string): string[] {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed.map(String);
  return splitKnown(value, ',', item.options);
}

/** The items in order, for ORDERING. */
export function decodeOrder(item: MarkableItem, value: string): string[] {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed.map(String);
  return splitKnown(value, '|', item.items);
}

/** term -> definition, for MATCHING. */
export function decodePairs(item: MarkableItem, value: string): Record<string, string> {
  const parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]));
  }
  // Legacy "term: definition; term: definition". Anchor on the known terms,
  // longest first, because terms and definitions may contain ':' and ';'.
  const terms = [...item.items].sort((a, b) => b.length - a.length);
  const out: Record<string, string> = {};
  let rest = value.trim();
  while (rest) {
    const term = terms.find((t) => normalise(rest).startsWith(normalise(t)) && rest.slice(t.length).trimStart().startsWith(':'));
    if (!term) break;
    rest = rest.slice(term.length).trimStart().slice(1).trimStart();
    // The definition runs until "; <next known term>:" or the end.
    let end = rest.length;
    for (const next of terms) {
      const at = rest.search(new RegExp(`;\\s*${next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`));
      if (at !== -1 && at < end) end = at;
    }
    const definitionText = rest.slice(0, end).trim();
    const definition = item.options.find((o) => normalise(o) === normalise(definitionText)) ?? definitionText;
    out[term] = definition;
    rest = rest.slice(end).replace(/^;\s*/, '');
  }
  return out;
}

/** Mark one objective answer. */
export function markObjective(item: MarkableItem, given: string): ObjectiveMark {
  if (!given.trim()) return { score: 0, status: 'MARKED' };

  switch (item.type) {
    case 'MULTIPLE_SELECT': {
      const want = new Set(decodeSelection(item, item.answer).map(normalise));
      const got = new Set(decodeSelection(item, given).map(normalise));
      if (want.size === 0) return { score: 0, status: 'UNCERTAIN' };
      // All of them and none extra: a partly-right multi-select is wrong.
      const same = want.size === got.size && [...want].every((w) => got.has(w));
      return { score: same ? 100 : 0, status: 'MARKED' };
    }
    case 'ORDERING': {
      const want = decodeOrder(item, item.answer).map(normalise);
      const got = decodeOrder(item, given).map(normalise);
      if (want.length === 0) return { score: 0, status: 'UNCERTAIN' };
      const right = want.filter((w, i) => got[i] === w).length;
      return { score: Math.round((right / want.length) * 100), status: 'MARKED' };
    }
    case 'MATCHING': {
      const want = Object.entries(decodePairs(item, item.answer));
      const got = new Map(Object.entries(decodePairs(item, given)).map(([k, v]) => [normalise(k), normalise(v)]));
      if (want.length === 0) return { score: 0, status: 'UNCERTAIN' };
      const right = want.filter(([term, definition]) => got.get(normalise(term)) === normalise(definition)).length;
      return { score: Math.round((right / want.length) * 100), status: 'MARKED' };
    }
    case 'FILL_IN_THE_BLANK': {
      const want = normaliseBlank(item.answer);
      if (want && normaliseBlank(given) === want) return { score: 100, status: 'MARKED' };
      return { score: 0, status: 'UNCERTAIN' };
    }
    default:
      // MULTIPLE_CHOICE and TRUE_FALSE: exact, after normalising.
      return { score: normalise(given) === normalise(item.answer) ? 100 : 0, status: 'MARKED' };
  }
}

/**
 * The runner's instant verdict: true / false only when the server would
 * certainly agree, null when it will be decided at marking time (written
 * answers, partial-credit types, and blanks that are not an exact match).
 */
export function previewVerdict(item: MarkableItem, given: string): boolean | null {
  if (!given.trim()) return false;
  if (!['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_SELECT', 'FILL_IN_THE_BLANK'].includes(item.type)) return null;
  const mark = markObjective(item, given);
  if (mark.status === 'UNCERTAIN') return null;
  return mark.score >= 100;
}

/** An answer as a person reads it: structured answers are stored as JSON. */
export function formatAnswer(value: string): string {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed.map(String).join(', ');
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([term, definition]) => `${term} → ${String(definition ?? '')}`)
      .join('; ');
  }
  return value;
}

/* ------------------------------------------------------- attempt scoring */

export type ScoredAnswer = {
  id: string;
  score: number;
  isCorrect: boolean;
  feedback: string;
  /** UNMARKED: answered but not yet judged. Absent = marked (older attempts). */
  status?: 'MARKED' | 'UNMARKED';
};

/**
 * FINAL: every answer is marked. PARTIAL: some are waiting for the written
 * marker, so the score covers only the rest. PENDING: nothing could be marked.
 * Only FINAL attempts are evidence of weakness or mastery (audit S02).
 */
export type MarkingStatus = 'FINAL' | 'PARTIAL' | 'PENDING';

export function summariseAttempt(answers: ScoredAnswer[]): {
  score: number;
  correct: number;
  status: MarkingStatus;
  unmarked: number;
} {
  const marked = answers.filter((a) => a.status !== 'UNMARKED');
  const unmarked = answers.length - marked.length;
  const score = marked.length ? Math.round(marked.reduce((sum, a) => sum + a.score, 0) / marked.length) : 0;
  return {
    score,
    correct: marked.filter((a) => a.isCorrect).length,
    status: unmarked === 0 ? 'FINAL' : marked.length === 0 ? 'PENDING' : 'PARTIAL',
    unmarked,
  };
}

/**
 * Apply the written marker's reply to the pending answers, in place. A row
 * that is missing, or has no numeric score, leaves its answer UNMARKED -
 * an unavailable marker is never a zero.
 */
export function applyWrittenMarks(pending: ScoredAnswer[], results: unknown): void {
  const rows: unknown[] = Array.isArray(results) ? results : [];
  for (const raw of rows) {
    const row = raw as { id?: unknown; score?: unknown; feedback?: unknown } | null;
    const target = pending.find((m) => m.id === String(row?.id));
    const value =
      typeof row?.score === 'number' ? row.score : typeof row?.score === 'string' && row.score.trim() ? Number(row.score) : NaN;
    if (!target || !Number.isFinite(value)) continue;
    const score = Math.round(Math.max(0, Math.min(100, value)));
    target.score = score;
    target.isCorrect = score >= 60;
    target.feedback = String(row?.feedback ?? '').slice(0, 1000);
    target.status = 'MARKED';
  }
}
