/**
 * A practice run in progress, as stored in AttemptDraft (audit S05, S03).
 *
 * Answers used to live only in the runner's React state, so a sidebar click,
 * a refresh or a crash threw a half-finished mock exam away - and the exam
 * clock restarted from full on every load. The draft row keeps the answers,
 * flags and position, and the exam's deadline as an absolute instant set once
 * on the server, so no reload can buy extra time.
 *
 * Pure: the server action reads/writes the row; this decides what a valid
 * draft is. `node --test` imports it directly.
 */

export type RunMode = 'PRACTICE' | 'EXAM';

export type RunSnapshot = {
  answers: Record<string, string>;
  flags: string[];
  position: number;
};

export type RunDraft = RunSnapshot & {
  /** ISO instant the exam hands itself in; null in practice. */
  deadlineAt: string | null;
};

const MAX_ANSWER = 8000;

/** A mock exam's time allowance: two minutes a question, at least five. */
export function examMinutes(questionCount: number): number {
  return Math.max(5, questionCount * 2);
}

/**
 * Keep only what belongs in this set's draft: answers to its own questions,
 * as strings of sane length; flags on its own questions; a position inside it.
 * A tampered or stale snapshot is narrowed, never trusted.
 */
export function cleanSnapshot(raw: unknown, questionIds: string[]): RunSnapshot {
  const ids = new Set(questionIds);
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof RunSnapshot, unknown>>;

  const answers: Record<string, string> = {};
  if (input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)) {
    for (const [id, value] of Object.entries(input.answers as Record<string, unknown>)) {
      if (ids.has(id) && typeof value === 'string' && value.trim()) answers[id] = value.slice(0, MAX_ANSWER);
    }
  }

  const flags = Array.isArray(input.flags)
    ? [...new Set(input.flags.filter((f): f is string => typeof f === 'string' && ids.has(f)))]
    : [];

  const max = Math.max(0, questionIds.length - 1);
  const position = Number.isInteger(input.position) ? Math.min(max, Math.max(0, input.position as number)) : 0;

  return { answers, flags, position };
}

/** Read a stored draft row's JSON columns back into a snapshot. */
export function readDraft(
  row: { answers: string; flags: string; position: number; deadlineAt: Date | null },
  questionIds: string[]
): RunDraft {
  const parse = (text: string, fallback: unknown) => {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  };
  const snapshot = cleanSnapshot(
    { answers: parse(row.answers, {}), flags: parse(row.flags, []), position: row.position },
    questionIds
  );
  return { ...snapshot, deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null };
}

export function answeredCount(draft: RunSnapshot): number {
  return Object.keys(draft.answers).length;
}
