/**
 * Plans the Study chat proposes and the student confirms, as plain functions
 * (no Prisma, no `@/` imports) so test/copilot-plan.test.mjs runs them.
 *
 * The model proposes changes by ending its reply with
 *   [[PLAN {"title":"...","steps":[{"kind":"exam",...},{"kind":"block",...}]}]]
 * The saved reply keeps the checked plan and where it stands instead:
 *   [[plan:PROPOSED {...}]]   waiting for Yes / Not now
 *   [[plan:APPLIED {...}]]    done; each step has its outcome
 *   [[plan:DISMISSED {...}]]  the student said no
 * Nothing changes in the app until the student presses Yes, and the plan is
 * read back from the saved message then, never from the browser.
 */

export type ExamStep = {
  kind: 'exam';
  subject: string;
  date: string;
  start: string | null;
  end: string | null;
  category: string | null;
};

export type BlockStep = {
  kind: 'block';
  subject: string;
  date: string;
  start: string;
  end: string;
  type: 'REVISION' | 'HOMEWORK';
};

export type PlanStep = (ExamStep | BlockStep) & {
  /** Filled in when the plan is applied. */
  outcome?: 'done' | 'skipped';
  note?: string;
};

export type CopilotPlan = { title: string; steps: PlanStep[] };
export type PlanState = 'PROPOSED' | 'APPLIED' | 'DISMISSED';
export type StoredPlan = { state: PlanState; plan: CopilotPlan };

export const MAX_PLAN_STEPS = 30;

const REQUEST = /\[\[PLAN\s*(\{[\s\S]*?\})\s*\]\]/;
const STORED = /\[\[plan:(PROPOSED|APPLIED|DISMISSED)\s*(\{[\s\S]*?\})\s*\]\]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!DATE.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

/** "9:30" -> "09:30"; anything that is not a clock time -> null. */
function validTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  const padded = /^\d:\d{2}$/.test(s) ? `0${s}` : s;
  return TIME.test(padded) ? padded : null;
}

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export type ParsedPlan =
  | { kind: 'none' }
  | { kind: 'invalid'; before: string; reason: string }
  | { kind: 'plan'; before: string; plan: CopilotPlan };

/**
 * Read and check a plan line. `todayKey` is "YYYY-MM-DD" in the student's
 * timezone: nothing is planned in the past. Steps that do not check out are
 * dropped; a plan with none left is invalid.
 */
export function parsePlanRequest(text: string, todayKey: string): ParsedPlan {
  const match = text.match(REQUEST);
  if (!match) return { kind: 'none' };
  const before = text.replace(REQUEST, '').trimEnd();

  let raw: { title?: unknown; steps?: unknown };
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return { kind: 'invalid', before, reason: 'I could not put that plan together. Ask me again and I will retry.' };
  }

  const steps: PlanStep[] = [];
  for (const item of Array.isArray(raw.steps) ? raw.steps.slice(0, MAX_PLAN_STEPS) : []) {
    if (!item || typeof item !== 'object') continue;
    const step = item as Record<string, unknown>;
    const subject = clean(step.subject, 120);
    const date = validDate(step.date);
    if (!subject || !date || date < todayKey) continue;

    if (step.kind === 'exam') {
      const start = validTime(step.start);
      const end = validTime(step.end);
      // Both times or neither, like the exam form.
      const timed = start && end && start !== end;
      const category = clean(step.category, 40);
      steps.push({ kind: 'exam', subject, date, start: timed ? start : null, end: timed ? end : null, category: category && category !== 'null' ? category : null });
    } else if (step.kind === 'block') {
      const start = validTime(step.start);
      const end = validTime(step.end);
      if (!start || !end || start === end) continue;
      steps.push({ kind: 'block', subject, date, start, end, type: step.type === 'HOMEWORK' ? 'HOMEWORK' : 'REVISION' });
    }
  }

  if (steps.length === 0) {
    return { kind: 'invalid', before, reason: 'That plan had nothing I could add (dates must be today or later). Tell me the dates and I will try again.' };
  }
  steps.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
  return { kind: 'plan', before, plan: { title: clean(raw.title, 80) || 'Your plan', steps } };
}

/** The line saved in the reply in place of the request. */
export function planReference(state: PlanState, plan: CopilotPlan): string {
  // "]]" cannot appear inside: it would end the line early when read back.
  return `[[plan:${state} ${JSON.stringify(plan).replace(/\]\]/g, '] ]')}]]`;
}

/** Lift a saved plan out of a reply. */
export function splitPlan(content: string): { text: string; plan: StoredPlan | null } {
  const match = content.match(STORED);
  if (!match) return { text: content, plan: null };
  try {
    const plan = JSON.parse(match[2]) as CopilotPlan;
    if (!plan || !Array.isArray(plan.steps)) return { text: content, plan: null };
    return { text: content.replace(STORED, '').trimEnd(), plan: { state: match[1] as PlanState, plan } };
  } catch {
    return { text: content.replace(STORED, '').trimEnd(), plan: null };
  }
}

/** Replace the saved plan line (for Yes / Not now). */
export function replacePlan(content: string, next: StoredPlan): string {
  return content.replace(STORED, planReference(next.state, next.plan));
}

/** What the model sees of an earlier reply's plan. */
export function planForModel(content: string): string {
  const { text, plan } = splitPlan(content);
  if (!plan) return content;
  const status = plan.state === 'APPLIED' ? 'the student said yes and it was added' : plan.state === 'DISMISSED' ? 'the student said no' : 'waiting for the student to answer';
  const lines = plan.plan.steps.map((s) =>
    s.kind === 'exam'
      ? `- exam ${s.subject} on ${s.date}${s.start ? ` ${s.start}-${s.end}` : ''}`
      : `- ${s.type.toLowerCase()} ${s.subject} on ${s.date} ${s.start}-${s.end}${s.outcome === 'skipped' ? ' (skipped)' : ''}`
  );
  return `${text}\n\n(Plan "${plan.plan.title}", ${status}:\n${lines.join('\n')})`;
}

const MARKERS = ['[[PLAN', '[[PRACTICE'];

/**
 * A reply while it is still arriving, without the machine line at its end
 * (or the first characters of one, so "[[PL" never flashes up).
 */
export function liveReplyText(text: string): string {
  let cut = text.length;
  for (const marker of MARKERS) {
    const at = text.indexOf(marker);
    if (at >= 0) cut = Math.min(cut, at);
  }
  let shown = text.slice(0, cut);
  // The earliest point from which the rest could still become a marker.
  for (let i = Math.max(0, shown.length - 11); i < shown.length; i++) {
    const rest = shown.slice(i);
    if (rest.startsWith('[') && MARKERS.some((m) => m.startsWith(rest))) {
      shown = shown.slice(0, i);
      break;
    }
  }
  return shown.trimEnd();
}
