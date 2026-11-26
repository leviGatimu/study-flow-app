import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict, startOfDay } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { getCurrentUserTimezone, getEvents, getTodayTasks, getTomorrowTasks } from '@/lib/actions';
import { getInsightsData } from '@/lib/insights-actions';
import { holidayOn, holidaysBetween } from '@/lib/holidays';
import { parseGradeToPercentage } from '@/lib/grades';
import { byClass, byTerm, getActiveScope, getViewScope, requireClassStamp } from '@/lib/scope';
import { getZonedNow } from '@/lib/utils';
import { buildCopilotPrompt, titleFromQuestion, type CopilotBlock, type CopilotContext } from '@/lib/copilot-context';
import { buildEvidence, citedSources, detectIntent, evidencePrompt, type RetrievalRows, type Source } from '@/lib/copilot-retrieval';
import { beginTurn, failTurn, finishTurn } from '@/lib/copilot-turns';
import { quickReply } from '@/lib/quick-replies';
import { generateStudySet, listStudySets, type StudySetSummary } from '@/lib/study-actions';
import { parsePracticeRequest, practiceReference, practiceRefsForModel, splitPracticeRefs } from '@/lib/practice-request';
import { parsePlanRequest, planForModel, planReference, splitPlan, type StoredPlan } from '@/lib/copilot-plan';
import type { TalkMessage } from '@/lib/talk';
import { DRAWING_INSTRUCTIONS, fillDataBlocks, widgetsForModel, type DataSnapshot, type ScheduleRow } from '@/lib/chat-ui';

/*
 * Server-only helpers for the Study chat. NOT a 'use server' file on purpose:
 * everything exported from one of those becomes a callable endpoint, and these
 * take a userId the caller has already checked.
 */

/** How many days after tomorrow the assistant can see (and plan into). */
const AHEAD_DAYS = 12;

/**
 * Ask AI: the Study workspace's chat (docs/STUDY_WORKSPACE_PLAN.md, Phase 2).
 *
 * Each turn carries a client-minted requestId. The user's message is saved
 * once per requestId (a unique index backs that), marked PENDING while the
 * model works, then DONE or FAILED. Retrying a failed turn re-sends the same
 * requestId: the existing message is reused rather than a second one written,
 * and a turn that already has a reply returns it instead of asking again.
 *
 * The reply streams (app/api/ask/route.ts): prepareCopilotTurn saves the
 * question and builds what the model is told, the route streams the model's
 * words straight to the browser through the fast path (lib/talk-server.ts),
 * and completeCopilotTurn turns any practice or plan line into the real thing
 * and saves the answer. The model never changes anything itself: a plan only
 * runs when the student presses Yes (applyCopilotPlan).
 */

export const MODE = 'ASK';
/** Older turns are dropped from what the model sees; the chat keeps them all. */
const HISTORY_TURNS = 30;
/** Other recent chats the assistant is reminded of, so it can pick up where they left off. */
const OTHER_CHATS = 5;
export const MAX_QUESTION = 8000;

export type CopilotMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  /** User turns only: PENDING while answering, FAILED when no reply came. */
  status: 'DONE' | 'PENDING' | 'FAILED';
  requestId: string | null;
  sources: Source[];
  /** Practice sets this reply made; shown as cards with a Start button. */
  practiceIds: string[];
  /** A plan this reply proposed, and whether the student said yes. */
  plan: StoredPlan | null;
};
export type CopilotSession = { id: string; title: string; updatedAt: string };

/* ------------------------------------------------------------ practice sets */

/**
 * The chat can make a practice set. The model never writes the questions into
 * the chat: it answers with a sentence and a request line, which this module
 * turns into a real set (generateStudySet, topic mode). The saved reply keeps
 * a reference line instead, which toMessage lifts out into practiceIds.
 */
const PRACTICE_INSTRUCTIONS = `MAKING PRACTICE: you can create a practice set in the app - questions the student answers one by one, which the app marks and scores. When the student asks for a quiz, a test, practice, questions, or to be tested on something:
- Do NOT write the questions in the chat.
- Reply with one or two short sentences saying what you are making, then end with this exact line on its own:
[[PRACTICE {"subject":"<the subject, using the student's own subject name when it matches>","topic":"<exactly what to test, specific>","count":<number of questions, 5 to 20, default 10>,"style":"<MIXED, MULTIPLE_CHOICE, WRITTEN or TRUE_FALSE; default MIXED>"}]]
- If they ask what to practise, pick from their weak subjects and the questions they recently got wrong.
- Use the line only when they want to be tested. Never use it for an explanation.`;

/**
 * Make the practice set a reply asked for. Returns the reply text with the
 * request line replaced by a reference to the set (or an explanation of why
 * it could not be made), and the new set's summary.
 */
async function fulfilPracticeRequest(
  text: string,
  subjects: string[]
): Promise<{ text: string; practice?: StudySetSummary }> {
  const parsed = parsePracticeRequest(text, subjects);
  if (parsed.kind === 'none') return { text };
  if (parsed.kind === 'invalid') return { text: `${parsed.before}\n\n${parsed.reason}` };
  const { before, subject, topic, count, style } = parsed;

  const made = await generateStudySet({ subject, sourceName: 'Study chat', topic, count, style });
  if ('error' in made) {
    return { text: `${before}\n\nI could not make the practice: ${made.error}` };
  }
  const practice = (await listStudySets()).find((p) => p.id === made.setId);
  return { text: `${before}\n\n${practiceReference(made.setId)}`, practice };
}

export type CopilotPanel = {
  yearLabel: string | null;
  termName: string | null;
  isArchive: boolean;
  provider: { ready: boolean; label: string; offline: boolean };
  /** First name for the greeting. */
  studentName: string | null;
  /** The next thing on the plan, in words. */
  nextUp: string | null;
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

export function toMessage(m: { id: string; role: string; content: string; status: string; requestId: string | null; sources: string | null }): CopilotMessage {
  const { text: withoutPractice, practiceIds } = m.role === 'user' ? { text: m.content, practiceIds: [] } : splitPracticeRefs(m.content);
  const { text, plan } = m.role === 'user' ? { text: withoutPractice, plan: null } : splitPlan(withoutPractice);
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : 'model',
    content: text,
    practiceIds,
    plan,
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
export async function gather(userId: string) {
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
        select: { dayOfWeek: true, subject: true, startTime: true, endTime: true, type: true },
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
      prisma.userProgress.findUnique({
        where: { userId },
        select: { focusSessions: true, totalFocusMinutes: true, name: true, school: true, currentStreak: true, level: true, birthday: true },
      }),
      prisma.subject.findMany({ where: { userId, ...byClass(scope) }, select: { name: true } }),
    ]);

  // What is already on the days after tomorrow. Routine blocks only exist once
  // a day has been opened, so a day without them shows the routine instead.
  const aheadFrom = startOfDay(addDays(now, 2));
  const aheadTo = startOfDay(addDays(now, AHEAD_DAYS + 2));
  const aheadTasks = await prisma.task.findMany({
    where: { userId, ...byTerm(scope), isDeleted: false, date: { gte: aheadFrom, lt: aheadTo } },
    select: { date: true, subject: true, startTime: true, endTime: true, type: true, templateId: true },
    orderBy: { startTime: 'asc' },
  });

  const aheadDays = Array.from({ length: AHEAD_DAYS }, (_, i) => {
    const day = addDays(now, i + 2);
    const key = format(day, 'yyyy-MM-dd');
    const onDay = aheadTasks.filter((t) => format(t.date, 'yyyy-MM-dd') === key);
    const holiday = holidayOn(tz, key);
    const fromRoutine = onDay.some((t) => t.templateId) || holiday ? [] : templates.filter((t) => t.dayOfWeek === day.getDay());
    const rows: ScheduleRow[] = [...onDay, ...fromRoutine]
      .map((t) => ({ start: t.startTime, end: t.endTime, subject: t.subject, type: t.type, status: 'pending' as const }))
      .sort((a, b) => a.start.localeCompare(b.start));
    return { key, label: `${format(day, 'EEE d MMM')}${holiday ? ` (holiday: ${holiday.name})` : ''}`, rows };
  });

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
    todayKey,
    student: progress
      ? {
          name: progress.name?.trim() || 'the student',
          school: progress.school?.trim() || null,
          streak: progress.currentStreak,
          focusHours: Math.round(progress.totalFocusMinutes / 6) / 10,
          level: progress.level,
          birthday: progress.birthday,
        }
      : undefined,
    nextUp: nextUpLine(format(now, 'HH:mm'), todayTasks.map(blockOf), tomorrowTasks.map(blockOf)),
    daysAhead: aheadDays.map((d) => ({
      label: d.label,
      key: d.key,
      blocks: d.rows.map((r) => `${r.start}-${r.end} ${r.subject}${r.type === 'REVISION' ? ' (revision)' : ''}`),
    })),
    schoolDays: [1, 2, 3, 4, 5, 6, 0]
      .map((day) => {
        const today = lessons.filter((l) => l.dayOfWeek === day);
        if (!today.length) return null;
        const start = today.reduce((a, l) => (l.startTime < a ? l.startTime : a), today[0].startTime);
        const end = today.reduce((a, l) => (l.endTime > a ? l.endTime : a), today[0].endTime);
        return `${DAY_NAMES[day]} ${start}-${end}`;
      })
      .filter((d): d is string => Boolean(d)),
    pastExams: exams
      .filter((e) => startOfDay(e.date) < today)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 12)
      .map((e) => ({
        title: e.title,
        date: format(e.date, 'd MMM yyyy'),
        category: e.category ?? null,
        result: e.score !== null && e.maxScore ? `${e.score}/${e.maxScore} (${Math.round((e.score / e.maxScore) * 100)}%)` : null,
      })),
    subjects: subjectRows.map((s) => s.name),
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

  const studentName = progress?.name?.trim().split(/\s+/)[0] || null;
  // What the chat's cards are filled from (lib/chat-ui.ts fillDataBlocks).
  const toRow = (b: CopilotBlock): ScheduleRow => ({ start: b.start, end: b.end, subject: b.subject, type: b.type, status: b.status ?? 'pending' });
  const uiData: DataSnapshot = {
    todayKey,
    tomorrowKey: format(addDays(now, 1), 'yyyy-MM-dd'),
    schedule: {
      [todayKey]: { label: 'Today', rows: context.todayBlocks.map(toRow) },
      [format(addDays(now, 1), 'yyyy-MM-dd')]: { label: 'Tomorrow', rows: context.tomorrowBlocks.map(toRow) },
      ...Object.fromEntries(aheadDays.map((d) => [d.key, { label: d.label, rows: d.rows }])),
    },
    exams: examRows.map((e) => ({ title: e.title, subject: e.subject, date: e.date, daysLeft: e.daysLeft, time: e.time })),
    homework: homeworkRows.map((h) => ({ subject: h.subject, title: h.title, due: h.due, daysLeft: h.daysLeft })),
    marks: markSubjects
      .map((subject) => {
        const latest = latestBySubject.get(subject);
        const percent = latest ? parseGradeToPercentage(latest) : null;
        return percent === null ? null : { subject, percent: Math.round(percent * 10) / 10, goal: goalBySubject.get(subject.toLowerCase()) ?? null };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null),
  };

  return { context, rows, subjects, uiData, panelBase: { ...panelBase, studentName: studentName === 'Student' ? null : studentName, nextUp: context.nextUp ?? null }, scope };
}


/** "Physics revision at 19:00 (in 25 min)", or what is first tomorrow. */
function nextUpLine(now: string, todayBlocks: CopilotBlock[], tomorrowBlocks: CopilotBlock[]): string | null {
  const pending = todayBlocks.filter((b) => b.status === 'pending');
  const running = pending.find((b) => b.start <= now && (b.end > now || b.end < b.start));
  if (running) return `${running.subject} (${running.start}-${running.end}) is happening now.`;
  const later = pending.filter((b) => b.start > now).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (later) {
    const [h, mi] = later.start.split(':').map(Number);
    const [nh, nm] = now.split(':').map(Number);
    const mins = h * 60 + mi - (nh * 60 + nm);
    return `${later.subject} at ${later.start} (in ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}).`;
  }
  const first = [...tomorrowBlocks].sort((a, b) => a.start.localeCompare(b.start))[0];
  return first ? `Nothing left today. Tomorrow starts with ${first.subject} at ${first.start}.` : 'Nothing else planned today or tomorrow.';
}

const PLAN_INSTRUCTIONS = `MAKING PLANS: you can add exams and study blocks to the student's schedule, but only as a plan they confirm with a Yes button. Use it when they ask you to schedule, plan, add or set up an exam, revision or study sessions.
- Build the plan from their real schedule above. Put blocks in free time only: never on top of a study block, school hours, another step of the plan, or a public holiday. Use the date keys shown (YYYY-MM-DD). Dates must be today or later, at most two weeks ahead.
- Sensible defaults: revision blocks of 45-90 minutes, in the evening after school, spread over the days before the exam, with more of them close to it; at most two a day.
- Add an exam step only for an exam that is NOT already in UPCOMING EXAMS.
- If something you need is missing (like the exam date), ask for it first instead of guessing.
- Reply with two or three short sentences explaining the plan (do not list every step: the app shows them as a card), then end with this exact line on its own:
[[PLAN {"title":"<short name>","steps":[{"kind":"exam","subject":"<subject>","date":"YYYY-MM-DD","start":"HH:MM or null","end":"HH:MM or null","category":"<like Midterm, or null>"},{"kind":"block","subject":"<subject>","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","type":"REVISION or HOMEWORK"}]}]]
- Nothing changes until they press Yes, so never say it is already added. One plan per reply.`;

/* ----------------------------------------------------------------- turns */

export type PreparedTurn =
  | { kind: 'answered'; sessionId: string; session?: CopilotSession; userMessage: CopilotMessage; reply: CopilotMessage }
  | {
      kind: 'ask';
      sessionId: string;
      session?: CopilotSession;
      userMessage: CopilotMessage;
      userMessageId: string;
      system: string;
      messages: TalkMessage[];
      evidence: ReturnType<typeof buildEvidence>;
      subjects: string[];
      todayKey: string;
      uiData: DataSnapshot;
    };

/**
 * Save the question (once per requestId) and build what the model is told.
 * A retried turn that already has its answer, or small talk, comes back
 * answered without asking the model.
 */
export async function prepareCopilotTurn(
  userId: string,
  input: { sessionId: string | null; question: string; requestId: string }
): Promise<PreparedTurn> {
  const question = input.question.trim().slice(0, MAX_QUESTION);
  if (!question) throw new Error('Type a question first.');
  const requestId = String(input.requestId ?? '').slice(0, 100);
  if (!requestId) throw new Error('Missing request id.');

  let sessionId = input.sessionId;
  let session: CopilotSession | undefined;
  if (sessionId) {
    const owned = await prisma.chatSession.findFirst({ where: { id: sessionId, userId, mode: MODE }, select: { id: true } });
    if (!owned) sessionId = null;
  }

  // The context is gathered while the question is saved, not after.
  const gatheredPromise = gather(userId);
  gatheredPromise.catch(() => {});
  if (!sessionId) {
    const created = await prisma.chatSession.create({
      data: { userId, mode: MODE, title: titleFromQuestion(question), ...(await requireClassStamp(userId)) },
      select: { id: true, title: true, updatedAt: true },
    });
    sessionId = created.id;
    session = { id: created.id, title: created.title, updatedAt: created.updatedAt.toISOString() };
  }

  const begun = await beginTurn(prisma, sessionId, requestId, question);
  if (begun.answered) {
    return { kind: 'answered', sessionId, session, userMessage: toMessage(begun.userMessage), reply: toMessage(begun.answered) };
  }
  const userMessage = begun.userMessage;
  await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });

  // "hello", "thanks", "ok": answered here, without a request to the AI.
  const ready = quickReply(question, requestId);
  if (ready) {
    const finished = await finishTurn(prisma, sessionId, userMessage.id, ready, null);
    if ('stopped' in finished) throw new Error('Stopped.');
    return { kind: 'answered', sessionId, session, userMessage: toMessage(finished.userMessage), reply: toMessage(finished.reply) };
  }

  const [earlier, gathered, otherChats] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId, createdAt: { lt: userMessage.createdAt }, NOT: { status: 'FAILED' } },
      select: { role: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
    }),
    gatheredPromise,
    prisma.chatSession.findMany({
      where: { userId, mode: MODE, id: { not: sessionId }, deletedAt: null, updatedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
      orderBy: { updatedAt: 'desc' },
      take: OTHER_CHATS,
      select: {
        title: true,
        updatedAt: true,
        messages: { where: { role: 'user', NOT: { status: 'FAILED' } }, orderBy: { createdAt: 'desc' }, take: 2, select: { content: true } },
      },
    }),
  ]);
  // Practice and plan references are for the app; the model gets them as words.
  const history: TalkMessage[] = earlier
    .reverse()
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: widgetsForModel(planForModel(practiceRefsForModel(m.content))) }));
  const recentUser = earlier.filter((m) => m.role === 'user').map((m) => m.content);

  const intent = detectIntent(question, recentUser, gathered.subjects);
  const evidence = buildEvidence(intent, gathered.rows);
  const earlierChats = otherChats.length
    ? `EARLIER CHATS WITH THIS STUDENT (newest first; bring one up only if it is relevant):
${otherChats
        .map((c) => `- ${formatDistanceToNowStrict(c.updatedAt, { addSuffix: true })}: "${c.title}"${c.messages.length ? `, they asked: ${c.messages.map((m) => `"${m.content.replace(/\s+/g, ' ').slice(0, 140)}"`).join(' and ')}` : ''}`)
        .join('\n')}`
    : '';
  const system = `${buildCopilotPrompt(gathered.context)}

THIS IS AN ONGOING CONVERSATION. Read the earlier messages before answering. Short follow-ups ("make it simpler", "and tomorrow?", "the second one", "why?", "more") are about what was just discussed: answer them in that context and do not start over. Keep track of the topic, the subject and anything the student told you earlier in the chat (their level, what they find hard, dates they mentioned).
${earlierChats ? `\n${earlierChats}\n` : ''}
${evidencePrompt(evidence, intent)}

When you state a fact from the RECORDS, cite it right after with its number, like [S2]. Do not cite anything for general explanations.

${PRACTICE_INSTRUCTIONS}

${PLAN_INSTRUCTIONS}

${DRAWING_INSTRUCTIONS}`;

  return {
    kind: 'ask',
    sessionId,
    session,
    userMessage: toMessage(userMessage),
    userMessageId: userMessage.id,
    system,
    messages: [...history, { role: 'user', text: question }],
    evidence,
    subjects: gathered.subjects,
    todayKey: gathered.context.todayKey ?? format(new Date(), 'yyyy-MM-dd'),
    uiData: gathered.uiData,
  };
}

/**
 * The model has finished: make any practice it asked for, check any plan it
 * proposed, and save the reply. Returns null when the student stopped the
 * turn meanwhile (nothing is saved then).
 */
export async function completeCopilotTurn(
  turn: Extract<PreparedTurn, { kind: 'ask' }>,
  text: string
): Promise<{ userMessage: CopilotMessage; reply: CopilotMessage; practice?: StudySetSummary } | null> {
  const sources = citedSources(text, turn.evidence);
  const fulfilled = await fulfilPracticeRequest(text, turn.subjects);
  // Cards get the real records now, so what is saved is what was true.
  let content = fillDataBlocks(fulfilled.text, turn.uiData);
  const plan = parsePlanRequest(content, turn.todayKey);
  if (plan.kind === 'plan') content = `${plan.before}\n\n${planReference('PROPOSED', plan.plan)}`;
  else if (plan.kind === 'invalid') content = `${plan.before}\n\n${plan.reason}`;

  const finished = await finishTurn(prisma, turn.sessionId, turn.userMessageId, content, sources.length ? JSON.stringify(sources) : null);
  if ('stopped' in finished) return null;
  return { userMessage: toMessage(finished.userMessage), reply: toMessage(finished.reply), practice: fulfilled.practice };
}

/** The model gave nothing: mark the question as not answered so it can be retried. */
export async function failCopilotTurn(userMessageId: string): Promise<CopilotMessage> {
  return toMessage(await failTurn(prisma, userMessageId));
}
