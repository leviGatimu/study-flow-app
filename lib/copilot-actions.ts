'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { softDelete } from '@/lib/soft-delete';
import { createEvent, createQuickTask } from '@/lib/actions';
import { getAIConnectivity } from '@/lib/ai-actions';
import { getScheduleState } from '@/lib/term';
import { assertWritableScope, byClass, getViewScope } from '@/lib/scope';
import { suggestPrompts, type SuggestedPrompt } from '@/lib/copilot-context';
import { listStudySets, type StudySetSummary } from '@/lib/study-actions';
import { replacePlan, splitPlan, type PlanStep, type StoredPlan } from '@/lib/copilot-plan';
import { gather, MODE, toMessage, type CopilotMessage, type CopilotPanel, type CopilotSession } from '@/lib/copilot-server';

/**
 * Ask AI page actions. Sending a message goes through app/api/ask/route.ts
 * (it streams); the turn logic itself is in lib/copilot-server.ts.
 */

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
  practices: StudySetSummary[];
} | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const viewScope = await getViewScope(userId);
  const [sessions, gathered, schedule, provider, practices] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId, mode: MODE, parentSessionId: null, ...byClass(viewScope) },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    gather(userId),
    getScheduleState(userId),
    providerStatus(userId),
    listStudySets(),
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
    practices,
  };
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
  revalidatePath('/ai');
}


/** A plan's reply, owned by this student, with its plan read back from the database. */
async function ownedPlan(userId: string, messageId: string) {
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, role: { not: 'user' }, session: { userId, mode: MODE } },
    select: { id: true, content: true },
  });
  const stored = message ? splitPlan(message.content).plan : null;
  return message && stored ? { message, stored } : null;
}

/**
 * The student pressed Yes: add every step. A step that cannot go in (a clash
 * with something already there, a subject that is gone) is skipped and says
 * why; the rest still go in. Runs once: an applied plan is not applied again.
 */
export async function applyCopilotPlan(messageId: string): Promise<{ plan?: StoredPlan; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'You are signed out. Sign in and try again.' };
  try {
    await assertWritableScope(userId);
  } catch {
    return { error: 'You are viewing a finished year. Switch back to this year to add things.' };
  }

  const found = await ownedPlan(userId, String(messageId).slice(0, 100));
  if (!found) return { error: 'That plan is no longer here.' };
  if (found.stored.state !== 'PROPOSED') return { plan: found.stored };

  const subjects = await prisma.subject.findMany({ where: { userId, deletedAt: null }, select: { id: true, name: true } });
  const subjectId = (name: string) => subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ?? null;

  const steps: PlanStep[] = [];
  const addedExams: { subject: string; date: string }[] = [];
  for (const step of found.stored.plan.steps) {
    try {
      if (step.kind === 'exam') {
        await createEvent({
          title: step.subject,
          subjectId: subjectId(step.subject),
          date: new Date(`${step.date}T00:00:00Z`),
          priority: 'NORMAL',
          startTime: step.start,
          endTime: step.end,
          category: step.category,
        });
        addedExams.push({ subject: step.subject, date: step.date });
        steps.push({ ...step, outcome: 'done' });
      } else {
        const made = await createQuickTask({ subject: step.subject, startTime: step.start, endTime: step.end, type: step.type, date: step.date });
        if ('success' in made) steps.push({ ...step, outcome: 'done' });
        else if ('clash' in made) steps.push({ ...step, outcome: 'skipped', note: 'Something is already planned then.' });
        else steps.push({ ...step, outcome: 'skipped', note: made.error });
      }
    } catch (error) {
      steps.push({ ...step, outcome: 'skipped', note: error instanceof Error ? error.message : 'Could not add this one.' });
    }
  }

  // Revision for an exam this plan added counts towards that exam.
  for (const exam of addedExams) {
    const row = await prisma.examEvent.findFirst({
      where: { userId, title: exam.subject, date: new Date(`${exam.date}T00:00:00Z`), deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const blocks = steps.filter(
      (s): s is Extract<PlanStep, { kind: 'block' }> =>
        s.kind === 'block' && s.outcome === 'done' && s.type === 'REVISION' && s.subject.toLowerCase() === exam.subject.toLowerCase() && s.date <= exam.date
    );
    if (row && blocks.length) {
      await prisma.task.updateMany({
        where: { userId, examId: null, isDeleted: false, subject: { in: [...new Set(blocks.map((b) => b.subject))] }, OR: blocks.map((b) => ({ date: new Date(`${b.date}T00:00:00`), startTime: b.start })) },
        data: { examId: row.id },
      });
    }
  }

  const next: StoredPlan = { state: 'APPLIED', plan: { ...found.stored.plan, steps } };
  await prisma.chatMessage.update({ where: { id: found.message.id }, data: { content: replacePlan(found.message.content, next) } });
  // Not '/ai': the chat already shows the result, and refreshing the page it
  // is on would rebuild the whole conversation under the student's cursor.
  revalidatePath('/exams');
  revalidatePath('/timetable');
  revalidatePath('/');
  return { plan: next };
}

/** The student pressed Not now: keep the plan in the chat, change nothing. */
export async function dismissCopilotPlan(messageId: string): Promise<{ plan?: StoredPlan; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'You are signed out. Sign in and try again.' };
  const found = await ownedPlan(userId, String(messageId).slice(0, 100));
  if (!found) return { error: 'That plan is no longer here.' };
  if (found.stored.state !== 'PROPOSED') return { plan: found.stored };
  const next: StoredPlan = { state: 'DISMISSED', plan: found.stored.plan };
  await prisma.chatMessage.update({ where: { id: found.message.id }, data: { content: replacePlan(found.message.content, next) } });
  return { plan: next };
}
