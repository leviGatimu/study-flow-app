'use server';

/**
 * AI Study: one assistant, several modes, one shared context.
 *
 * Everything here is a thin layer over machinery that already existed -
 * askAIBuddy for the provider fallback and XP, ChatSession/ChatMessage for the
 * transcript. What is new is the two things that were missing:
 *
 *   THE CONTEXT. Every call carries buildStudyContext() - subjects, today's
 *   blocks, upcoming exams, homework due, weak areas, what has been studied
 *   this week, and the titles of the student's own notes. Before this the model
 *   was told the date and nothing else, so "what should I study tonight?" could
 *   only ever be answered with a question back.
 *
 *   THE MODE. The same assistant, instructed to behave differently. A mock exam
 *   that offers hints is not a mock exam, and a tutor that dumps 500 words and
 *   leaves is not teaching - so the difference is written down here rather than
 *   left to the student to coax out with prompt wording.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { requireClassStamp, byClass, getViewScope } from '@/lib/scope';
import { askAIBuddy } from '@/lib/ai-actions';
import { buildStudyContext, renderStudyContext, type StudyContext } from '@/lib/ai-context';
import {
  STUDY_MODES,
  defaultSessionTitle,
  type Recommendation,
  type StudyMode,
} from '@/lib/ai-study';

const VALID_MODES = new Set(STUDY_MODES.map((m) => m.id));

function asMode(value: string | null | undefined): StudyMode {
  return value && VALID_MODES.has(value as StudyMode) ? (value as StudyMode) : 'ASK';
}

/**
 * How each mode behaves, on top of the shared context.
 *
 * Written as constraints rather than encouragement. "Be a good tutor" produces
 * a wall of text; "explain ONE idea, then ask ONE question, then stop" produces
 * a lesson. The negative instructions matter more than the positive ones -
 * every one of them is a behaviour the default assistant does that makes it
 * useless for the mode in question.
 */
const MODE_INSTRUCTIONS: Record<StudyMode, string> = {
  ASK: `MODE: ASK.
Answer the student's question directly and briefly, in plain English.
Use what you know about their schedule, exams and weak areas when it is relevant - if they ask what to study, you already have everything you need to say something specific, so never ask them to describe their own timetable back to you.
If they ask for help with a problem they are working on, help them reason towards it rather than handing over the final answer, unless they explicitly ask for the answer.`,

  LEARN: `MODE: TEACH.
Run a real lesson, not an article. Follow this loop and do not break it:
1. Explain ONE idea, in at most 150 words, with a concrete example.
2. Ask ONE short question that checks they actually followed it. Then STOP and wait.
3. When they answer: say plainly whether it is right, correct what is wrong in a sentence, and move to the next idea - harder than the last.
Never present the next idea before they have answered the check question. Never produce a numbered syllabus of everything you are about to cover. If they are lost, go back a step and use a different example rather than repeating the same words.`,

  PRACTICE: `MODE: PRACTICE.
Ask questions ONE AT A TIME. After each answer, say whether it is right, give a one or two sentence explanation, then ask the next.
Mix recall with application; do not ask five versions of the same question.
Prefer their weak areas, and where their own notes cover the topic, base questions on that material rather than generic textbook content.
Keep a running count ("3/5 so far"). After the last question give a short summary: what they have got, what to review.`,

  EXAM: `MODE: MOCK EXAM. This mode is strict.
State the paper at the start: subject, number of questions, and that you will not help until the end.
Then ask the questions ONE AT A TIME, numbered.
Give NO hints, NO explanations, NO encouragement and NO indication of whether an answer was right - not even a "good". If they ask for a hint, decline in one short sentence and repeat the question.
Only when every question has been answered: mark it, give a score out of the total, then list what they were strong on, what needs work, and one concrete next step with a time on it.`,

  REVIEW: `MODE: REVIEW THEIR NOTES.
Work from what the student has actually written. Their note titles are listed in the context; if you need the contents of one, ask for it by name in a single short sentence and stop.
Do not replace their notes with your own version of the topic. Your jobs are: explain a part they point at, find gaps or errors, turn a section into questions or flashcards, or condense it - whichever they asked for.
When you produce study material, structure it strictly and keep it short: the core idea, the formula if there is one, one example, the common mistake, one quick check. No introductions, no "in conclusion", no filler about why the subject is important.`,
};

const BASE_INSTRUCTION = `You are the study assistant inside Study Flow, the student's own study app. You are not a general chatbot: you can see their real schedule, subjects, exams, homework and performance, and you are expected to use them.

How to write:
- Plain, direct English. Short sentences. No preamble, no restating the question, no "great question".
- Never pad. If the honest answer is two sentences, write two sentences.
- Use their real subject names and real dates. Say "your Physics exam on Friday", not "your upcoming exam".
- If something in the context contradicts what they say, trust what they say and mention the discrepancy once.
- If you genuinely lack the information, say so in one line and name what would settle it.`;

/** Compose the full system instruction: who you are, how to behave, what you know. */
async function systemInstructionFor(mode: StudyMode, context: StudyContext | null): Promise<string> {
  const parts = [BASE_INSTRUCTION, MODE_INSTRUCTIONS[mode]];
  if (context) {
    parts.push(
      `WHAT YOU KNOW ABOUT THIS STUDENT (from their app - treat as fact):\n${renderStudyContext(context)}`
    );
  } else {
    parts.push(
      'You have no study data for this student yet. Do not invent any; ask what they are working on.'
    );
  }
  return parts.join('\n\n');
}

/**
 * Decide what the student should do next, without calling the AI.
 *
 * The rules are ordered by how much a missed one costs: an exam you did not
 * revise for outranks homework due tomorrow, which outranks a subject you have
 * been avoiding, which outranks simply doing the block already on today.
 */
function recommend(ctx: StudyContext | null): Recommendation | null {
  if (!ctx) return null;

  const weakest = ctx.weakAreas[0] ?? null;
  const studied = new Map(ctx.recentMinutesBySubject.map((r) => [r.subject.toLowerCase(), r.minutes]));

  // 1. An exam close enough to be the only sensible thing to work on.
  const exam = ctx.upcomingExams.find((e) => e.daysAway <= 7);
  if (exam) {
    const subject = exam.subject ?? exam.title;
    const weakSpot = ctx.weakAreas.find(
      (w) => w.subject.toLowerCase() === subject.toLowerCase()
    );
    return {
      headline: `30 min ${subject}`,
      reason:
        exam.daysAway === 0
          ? `${exam.title} is today.`
          : `${exam.title} is in ${exam.daysAway} day${exam.daysAway === 1 ? '' : 's'}.` +
            (weakSpot ? ` ${weakSpot.reason}` : ''),
      minutes: 30,
      subject,
      mode: weakSpot ? 'PRACTICE' : 'REVIEW',
      prompt: weakSpot
        ? `Test me on ${subject}. Focus on where I am weakest — my ${exam.title} is in ${exam.daysAway} days.`
        : `My ${exam.title} is in ${exam.daysAway} days. Work through ${subject} with me, starting with what I am least sure of.`,
    };
  }

  // 2. Homework that lands within two days.
  const homework = ctx.homeworkDue.find((h) => h.daysAway <= 2);
  if (homework) {
    return {
      headline: `${homework.subject}: ${homework.title}`,
      reason:
        homework.daysAway === 0
          ? 'Due today, and not marked done.'
          : `Due ${homework.dueDate}, and not marked done.`,
      minutes: 25,
      subject: homework.subject,
      mode: 'ASK',
      prompt: `Help me work through my ${homework.subject} homework: "${homework.title}". Ask me what I have so far first — do not just do it for me.`,
    };
  }

  // 3. The subject the app says is slipping, that they have not touched.
  if (weakest && (studied.get(weakest.subject.toLowerCase()) ?? 0) < 30) {
    return {
      headline: `20 min ${weakest.subject}`,
      reason: `${weakest.reason} You have barely touched it this week.`,
      minutes: 20,
      subject: weakest.subject,
      mode: 'PRACTICE',
      prompt: `Test me on ${weakest.subject}, starting easy and getting harder. This is my weakest subject right now.`,
    };
  }

  // 4. Whatever is already on today and not done.
  const nextBlock = ctx.todayBlocks.find((b) => !b.isDone);
  if (nextBlock) {
    return {
      headline: `${nextBlock.subject} at ${nextBlock.startTime}`,
      reason: "It is on today's schedule and still open.",
      minutes: 25,
      subject: nextBlock.subject,
      mode: nextBlock.type === 'REVISION' ? 'PRACTICE' : 'LEARN',
      prompt:
        nextBlock.type === 'REVISION'
          ? `Test me on ${nextBlock.subject} — this is my revision block for today.`
          : `Teach me something from ${nextBlock.subject} — this is my block for today. Start by asking which topic.`,
    };
  }

  // 5. Nothing pressing. Say that honestly rather than inventing urgency.
  if (weakest) {
    return {
      headline: `20 min ${weakest.subject}`,
      reason: 'Nothing is due, so this is the best use of the time.',
      minutes: 20,
      subject: weakest.subject,
      mode: 'PRACTICE',
      prompt: `Test me on ${weakest.subject}.`,
    };
  }

  return null;
}

export type StudyHome = {
  context: StudyContext | null;
  recommendation: Recommendation | null;
  recent: {
    id: string;
    title: string;
    mode: StudyMode;
    subject: string | null;
    updatedAt: Date;
  }[];
  /** Whether any provider is configured; the page says so plainly if not. */
  aiReady: boolean;
};

export async function getStudyHome(): Promise<StudyHome | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const scope = await getViewScope(userId);
  const [context, sessions, progress] = await Promise.all([
    buildStudyContext(),
    prisma.chatSession.findMany({
      where: { userId, ...byClass(scope) },
      select: { id: true, title: true, mode: true, subject: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.userProgress.findUnique({
      where: { userId },
      select: { geminiApiKey: true, openaiApiKey: true, ollamaEnabled: true },
    }),
  ]);

  return {
    context,
    recommendation: recommend(context),
    recent: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: asMode(s.mode),
      subject: s.subject,
      updatedAt: s.updatedAt,
    })),
    aiReady: Boolean(progress?.geminiApiKey || progress?.openaiApiKey || progress?.ollamaEnabled),
  };
}

/** Open a session in a given mode. The transcript hangs off it. */
export async function startStudySession(input: {
  mode: string;
  subject?: string | null;
  title?: string | null;
}) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const mode = asMode(input.mode);
  const subject = input.subject?.trim().slice(0, 120) || null;

  const session = await prisma.chatSession.create({
    data: {
      userId,
      ...(await requireClassStamp(userId)),
      mode,
      subject,
      title: input.title?.trim().slice(0, 120) || defaultSessionTitle(mode, subject),
    },
    select: { id: true },
  });

  revalidatePath('/ai');
  return { success: true, sessionId: session.id };
}

export async function getStudySession(sessionId: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, title: true, mode: true, subject: true },
  });
  if (!session) return null;

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId, session: { userId } },
    select: { id: true, role: true, content: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return { ...session, mode: asMode(session.mode), messages };
}

export async function renameStudySession(sessionId: string, title: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = title.trim().slice(0, 120);
  if (!trimmed) return { error: 'A session needs a name.' };

  const { count } = await prisma.chatSession.updateMany({
    where: { id: sessionId, userId },
    data: { title: trimmed },
  });
  if (count === 0) return { error: 'Session not found.' };

  revalidatePath('/ai');
  return { success: true };
}

/**
 * Ask the assistant, in a mode, with the student's whole situation attached.
 *
 * The session is verified as the caller's inside askAIBuddy before a single
 * message is written, and the context is built from the caller's own userId -
 * neither the mode nor the session id can widen what this sees.
 */
export async function askStudyAI(input: {
  prompt: string;
  mode: string;
  sessionId?: string;
  history: { role: string; content: string }[];
  file?: { data: string; mimeType: string };
}) {
  const userId = await getUserId();
  if (!userId) return { text: '', error: 'Unauthorized' };

  const prompt = input.prompt.trim();
  if (!prompt) return { text: '', error: 'Ask something first.' };

  const mode = asMode(input.mode);
  const context = await buildStudyContext();
  const systemInstruction = await systemInstructionFor(mode, context);

  const result = await askAIBuddy(
    prompt,
    input.history as never,
    input.sessionId,
    input.file,
    systemInstruction
  );

  revalidatePath('/ai');
  return result;
}

/**
 * What the AI is currently being told, for the context indicator.
 *
 * The student can open this and read the exact block the model receives. That
 * is the point: an assistant that says "revise vectors" is only trustworthy if
 * you can see why it said so.
 */
export async function getContextPreview(): Promise<string | null> {
  const context = await buildStudyContext();
  return context ? renderStudyContext(context) : null;
}
