'use server';

import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict, startOfDay } from 'date-fns';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { softDelete } from '@/lib/soft-delete';
import { getCurrentUserTimezone, getEvents, getTodayTasks, getTomorrowTasks } from '@/lib/actions';
import { askAIBuddy, getAIConnectivity } from '@/lib/ai-actions';
import { getInsightsData } from '@/lib/insights-actions';
import { holidayOn, holidaysBetween } from '@/lib/holidays';
import { getScheduleState } from '@/lib/term';
import { parseGradeToPercentage } from '@/lib/grades';
import { assertWritableScope, byClass, byTerm, getActiveScope, getViewScope, requireClassStamp } from '@/lib/scope';
import { getZonedNow } from '@/lib/utils';
import {
  buildCopilotPrompt,
  suggestPrompts,
  titleFromQuestion,
  type CopilotBlock,
  type CopilotContext,
  type SuggestedPrompt,
} from '@/lib/copilot-context';
import {
  buildEvidence,
  citedSources,
  detectIntent,
  evidencePrompt,
  type RetrievalRows,
  type Source,
} from '@/lib/copilot-retrieval';
import { beginTurn, failTurn, finishTurn } from '@/lib/copilot-turns';

/**
 * Ask AI: the Study workspace's chat (docs/STUDY_WORKSPACE_PLAN.md, Phase 2).
 *
 * Each turn carries a client-minted requestId. The user's message is saved
 * once per requestId (a unique index backs that), marked PENDING while the
 * model works, then DONE or FAILED. Retrying a failed turn re-sends the same
 * requestId: the existing message is reused rather than a second one written,
 * and a turn that already has a reply returns it instead of asking again.
 *
 * This module, not askAIBuddy, owns the persistence; askAIBuddy is called
 * without a session so it only generates. Write tools and XP stay off (S15).
 */

const MODE = 'ASK';
/** Older turns are dropped from what the model sees; the chat keeps them all. */
const HISTORY_TURNS = 20;
const MAX_QUESTION = 8000;

export type CopilotMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  /** User turns only: PENDING while answering, FAILED when no reply came. */
  status: 'DONE' | 'PENDING' | 'FAILED';
  requestId: string | null;
  sources: Source[];
};
export type CopilotSession = { id: string; title: string; updatedAt: string };

export type CopilotPanel = {
  yearLabel: string | null;
  termName: string | null;
  isArchive: boolean;
  provider: { ready: boolean; label: string; offline: boolean };
  tonight: { subject: string; time: string; type: string; status: string }[];
  dueSoon: { label: string; detail: string; href: string; overdue: boolean }[];
  marks: { subject: string; latest: string | null; percent: number | null; goal: number | null }[];
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function blockOf(task: { subject: string; startTime: string; endTime: string; type: string; isDone: boolean; isMissed: boolean }): CopilotBlock {
  return {
    subject: task.subject,
    start: task.startTime,
    end: task.endTime,
    type: task.type,
    status: task.isDone ? 'done' : task.isMissed ? 'missed' : 'pending',
  };
}

function readSources(raw: string | null): Source[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s) => s && typeof s.href === 'string' && s.href.startsWith('/') && typeof s.label === 'string' && typeof s.id === 'string')
      : [];
  } catch {
    return [];
  }
}

function toMessage(m: { id: string; role: string; content: string; status: string; requestId: string | null; sources: string | null }): CopilotMessage {
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : 'model',
    content: m.content,
    status: m.status === 'FAILED' ? 'FAILED' : m.status === 'PENDING' ? 'PENDING' : 'DONE',
    requestId: m.requestId,
    sources: readSources(m.sources),
  };
}

/**
 * Everything the assistant may know about this student right now, scoped to
 * their own rows in the year on screen. Rebuilt per turn - a chat from last
 * week must not answer from last week's deadlines.
 */
async function gather(userId: string) {
  const tz = await getCurrentUserTimezone();
  const now = getZonedNow(tz);
  const today = startOfDay(now);
  const todayKey = format(now, 'yyyy-MM-dd');
  const scope = await getViewScope(userId);
  const activeScope = await getActiveScope(userId);

  const [todayTasks, tomorrowTasks, homework, exams, templates, insights, grades, goals, resources, attempts, lessons, progress, subjectRows] =
    await Promise.all([
      getTodayTasks(),
      getTomorrowTasks(),
      prisma.homework.findMany({
        where: { userId, ...byTerm(scope), isCompleted: false },
        select: { id: true, subject: true, title: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
        take: 30,
      }),
      getEvents(),
      prisma.scheduleTemplate.findMany({
        where: { userId, ...byClass(activeScope) },
        select: { dayOfWeek: true, subject: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' },
      }),
      // Weak areas are a nice-to-have: a failure here must not stop the chat.
      getInsightsData('class').catch((error) => {
        console.error('Ask AI: insights unavailable', error);
        return null;
      }),
      prisma.subjectGrade.findMany({
        where: { reportCard: { userId, ...byTerm(scope) } },
        select: { subject: true, grade: true, reportCard: { select: { term: true, createdAt: true } } },
        orderBy: { reportCard: { createdAt: 'asc' } },
        take: 200,
      }),
      prisma.subjectGoal.findMany({ where: { userId, ...byClass(scope) }, select: { subject: true, targetGrade: true } }),
      prisma.resource.findMany({
        where: { userId, ...byClass(scope), NOT: { type: 'FOLDER' } },
        select: { subject: true, title: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.quizAttempt.findMany({
        where: { module: { userId, ...byClass(scope) } },
        select: { score: true, markingStatus: true, feedback: true, createdAt: true, module: { select: { id: true, title: true, subject: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.schoolLesson.findMany({
        where: { userId, ...byClass(activeScope), isBreak: false },
        select: { dayOfWeek: true, subject: true, startTime: true, endTime: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.userProgress.findUnique({ where: { userId }, select: { focusSessions: true, totalFocusMinutes: true } }),
      prisma.subject.findMany({ where: { userId, ...byClass(scope) }, select: { name: true } }),
    ]);

  const routine = [1, 2, 3, 4, 5, 6, 0]
    .map((day) => ({
      day: DAY_NAMES[day],
      blocks: templates.filter((t) => t.dayOfWeek === day).map((t) => `${t.startTime}-${t.endTime} ${t.subject}`),
    }))
    .filter((r) => r.blocks.length > 0);

  const upcomingExams = exams.filter((e) => startOfDay(e.date) >= today);
  const homeworkRows = homework.map((h) => ({
    id: h.id,
    subject: h.subject,
    title: h.title,
    due: format(h.dueDate, 'EEE d MMM'),
    daysLeft: differenceInCalendarDays(startOfDay(h.dueDate), today),
  }));
  const examRows = upcomingExams.map((e) => ({
    id: e.id,
    title: e.title,
    subject: e.subject?.name ?? null,
    date: format(e.date, 'EEE d MMM'),
    daysLeft: differenceInCalendarDays(startOfDay(e.date), today),
    time: e.startTime ?? null,
  }));

  const context: CopilotContext = {
    today: format(now, 'EEEE d MMMM yyyy'),
    now: format(now, 'HH:mm'),
    holidayToday: holidayOn(tz, todayKey)?.name ?? null,
    todayBlocks: todayTasks.map(blockOf),
    tomorrowBlocks: tomorrowTasks.map(blockOf),
    homework: homeworkRows,
    exams: examRows,
    weakSubjects: (insights?.subjects ?? [])
      .filter((s) => s.attentionScore >= 20)
      .slice(0, 3)
      .map((s) => ({ subject: s.subject, reason: s.reason })),
    routine,
    upcomingHolidays: [...holidaysBetween(tz, todayKey, format(addDays(now, 21), 'yyyy-MM-dd')).values()]
      .filter((h) => h.date !== todayKey)
      .map((h) => ({ date: format(new Date(`${h.date}T12:00:00`), 'EEE d MMM'), name: h.name })),
  };

  const rows: RetrievalRows = {
    homework: homeworkRows,
    exams: examRows,
    grades: grades.map((g) => ({ subject: g.subject, grade: g.grade, term: g.reportCard.term })),
    goals: goals.map((g) => ({ subject: g.subject, targetGrade: g.targetGrade })),
    resources,
    attempts: attempts.map((a) => {
      let wrong: RetrievalRows['attempts'][number]['wrong'] = [];
      try {
        const answers = JSON.parse(a.feedback);
        if (Array.isArray(answers)) {
          wrong = answers
            .filter((x) => x && x.status !== 'UNMARKED' && x.isCorrect === false)
            .map((x) => ({ question: String(x.question ?? ''), given: String(x.given ?? ''), expected: String(x.expected ?? '') }));
        }
      } catch {
        // An unreadable attempt simply contributes no mistakes.
      }
      return {
        setId: a.module.id,
        title: a.module.title,
        subject: a.module.subject,
        score: a.score,
        markingStatus: a.markingStatus,
        when: formatDistanceToNowStrict(a.createdAt, { addSuffix: true }),
        wrong,
      };
    }),
    lessons: lessons.map((l) => ({ day: DAY_NAMES[l.dayOfWeek], subject: l.subject, startTime: l.startTime, endTime: l.endTime })),
    focus: progress ? { minutes: progress.totalFocusMinutes, sessions: progress.focusSessions } : null,
  };

  const subjects = [
    ...new Set([...subjectRows.map((s) => s.name), ...templates.map((t) => t.subject), ...grades.map((g) => g.subject)]),
  ];

  // The panel's marks: each subject's latest official mark against its goal.
  const latestBySubject = new Map<string, string>();
  for (const g of grades) latestBySubject.set(g.subject, g.grade);
  const goalBySubject = new Map(goals.map((g) => [g.subject.toLowerCase(), g.targetGrade]));
  const markSubjects = [...new Set([...latestBySubject.keys(), ...goals.map((g) => g.subject)])];

  const panelBase = {
    tonight: context.todayBlocks.map((b) => ({ subject: b.subject, time: `${b.start}-${b.end}`, type: b.type, status: b.status ?? 'pending' })),
    dueSoon: [
      ...homeworkRows.filter((h) => h.daysLeft <= 7).map((h) => ({
        label: `${h.subject}: ${h.title}`,
        detail: h.daysLeft < 0 ? `Overdue · ${h.due}` : h.daysLeft === 0 ? 'Due today' : h.daysLeft === 1 ? 'Due tomorrow' : `Due ${h.due}`,
        href: '/homeworks',
        overdue: h.daysLeft < 0,
      })),
      ...examRows.filter((e) => e.daysLeft <= 14).map((e) => ({
        label: e.title,
        detail: e.daysLeft === 0 ? 'Exam today' : `Exam ${e.date}`,
        href: `/exams/${encodeURIComponent(e.id)}`,
        overdue: false,
      })),
    ].slice(0, 8),
    marks: markSubjects.slice(0, 12).map((subject) => {
      const latest = latestBySubject.get(subject) ?? null;
      return { subject, latest, percent: latest ? parseGradeToPercentage(latest) : null, goal: goalBySubject.get(subject.toLowerCase()) ?? null };
    }),
  };

  return { context, rows, subjects, panelBase, scope };
}

async function providerStatus(userId: string): Promise<CopilotPanel['provider']> {
  const [connectivity, progress] = await Promise.all([
    getAIConnectivity(),
    prisma.userProgress.findUnique({ where: { userId }, select: { primaryAiProvider: true, geminiApiKey: true, openaiApiKey: true } }),
  ]);
  if (connectivity.activeMode === 'ollama') {
    return { ready: true, label: `Ollama${connectivity.ollamaModel ? ` · ${connectivity.ollamaModel}` : ''}`, offline: !connectivity.online };
  }
  if (connectivity.activeMode === 'cloud') {
    const label = progress?.primaryAiProvider === 'openai' && progress.openaiApiKey ? 'OpenAI' : progress?.geminiApiKey ? 'Gemini' : 'OpenAI';
    return { ready: true, label, offline: false };
  }
  return { ready: false, label: 'No AI set up', offline: !connectivity.online };
}

/** Everything the page needs on first render. */
export async function getAskAIPage(sessionId: string | null): Promise<{
  sessions: CopilotSession[];
  messages: CopilotMessage[];
  activeSessionId: string | null;
  suggestions: SuggestedPrompt[];
  panel: CopilotPanel;
} | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const viewScope = await getViewScope(userId);
  const [sessions, gathered, schedule, provider] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId, mode: MODE, parentSessionId: null, ...byClass(viewScope) },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    gather(userId),
    getScheduleState(userId),
    providerStatus(userId),
  ]);

  const active = sessionId ? sessions.find((s) => s.id === sessionId) ?? null : null;
  const messages = active
    ? await prisma.chatMessage.findMany({
        where: { sessionId: active.id },
        select: { id: true, role: true, content: true, status: true, requestId: true, sources: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  return {
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt.toISOString() })),
    messages: messages.map(toMessage),
    activeSessionId: active?.id ?? null,
    suggestions: suggestPrompts(gathered.context),
    panel: {
      yearLabel: viewScope?.label ?? schedule.classLabel,
      termName: viewScope?.isArchive ? null : schedule.termName,
      isArchive: viewScope?.isArchive ?? false,
      provider,
      ...gathered.panelBase,
    },
  };
}

export type AskResult = {
  sessionId: string;
  session?: CopilotSession;
  userMessage?: CopilotMessage;
  reply?: CopilotMessage;
  error?: string;
};

/**
 * Send one turn, or retry a failed one (same requestId). Starts a
 * conversation when `sessionId` is null.
 */
export async function askCopilot(input: { sessionId: string | null; question: string; requestId: string }): Promise<AskResult> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');
  await assertWritableScope(userId);

  const question = input.question.trim().slice(0, MAX_QUESTION);
  if (!question) throw new Error('Type a question first.');
  const requestId = String(input.requestId ?? '').slice(0, 100);
  if (!requestId) throw new Error('Missing request id.');

  let sessionId = input.sessionId;
  let created: CopilotSession | undefined;
  if (sessionId) {
    const owned = await prisma.chatSession.findFirst({ where: { id: sessionId, userId, mode: MODE }, select: { id: true } });
    if (!owned) sessionId = null;
  }
  if (!sessionId) {
    const session = await prisma.chatSession.create({
      data: { userId, mode: MODE, title: titleFromQuestion(question), ...(await requireClassStamp(userId)) },
      select: { id: true, title: true, updatedAt: true },
    });
    sessionId = session.id;
    created = { id: session.id, title: session.title, updatedAt: session.updatedAt.toISOString() };
  }

  // One user message per requestId (lib/copilot-turns.ts): a retry reuses it,
  // and a turn that already has its answer returns that answer.
  const begun = await beginTurn(prisma, sessionId, requestId, question);
  if (begun.answered) {
    return { sessionId, session: created, userMessage: toMessage(begun.userMessage), reply: toMessage(begun.answered) };
  }
  const userMessage = begun.userMessage;
  await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });

  const [earlier, gathered] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId, createdAt: { lt: userMessage.createdAt }, NOT: { status: 'FAILED' } },
      select: { role: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
    }),
    gather(userId),
  ]);
  const history = earlier.reverse().map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  const recentUser = earlier.filter((m) => m.role === 'user').map((m) => m.content);

  const intent = detectIntent(question, recentUser, gathered.subjects);
  const evidence = buildEvidence(intent, gathered.rows);
  const system = `${buildCopilotPrompt(gathered.context)}

${evidencePrompt(evidence, intent)}

When you state a fact from the RECORDS, cite it right after with its number, like [S2]. Do not cite anything for general explanations.`;

  // No session passed: this module persists the turn, askAIBuddy only answers.
  const result = await askAIBuddy(question, history, undefined, undefined, system, { tools: false, xp: false });
  revalidatePath('/ask');

  if (result.error || !result.text) {
    console.error('Ask AI failed:', result.error);
    const failed = await failTurn(prisma, userMessage.id);
    return {
      sessionId,
      session: created,
      userMessage: toMessage(failed),
      error: result.error?.startsWith('No AI configured')
        ? result.error
        : 'The AI could not answer just now. Check your connection, then retry.',
    };
  }

  const sources = citedSources(result.text, evidence);
  const finished = await finishTurn(prisma, sessionId, userMessage.id, result.text, sources.length ? JSON.stringify(sources) : null);
  // Stopped while the model was working: the student asked not to have this
  // answer, so it was not saved (the provider call itself cannot be recalled).
  if ('stopped' in finished) {
    return { sessionId, session: created, userMessage: toMessage({ ...userMessage, status: 'FAILED' }), error: 'Stopped.' };
  }
  return { sessionId, session: created, userMessage: toMessage(finished.userMessage), reply: toMessage(finished.reply) };
}

/** Stop waiting for a turn: its answer, if it still arrives, is discarded. */
export async function stopCopilotTurn(sessionId: string, requestId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');
  await prisma.chatMessage.updateMany({
    where: { sessionId, requestId, status: 'PENDING', session: { userId, mode: MODE } },
    data: { status: 'FAILED' },
  });
}

export async function deleteCopilotSession(sessionId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');
  await assertWritableScope(userId);

  await softDelete(prisma, 'chatSession', { id: sessionId, userId, mode: MODE });
  revalidatePath('/ask');
}
