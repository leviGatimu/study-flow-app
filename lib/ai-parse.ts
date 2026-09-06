/**
 * Parsing and validating what a model gives back.
 *
 * A plain module, not a 'use server' one, so it can export ordinary functions
 * and be unit-tested. lib/ai-actions.ts had a good parser (parseJsonLoose) and
 * a good validator (sanitizePlan) locked inside it, while four other call
 * sites re-implemented a weaker "strip fences then JSON.parse" and then wrote
 * the result straight to the database.
 *
 * That mattered: uploadReportCard mapped model output directly into
 * subjectGrade.createMany with no check that the fields were even strings, so
 * a hallucinated or malformed grade became a permanent academic record. The
 * rule here is that model output is untrusted input until it has been shaped.
 */

/**
 * Parse JSON out of a model response, tolerating the three things models
 * actually do: wrap it in a ```json fence, pad it with prose, or both.
 * Returns null rather than throwing - callers decide what a failure means.
 */
export function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  // Otherwise slice from the first { to the last } to drop any chatter.
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const firstObj = text.indexOf('{');
    const firstArr = text.indexOf('[');
    const first =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
    const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A trimmed string, or null if the value is not a usable one. */
export function asString(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** A finite number within bounds, or null. Accepts numeric strings, which
 *  models return constantly despite being asked for numbers. */
export function asNumber(value: unknown, min = -Infinity, max = Infinity): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export type ParsedGrade = {
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
};

/**
 * Keep only the grade rows that are actually usable.
 *
 * Drops malformed entries rather than failing the whole upload - a report card
 * where nine subjects parsed and one did not is still worth saving - but
 * returns the count dropped so the caller can tell the user rather than
 * silently losing a subject.
 *
 * `aiFeedback` is NOT NULL in the schema, so it is defaulted rather than
 * allowed to fail the insert.
 */
export function sanitizeGrades(raw: unknown): { grades: ParsedGrade[]; dropped: number } {
  if (!Array.isArray(raw)) return { grades: [], dropped: 0 };

  const grades: ParsedGrade[] = [];
  let dropped = 0;

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      dropped++;
      continue;
    }
    const row = entry as Record<string, unknown>;

    const subject = asString(row.subject, 200);
    // A grade can legitimately be a number ("85") or a letter ("A").
    const grade = asString(row.grade, 50) ?? (asNumber(row.grade) !== null ? String(row.grade) : null);

    if (!subject || !grade) {
      dropped++;
      continue;
    }

    grades.push({
      subject,
      grade,
      status: asString(row.status, 100) ?? 'Recorded',
      aiFeedback: asString(row.aiFeedback ?? row.feedback, 4000) ?? '',
    });
  }

  return { grades, dropped };
}

export type ParsedQuestion = {
  question: string;
  type: string;
  options: string[];
  answer: string;
  explanation: string;
};

const QUESTION_TYPES = new Set(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'TRUE_FALSE', 'ESSAY']);

/**
 * Keep only questions the quiz UI can actually render.
 *
 * The specific failure this prevents: a MULTIPLE_CHOICE question with no
 * options array. TutorHub renders `(q.options || [])`, so it showed a
 * multiple-choice question with no choices and no way to answer it.
 */
export function sanitizeQuestions(raw: unknown): { questions: ParsedQuestion[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.questions) ? (raw as any).questions : null;
  if (!list) return { questions: [], dropped: 0 };

  const questions: ParsedQuestion[] = [];
  let dropped = 0;

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      dropped++;
      continue;
    }
    const row = entry as Record<string, unknown>;

    const question = asString(row.question, 4000);
    if (!question) {
      dropped++;
      continue;
    }

    const rawType = asString(row.type, 50)?.toUpperCase().replace(/[\s-]/g, '_') ?? '';
    const type = QUESTION_TYPES.has(rawType) ? rawType : 'SHORT_ANSWER';

    const options = Array.isArray(row.options)
      ? row.options.map((o) => asString(o, 500)).filter((o): o is string => o !== null)
      : [];

    // A multiple-choice question needs something to choose between.
    if (type === 'MULTIPLE_CHOICE' && options.length < 2) {
      dropped++;
      continue;
    }

    questions.push({
      question,
      type,
      options,
      answer: asString(row.answer, 2000) ?? '',
      explanation: asString(row.explanation, 4000) ?? '',
    });
  }

  return { questions, dropped };
}
