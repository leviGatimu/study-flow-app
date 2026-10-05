/**
 * What Ask AI knows about the student, and how it is told.
 *
 * Pure: the server action gathers rows into a CopilotContext, and everything
 * here turns that into the system prompt and the suggested prompts. Kept free
 * of Prisma and Next so `node --test` can exercise it directly.
 *
 * The context is rebuilt on every message, never stored with the chat - a
 * conversation from last week must not answer from last week's deadlines.
 */

export type CopilotBlock = {
  subject: string;
  start: string;
  end: string;
  type: string;
  status?: 'done' | 'missed' | 'pending';
};

export type CopilotContext = {
  /** "Monday 5 October 2026", in the student's timezone. */
  today: string;
  /** "18:40", the student's local time. */
  now: string;
  holidayToday: string | null;
  todayBlocks: CopilotBlock[];
  tomorrowBlocks: CopilotBlock[];
  /** Unfinished, soonest first. `daysLeft` is negative when overdue. */
  homework: { subject: string; title: string; due: string; daysLeft: number }[];
  /** Upcoming, soonest first. */
  exams: { title: string; subject: string | null; date: string; daysLeft: number; time: string | null }[];
  /** Subjects needing the most attention, worst first, with the reason. */
  weakSubjects: { subject: string; reason: string }[];
  /** The weekly study routine, one line per day that has blocks. */
  routine: { day: string; blocks: string[] }[];
  upcomingHolidays: { date: string; name: string }[];
};

export type SuggestedPrompt = { label: string; prompt: string };

const MAX_HOMEWORK = 12;
const MAX_EXAMS = 8;

function when(daysLeft: number): string {
  if (daysLeft < 0) return `OVERDUE by ${-daysLeft} day${daysLeft === -1 ? '' : 's'}`;
  if (daysLeft === 0) return 'due today';
  if (daysLeft === 1) return 'due tomorrow';
  return `in ${daysLeft} days`;
}

function blockLine(b: CopilotBlock): string {
  const kind = b.type === 'REVISION' ? 'revision' : b.type === 'EXAM' ? 'exam prep' : 'homework';
  const status = b.status && b.status !== 'pending' ? ` [${b.status}]` : '';
  return `- ${b.start}-${b.end} ${b.subject} (${kind})${status}`;
}

function section(title: string, lines: string[], empty: string): string {
  return `${title}\n${lines.length ? lines.join('\n') : empty}`;
}

export function buildCopilotPrompt(ctx: CopilotContext): string {
  const facts = [
    `Today is ${ctx.today}, and it is ${ctx.now} where the student is.`,
    ctx.holidayToday
      ? `Today is a public holiday (${ctx.holidayToday}); the study routine is off.`
      : null,
    section("TODAY'S STUDY BLOCKS:", ctx.todayBlocks.map(blockLine), '(none today)'),
    section("TOMORROW'S STUDY BLOCKS:", ctx.tomorrowBlocks.map(blockLine), '(none tomorrow)'),
    section(
      'UNFINISHED HOMEWORK (soonest first):',
      ctx.homework
        .slice(0, MAX_HOMEWORK)
        .map((h) => `- ${h.subject}: ${h.title} - ${h.due} (${when(h.daysLeft)})`),
      '(no unfinished homework)'
    ),
    section(
      'UPCOMING EXAMS:',
      ctx.exams
        .slice(0, MAX_EXAMS)
        .map(
          (e) =>
            `- ${e.title}${e.subject && e.subject !== e.title ? ` (${e.subject})` : ''} - ${e.date}${e.time ? ` at ${e.time}` : ''} (${when(e.daysLeft)})`
        ),
      '(no upcoming exams)'
    ),
    section(
      'SUBJECTS NEEDING ATTENTION (worst first):',
      ctx.weakSubjects.map((s) => `- ${s.subject}: ${s.reason}`),
      '(nothing flagged)'
    ),
    section(
      'WEEKLY STUDY ROUTINE:',
      ctx.routine.map((r) => `- ${r.day}: ${r.blocks.join(', ')}`),
      '(no routine set up)'
    ),
    ctx.upcomingHolidays.length
      ? section(
          'UPCOMING PUBLIC HOLIDAYS (no study blocks):',
          ctx.upcomingHolidays.map((h) => `- ${h.date}: ${h.name}`),
          ''
        )
      : null,
  ].filter(Boolean);

  return `You are the student's study copilot inside their study tracker. You know their real schedule, shown below, and you help them actually do the work: explain topics, plan revision, test them, and keep them on top of deadlines.

${facts.join('\n\n')}

HOW TO ANSWER
- Ground every answer about their workload in the data above. Never invent homework, exams or blocks. If something is not listed, say you cannot see it.
- For "what is most urgent", weigh overdue and soonest-due homework and the nearest exams first.
- When explaining a topic, teach it: start simple, build up, give a worked example, then check understanding with one short question.
- Use Markdown: short headings, bullet lists, tables when comparing, fenced code blocks with a language for code. Write maths in LaTeX: $...$ inline and $$...$$ for display.
- Be direct and encouraging, and keep it as short as the question allows. End with one concrete next step when it helps.
- You cannot change their timetable or records yourself. If they ask you to set something up, say exactly what to add (day, time, subject) so they can add it.`;
}

/**
 * Up to four starting points drawn from the student's own data, so the empty
 * chat offers what matters today rather than generic examples - and never a
 * subject from someone else's timetable.
 */
export function suggestPrompts(ctx: CopilotContext): SuggestedPrompt[] {
  const out: SuggestedPrompt[] = [];

  const nextBlock = ctx.todayBlocks.find((b) => b.status === 'pending' || !b.status);
  if (nextBlock) {
    out.push({
      label: `Prep for ${nextBlock.subject}`,
      prompt: `I have ${nextBlock.subject} at ${nextBlock.start} today. What are the key ideas I should focus on, and how should I use the ${nextBlock.start}-${nextBlock.end} block?`,
    });
  }

  const homework = ctx.homework[0];
  if (homework) {
    out.push({
      label: `Start: ${homework.title}`,
      prompt: `Help me get started on my ${homework.subject} homework "${homework.title}" (${when(homework.daysLeft)}). Break it into steps and explain anything I need to know first.`,
    });
  }

  const exam = ctx.exams[0];
  if (exam) {
    out.push({
      label: `Plan for ${exam.title}`,
      prompt: `My ${exam.title} exam is ${when(exam.daysLeft)}. Make me a day-by-day revision plan that fits around my study routine.`,
    });
  }

  const weak = ctx.weakSubjects[0];
  if (weak) {
    out.push({
      label: `Quiz me on ${weak.subject}`,
      prompt: `${weak.subject} is my weakest subject right now. Quiz me with 5 questions, one at a time, and explain each answer after I reply.`,
    });
  }

  out.push({
    label: 'What is most urgent?',
    prompt: 'What is my most urgent deadline this week, and what should I do about it today?',
  });

  return out.slice(0, 4);
}

/** A chat's title: its first question, trimmed to fit the history list. */
export function titleFromQuestion(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim();
  if (flat.length <= 60) return flat || 'New chat';
  const cut = flat.slice(0, 60);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
