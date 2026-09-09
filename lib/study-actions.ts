'use server';

/**
 * Turn a document into questions, then mark the answers.
 *
 * THREE DECISIONS WORTH KNOWING BEFORE CHANGING ANYTHING HERE.
 *
 * 1. GENERATION IS BATCHED. askAIBuddy gives up after 60 seconds, and asking one
 *    model call for 40 well-formed questions reliably exceeds that. So a request
 *    is split into batches of at most BATCH_SIZE, run in sequence, and whatever
 *    arrives is kept. A student who asked for 20 and got 17 is told that, which
 *    is far better than losing the 17 to an error page.
 *
 * 2. MARKING IS SPLIT. Everything a student answers by CHOOSING - multiple
 *    choice, true/false, multi-select, ordering, matching, fill-in-the-blank -
 *    is marked here in code: instant, free, deterministic, and it works with no
 *    API key at all. Only genuinely written answers go to the model, and they go
 *    in ONE batched call rather than one per question. The version of this that
 *    was deleted sent everything to the AI and took a minute to mark a quiz.
 *
 * 3. THE SOURCE FILE IS NEVER STORED. Text is extracted in the browser and only
 *    the text arrives here. `sourcePdfUrl` holds the file's NAME, which is what
 *    that column has always meant despite what it is called.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { byClass, getViewScope, requireClassStamp, ARCHIVE_WRITE_ERROR } from '@/lib/scope';
import { askAIBuddy } from '@/lib/ai-actions';
import { parseJsonLoose, sanitizeQuestions, OBJECTIVE_TYPES, type ParsedQuestion } from '@/lib/ai-parse';
import { grantXp } from '@/lib/gamification';

/** Questions per model call. See decision 1 above. */
const BATCH_SIZE = 10;
const MAX_QUESTIONS = 40;
const MIN_QUESTIONS = 3;
/** Characters of source text sent with each batch. */
const CONTEXT_CHARS = 24_000;

export type StudyItem = ParsedQuestion & { id: string };

export type StudySetSummary = {
  id: string;
  title: string;
  subject: string;
  sourceName: string | null;
  itemCount: number;
  cardCount: number;
  bestScore: number | null;
  lastScore: number | null;
  attempts: number;
  createdAt: Date;
};

export type StudySetDetail = {
  id: string;
  title: string;
  subject: string;
  sourceName: string | null;
  items: StudyItem[];
  cards: Flashcard[];
  hasSourceText: boolean;
  attempts: {
    id: string;
    mode: string;
    score: number;
    createdAt: Date;
  }[];
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  /** SM-2 state, so a card the student found hard comes back sooner. */
  interval: number;
  repetition: number;
  efactor: number;
  nextReviewAt: string | null;
};

/* ------------------------------------------------------------------ prompts */

/**
 * What each question type must contain to be answerable.
 *
 * Inherited almost verbatim from the deleted AI Tutor, which had already been
 * through the cycle of a model returning a MATCHING question whose columns
 * lined up in order (so the answer was "match row 1 to row 1") and a
 * MULTIPLE_CHOICE with the correct option always first.
 */
const TYPE_SPEC = `Every question object has "type", "question", "expectedAnswer" and "explanation". Per type, also:
- "MULTIPLE_CHOICE": "options" — exactly 4 distinct strings. "expectedAnswer" is the exact text of the correct option. Vary which position is correct.
- "MULTIPLE_SELECT": "options" — 4 or 5 strings with TWO OR MORE correct. "expectedAnswer" lists every correct option's exact text, comma separated.
- "TRUE_FALSE": "question" is a statement. "expectedAnswer" is exactly "True" or "False". No options.
- "FILL_IN_THE_BLANK": "question" contains "____". "expectedAnswer" is the missing word or short phrase.
- "SHORT_ANSWER": "expectedAnswer" is a model answer of one or two sentences.
- "OPEN_ENDED": "expectedAnswer" is a model answer of a full paragraph.
- "MATCHING": "terms" and "definitions", the SAME length, and "definitions" MUST be shuffled so they do not line up with "terms". "expectedAnswer" is "Term: definition; Term2: definition2".
- "ORDERING": "items", given SHUFFLED. "expectedAnswer" is the correct sequence joined with " | ".
"explanation" says WHY the answer is right, in one or two sentences. It is shown after the student answers, so it must teach rather than restate.`;

/** The four things a student can ask for, mapped onto the eight types. */
export type StudyStyle = 'MULTIPLE_CHOICE' | 'WRITTEN' | 'MIXED' | 'TRUE_FALSE';

const STYLE_SPEC: Record<StudyStyle, string> = {
  MULTIPLE_CHOICE:
    'Use ONLY selection types: mostly MULTIPLE_CHOICE, with the occasional MULTIPLE_SELECT.',
  TRUE_FALSE: 'Use ONLY TRUE_FALSE and FILL_IN_THE_BLANK, roughly half and half.',
  WRITTEN: 'Use ONLY written-response types: SHORT_ANSWER, OPEN_ENDED and FILL_IN_THE_BLANK.',
  MIXED:
    'Use a varied mix of ALL eight types, so that no two consecutive questions share a type. Favour MULTIPLE_CHOICE and SHORT_ANSWER, and include at least one MATCHING or ORDERING if the material suits it.',
};

/* --------------------------------------------------------------- generation */

export async function generateStudySet(input: {
  subject: string;
  title?: string;
  sourceName: string;
  text?: string;
  image?: { data: string; mimeType: string };
  count: number;
  style: StudyStyle;
  instructions?: string;
}): Promise<
  | { success: true; setId: string; generated: number; requested: number; dropped: number }
  | { error: string }
> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const subject = input.subject.trim().slice(0, 120);
  if (!subject) return { error: 'Pick a subject first.' };

  const source = (input.text ?? '').trim();
  if (!source && !input.image) {
    return { error: 'Upload a document, or paste some material to work from.' };
  }

  const requested = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.round(input.count)));

  // Writing into a finished year is refused, and requireClassStamp throws to say
  // so. Catch it here: a thrown error would reach the student as a blank failure
  // after they had already waited for a generation.
  let stamp: { classId?: string };
  try {
    stamp = await requireClassStamp(userId);
  } catch {
    return { error: ARCHIVE_WRITE_ERROR };
  }

  const material = source.slice(0, CONTEXT_CHARS);
  const items: StudyItem[] = [];
  let dropped = 0;
  let lastError: string | null = null;

  for (let made = 0; made < requested; made += BATCH_SIZE) {
    const want = Math.min(BATCH_SIZE, requested - made);

    // Later batches are told what already exists. Without this each call sees
    // the same document and cheerfully writes the same questions again.
    const avoid = items.length
      ? `\n\nYou have ALREADY written these questions. Do not repeat or rephrase any of them:\n${items
          .map((q) => `- ${q.question}`)
          .join('\n')}`
      : '';

    const system = `You write exam questions from a student's own study material.

Return ONLY one valid JSON object. No prose, no markdown fences:
{ "title": "a short title for this set", "questions": [ ... ${want} question objects ... ] }

${TYPE_SPEC}

${STYLE_SPEC[input.style]}

Rules:
- Exactly ${want} questions.
- Every question must be answerable from the material provided. Never invent facts that are not in it.
- Test understanding, not recall of the exact wording.
- Distractors must be plausible to somebody who half-knows the topic.
- Keep each question self-contained: no "as mentioned above".
- Write the questions in the SAME LANGUAGE as the material. If the document is in French, so are the questions.`;

    const prompt = input.image
      ? `The material is in the attached image. Subject: ${subject}.${
          input.instructions ? `\n\nThe student asked you to focus on: "${input.instructions}".` : ''
        }${avoid}\n\nProduce the JSON now.`
      : `Material for ${subject}:\n"""\n${material}\n"""${
          input.instructions ? `\n\nThe student asked you to focus on: "${input.instructions}".` : ''
        }${avoid}\n\nProduce the JSON now.`;

    // tools: false is not optional. FUNCTION_TOOLS is attached to every
    // provider by default and executeTool really writes a Task - a document
    // containing "revision Monday 17:00-18:30" is a plausible trigger for the
    // model to schedule something while it is supposed to be writing questions.
    // xp: false because generation is batched: five calls would mint 100 XP
    // before the student answered anything. The attempt grants its own.
    const result = await askAIBuddy(prompt, [], undefined, input.image, system, {
      tools: false,
      xp: false,
    });
    if (result.error) {
      lastError = result.error;
      break;
    }

    const parsed = parseJsonLoose(result.text || '');
    const clean = sanitizeQuestions(parsed);
    dropped += clean.dropped;

    if (clean.questions.length === 0) {
      lastError = 'The model did not return any usable questions.';
      break;
    }

    for (const q of clean.questions.slice(0, want)) {
      items.push({ ...q, id: `q${items.length + 1}` });
    }

    if (!input.title && !items.length) break;
  }

  if (items.length === 0) {
    return { error: lastError ?? 'Nothing could be generated from that document.' };
  }

  const title =
    input.title?.trim().slice(0, 120) ||
    `${subject} · ${input.sourceName.replace(/\.[^.]+$/, '').slice(0, 60)}`;

  const set = await prisma.tutorModule.create({
    data: {
      userId,
      ...stamp,
      subject,
      title,
      sourcePdfUrl: input.sourceName.slice(0, 200),
      // Kept so more questions can be generated later without re-uploading.
      sourceText: source.slice(0, CONTEXT_CHARS) || null,
      config: JSON.stringify({ count: requested, style: input.style, instructions: input.instructions ?? '' }),
      questions: JSON.stringify(items),
      // SQLite cannot take a column default from an ALTER, so these are supplied
      // explicitly rather than relying on the Postgres defaults. Both databases
      // end up with the same values; only the source of them differs.
      notes: '',
      videos: '',
      exercises: '',
      flashcards: '[]',
    },
    select: { id: true },
  });

  revalidatePath('/ai');
  return { success: true, setId: set.id, generated: items.length, requested, dropped };
}

/* ------------------------------------------------------------------ reading */

export async function listStudySets(): Promise<StudySetSummary[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const sets = await prisma.tutorModule.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      subject: true,
      sourcePdfUrl: true,
      questions: true,
      flashcards: true,
      createdAt: true,
      attempts: { select: { score: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  return sets.map((s) => {
    const scores = s.attempts.map((a) => a.score);
    return {
      id: s.id,
      title: s.title,
      subject: s.subject,
      sourceName: s.sourcePdfUrl,
      itemCount: countJson(s.questions),
      cardCount: countJson(s.flashcards),
      bestScore: scores.length ? Math.max(...scores) : null,
      lastScore: scores.length ? scores[0] : null,
      attempts: scores.length,
      createdAt: s.createdAt,
    };
  });
}

function countJson(raw: string): number {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function getStudySet(setId: string): Promise<StudySetDetail | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const set = await prisma.tutorModule.findFirst({
    where: { id: setId, userId },
    select: {
      id: true,
      title: true,
      subject: true,
      sourcePdfUrl: true,
      questions: true,
      flashcards: true,
      sourceText: true,
      attempts: {
        select: { id: true, mode: true, score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!set) return null;

  return {
    id: set.id,
    title: set.title,
    subject: set.subject,
    sourceName: set.sourcePdfUrl,
    items: readItems(set.questions),
    // Due cards first. Ordered here rather than in the browser because reading
    // the clock during a render is impure, and because the server's clock is
    // the one the schedule was written against.
    cards: dueFirst(readCards(set.flashcards)),
    hasSourceText: Boolean(set.sourceText?.trim()),
    attempts: set.attempts,
  };
}

function readItems(raw: string): StudyItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((q, i) => ({
      id: typeof q?.id === 'string' ? q.id : `q${i + 1}`,
      question: String(q?.question ?? ''),
      type: String(q?.type ?? 'SHORT_ANSWER'),
      options: Array.isArray(q?.options) ? q.options.map(String) : [],
      items: Array.isArray(q?.items) ? q.items.map(String) : [],
      answer: String(q?.answer ?? ''),
      explanation: String(q?.explanation ?? ''),
    }));
  } catch {
    return [];
  }
}

/** Cards the student is about to forget, then the rest. */
function dueFirst(cards: Flashcard[]): Flashcard[] {
  const now = Date.now();
  const due = cards.filter((c) => !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now);
  const later = cards.filter((c) => c.nextReviewAt && new Date(c.nextReviewAt).getTime() > now);
  return [...due, ...later];
}

function readCards(raw: string): Flashcard[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c, i) => ({
      id: typeof c?.id === 'string' ? c.id : `c${i + 1}`,
      front: String(c?.front ?? ''),
      back: String(c?.back ?? ''),
      interval: Number(c?.interval ?? 0),
      repetition: Number(c?.repetition ?? 0),
      efactor: Number(c?.efactor ?? 2.5),
      nextReviewAt: typeof c?.nextReviewAt === 'string' ? c.nextReviewAt : null,
    }));
  } catch {
    return [];
  }
}

export async function deleteStudySet(setId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const { softDelete } = await import('@/lib/soft-delete');
  await softDelete(prisma, 'tutorModule', { id: setId, userId });

  revalidatePath('/ai');
  return { success: true };
}

/* ------------------------------------------------------------------ marking */

export type MarkedAnswer = {
  id: string;
  question: string;
  type: string;
  given: string;
  expected: string;
  explanation: string;
  isCorrect: boolean;
  /** 0-100 for written answers; 0 or 100 for objective ones. */
  score: number;
  feedback: string;
};

export type AttemptResult = {
  attemptId: string;
  score: number;
  correct: number;
  total: number;
  answers: MarkedAnswer[];
  /** Set when written answers could not be marked because there is no AI. */
  notice: string | null;
  xp: { granted: number; leveledUp: boolean } | null;
};

/** Lowercase, collapse whitespace, drop punctuation that never changes meaning. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split an answer that lists several things. */
function parts(value: string, separator: RegExp): string[] {
  return value
    .split(separator)
    .map((p) => normalise(p))
    .filter(Boolean);
}

/**
 * Mark one objective answer without asking anybody.
 *
 * Returns a 0-100 score rather than a boolean because MATCHING and ORDERING are
 * genuinely partial - getting three pairs right out of four is not the same as
 * getting none, and marking it wrong outright teaches the student nothing.
 */
function markObjective(item: StudyItem, given: string): number {
  const expected = item.answer;

  switch (item.type) {
    case 'MULTIPLE_SELECT': {
      const want = new Set(parts(expected, /,/));
      const got = new Set(parts(given, /,/));
      if (want.size === 0) return 0;
      // All of them and none extra: a partly-right multi-select is wrong.
      const same = want.size === got.size && [...want].every((w) => got.has(w));
      return same ? 100 : 0;
    }
    case 'ORDERING': {
      const want = parts(expected, /\|/);
      const got = parts(given, /\|/);
      if (want.length === 0) return 0;
      const right = want.filter((w, i) => got[i] === w).length;
      return Math.round((right / want.length) * 100);
    }
    case 'MATCHING': {
      const want = new Map(
        parts(expected, /;/).map((pair) => {
          const [term, definition] = pair.split(':');
          return [normalise(term ?? ''), normalise(definition ?? '')];
        })
      );
      const got = new Map(
        parts(given, /;/).map((pair) => {
          const [term, definition] = pair.split(':');
          return [normalise(term ?? ''), normalise(definition ?? '')];
        })
      );
      if (want.size === 0) return 0;
      let right = 0;
      for (const [term, definition] of want) if (got.get(term) === definition) right++;
      return Math.round((right / want.size) * 100);
    }
    case 'FILL_IN_THE_BLANK': {
      const want = normalise(expected);
      const got = normalise(given);
      // A blank is one word or a short phrase; accept it inside a fuller answer
      // so "the mitochondrion" is not marked wrong against "mitochondrion".
      return want && (got === want || got.includes(want) || want.includes(got)) ? 100 : 0;
    }
    default:
      // MULTIPLE_CHOICE and TRUE_FALSE: exact, after normalising.
      return normalise(given) === normalise(expected) ? 100 : 0;
  }
}

/**
 * Mark a run and record it.
 *
 * Objective questions never reach the model. Written ones go up in a single
 * call, and if that fails - no key, offline, a timeout - the attempt is still
 * saved with the objective part marked and the student is told plainly which
 * questions could not be marked. Losing a finished quiz to a network error
 * would be the worst possible moment to fail.
 */
export async function submitAttempt(input: {
  setId: string;
  mode: 'PRACTICE' | 'EXAM';
  answers: { id: string; answer: string }[];
  durationSec?: number;
}): Promise<AttemptResult | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const set = await prisma.tutorModule.findFirst({
    where: { id: input.setId, userId },
    select: { id: true, subject: true, questions: true, classId: true },
  });
  if (!set) return { error: 'That set is gone.' };

  const items = readItems(set.questions);
  if (items.length === 0) return { error: 'That set has no questions.' };

  const givenBy = new Map(input.answers.map((a) => [a.id, a.answer]));
  const marked: MarkedAnswer[] = [];
  const written: StudyItem[] = [];

  for (const item of items) {
    const given = (givenBy.get(item.id) ?? '').trim();

    // A blank is the one "objective" type that is not really objective:
    // synonyms, plurals and spellings all mean the same thing to a marker and
    // not to string equality. So a MISS is treated as uncertain and sent to the
    // model with the written answers - it costs nothing extra, the call is
    // already being made, and marking a correct answer wrong is the one
    // mistake a quiz app never recovers from. A hit is still marked here.
    const uncertainBlank =
      item.type === 'FILL_IN_THE_BLANK' && given !== '' && markObjective(item, given) === 0;

    if (OBJECTIVE_TYPES.has(item.type) && !uncertainBlank) {
      const score = given ? markObjective(item, given) : 0;
      marked.push({
        id: item.id,
        question: item.question,
        type: item.type,
        given,
        expected: item.answer,
        explanation: item.explanation,
        isCorrect: score >= 100,
        score,
        feedback: '',
      });
    } else {
      written.push(item);
      marked.push({
        id: item.id,
        question: item.question,
        type: item.type,
        given,
        expected: item.answer,
        explanation: item.explanation,
        isCorrect: false,
        score: 0,
        feedback: '',
      });
    }
  }

  let notice: string | null = null;

  if (written.length > 0) {
    const answered = written.filter((w) => (givenBy.get(w.id) ?? '').trim());
    if (answered.length === 0) {
      notice = null; // nothing written was attempted; nothing to mark
    } else {
      const payload = answered.map((w) => ({
        id: w.id,
        question: w.question,
        expectedAnswer: w.answer,
        studentAnswer: givenBy.get(w.id) ?? '',
      }));

      const system = `You mark a student's written answers. Be fair but not generous: reward understanding, not keywords.

Return ONLY this JSON, no prose:
{ "results": [ { "id": string, "score": number 0-100, "feedback": string } ] }

Judge each answer against the model answer on conceptual accuracy and completeness. A correct idea in clumsy words scores well; fluent words with the wrong idea do not. "feedback" is one or two sentences addressed to the student, saying what was missing or wrong. Never just repeat the model answer.`;

      const result = await askAIBuddy(
        `Mark these:\n${JSON.stringify(payload, null, 2)}`,
        [],
        undefined,
        undefined,
        system,
        { tools: false, xp: false }
      );

      const parsed = result.error ? null : parseJsonLoose(result.text || '');
      const results = Array.isArray(parsed?.results) ? parsed.results : null;

      if (!results) {
        notice =
          written.length === items.length
            ? 'Your written answers could not be marked automatically — the AI was unavailable. Compare them with the model answers below.'
            : 'The written questions could not be marked automatically. Everything else is scored.';
      } else {
        for (const row of results) {
          const target = marked.find((m) => m.id === String(row?.id));
          if (!target) continue;
          const score = Math.max(0, Math.min(100, Number(row?.score) || 0));
          target.score = score;
          target.isCorrect = score >= 60;
          target.feedback = String(row?.feedback ?? '').slice(0, 1000);
        }
      }
    }
  }

  const total = marked.length;
  const score = Math.round(marked.reduce((sum, m) => sum + m.score, 0) / total);
  const correct = marked.filter((m) => m.isCorrect).length;

  const attempt = await prisma.quizAttempt.create({
    data: {
      moduleId: set.id,
      mode: input.mode,
      score,
      feedback: JSON.stringify(marked),
      // Inherited from the set, which is how insights-actions reaches it.
      classId: set.classId,
    },
    select: { id: true },
  });

  await prisma.tutorModule.update({
    where: { id: set.id },
    data: {
      score,
      understanding: score >= 86 ? 'Master' : score >= 51 ? 'Intermediate' : 'Beginner',
      lastReviewedAt: new Date(),
      // The weaker the result, the sooner it should come back.
      nextReviewAt: new Date(Date.now() + (score >= 90 ? 7 : score >= 60 ? 3 : 1) * 86400000),
    },
  });

  // Keyed on the attempt row, so a replay or a sync merge cannot pay twice.
  //
  // Scaled by length as well as score, because the key only stops the SAME
  // attempt paying twice - nothing stops a student generating a one-question
  // set and retaking it. A flat rate would make that the fastest XP in the app.
  const weight = Math.min(total, 20) / 20;
  const xpInfo = await grantXp(
    userId,
    Math.max(5, Math.round((20 + score * 0.5) * weight)),
    'QUIZ',
    `quiz:${attempt.id}`
  );

  revalidatePath('/ai');
  revalidatePath('/insights');

  return {
    attemptId: attempt.id,
    score,
    correct,
    total,
    answers: marked,
    notice,
    xp: xpInfo ? { granted: xpInfo.granted, leveledUp: xpInfo.leveledUp } : null,
  };
}

/* --------------------------------------------------------------- flashcards */

export async function generateFlashcards(setId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const set = await prisma.tutorModule.findFirst({
    where: { id: setId, userId },
    select: { id: true, subject: true, sourceText: true, questions: true },
  });
  if (!set) return { error: 'That set is gone.' };

  // Cards come from the source material where it is still there, and from the
  // questions otherwise - a card made from a question is a worse card, but it
  // beats refusing.
  const material = set.sourceText?.trim()
    ? set.sourceText.slice(0, CONTEXT_CHARS)
    : readItems(set.questions)
        .map((q) => `${q.question}\nAnswer: ${q.answer}`)
        .join('\n\n')
        .slice(0, CONTEXT_CHARS);

  if (!material) return { error: 'There is nothing left to make cards from.' };

  const system = `You write flashcards for spaced repetition.

Return ONLY this JSON: { "cards": [ { "front": string, "back": string } ] }

12 to 18 cards. ONE idea per card. The front is a question or a term, never a hint-free noun like "Chapter 3". The back is the shortest complete answer - a phrase or a sentence, not a paragraph. No card should be answerable by guessing from the wording of the front.`;

  const result = await askAIBuddy(
    `Material for ${set.subject}:\n"""\n${material}\n"""\n\nProduce the JSON now.`,
    [],
    undefined,
    undefined,
    system,
    { tools: false, xp: false }
  );
  if (result.error) return { error: result.error };

  const parsed = parseJsonLoose(result.text || '');
  const raw = Array.isArray(parsed?.cards) ? parsed.cards : [];

  const cards: Flashcard[] = raw
    .map((c: Record<string, unknown>, i: number) => ({
      id: `c${i + 1}`,
      front: String(c?.front ?? '').trim().slice(0, 500),
      back: String(c?.back ?? '').trim().slice(0, 2000),
      interval: 0,
      repetition: 0,
      efactor: 2.5,
      nextReviewAt: null,
    }))
    .filter((c: Flashcard) => c.front && c.back)
    .slice(0, 30);

  if (cards.length === 0) return { error: 'No usable flashcards came back.' };

  await prisma.tutorModule.update({
    where: { id: set.id },
    data: { flashcards: JSON.stringify(cards) },
  });

  revalidatePath('/ai');
  return { success: true, count: cards.length };
}

/**
 * Record how a review session went.
 *
 * SM-2, the algorithm Anki uses: quality 0-5, an ease factor that drifts with
 * performance, and an interval that grows only while the card keeps being
 * remembered. A lapse sends it back to the start rather than merely shortening
 * the gap, because a card you have just failed is one you do not know.
 */
export async function saveFlashcardReview(
  setId: string,
  reviews: { id: string; quality: number }[]
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const set = await prisma.tutorModule.findFirst({
    where: { id: setId, userId },
    select: { id: true, flashcards: true },
  });
  if (!set) return { error: 'That set is gone.' };

  const cards = readCards(set.flashcards);
  const byId = new Map(reviews.map((r) => [r.id, Math.max(0, Math.min(5, Math.round(r.quality)))]));

  const updated = cards.map((card) => {
    const quality = byId.get(card.id);
    if (quality === undefined) return card;

    let { interval, repetition, efactor } = card;

    if (quality < 3) {
      repetition = 0;
      interval = 1;
    } else {
      repetition += 1;
      interval = repetition === 1 ? 1 : repetition === 2 ? 6 : Math.round(interval * efactor);
    }

    efactor = Math.max(
      1.3,
      efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    return {
      ...card,
      interval,
      repetition,
      efactor: Number(efactor.toFixed(2)),
      nextReviewAt: new Date(Date.now() + interval * 86400000).toISOString(),
    };
  });

  await prisma.tutorModule.update({
    where: { id: set.id },
    data: { flashcards: JSON.stringify(updated), lastReviewedAt: new Date() },
  });

  revalidatePath('/ai');
  return { success: true };
}
