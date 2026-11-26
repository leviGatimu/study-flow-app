/**
 * Visual blocks the Study AI can put in a reply, as plain functions (no
 * Prisma, no `@/` imports) so test/chat-ui.test.mjs runs them.
 *
 * The model writes a fenced block with the language "ui" and one JSON object:
 *
 *   ```ui
 *   {"type":"bars","title":"Midterm marks","items":[{"label":"Java","value":82}]}
 *   ```
 *
 * Two kinds:
 * - DATA blocks (schedule, exams, homework, marks) only name what to show.
 *   The server fills in the student's real records when the reply is saved
 *   (fillDataBlocks), so the model can never put a wrong number in them.
 * - DRAWN blocks (stats, bars, steps, checklist, callout, table) carry their
 *   own content, checked and capped by readWidget.
 * Anything that does not check out is dropped from the saved reply.
 */

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type ScheduleRow = { start: string; end: string; subject: string; type: string; status: 'done' | 'missed' | 'pending' };
export type ExamRow = { title: string; subject: string | null; date: string; daysLeft: number; time: string | null };
export type HomeworkRow = { subject: string; title: string; due: string; daysLeft: number };
export type MarkRow = { subject: string; percent: number; goal: number | null };

export type Widget =
  | { type: 'schedule'; day: string; title?: string; rows?: ScheduleRow[]; label?: string }
  | { type: 'exams'; title?: string; rows?: ExamRow[] }
  | { type: 'homework'; title?: string; rows?: HomeworkRow[] }
  | { type: 'marks'; title?: string; rows?: MarkRow[] }
  | { type: 'stats'; title?: string; items: { label: string; value: string; hint?: string; tone?: Tone }[] }
  | { type: 'bars'; title?: string; unit?: string; max: number; items: { label: string; value: number }[] }
  | { type: 'steps'; title?: string; items: { title: string; detail?: string; time?: string }[] }
  | { type: 'checklist'; title?: string; items: { text: string; done: boolean }[] }
  | { type: 'callout'; tone: Tone; title?: string; text: string }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] };

export const DATA_TYPES = ['schedule', 'exams', 'homework', 'marks'] as const;
const TONES: Tone[] = ['primary', 'success', 'warning', 'danger', 'info'];
const MAX_ITEMS = 12;

const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const tone = (v: unknown): Tone | undefined => (TONES.includes(v as Tone) ? (v as Tone) : undefined);
const list = (v: unknown, max = MAX_ITEMS): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const optional = (v: unknown, max: number) => {
  const s = str(v, max);
  return s ? s : undefined;
};

/** Check one block's JSON. Data blocks come back without rows (the server adds them). */
export function readWidget(raw: unknown): Widget | null {
  const w = obj(raw);
  const title = optional(w.title, 80);
  switch (w.type) {
    case 'schedule': {
      const day = str(w.day, 10) || 'today';
      if (!/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/.test(day)) return null;
      return { type: 'schedule', day, title };
    }
    case 'exams':
    case 'homework':
    case 'marks':
      return { type: w.type, title };
    case 'stats': {
      const items = list(w.items, 6)
        .map(obj)
        .map((i) => ({ label: str(i.label, 40), value: str(i.value, 24), hint: optional(i.hint, 60), tone: tone(i.tone) }))
        .filter((i) => i.label && i.value);
      return items.length ? { type: 'stats', title, items } : null;
    }
    case 'bars': {
      const items = list(w.items)
        .map(obj)
        .map((i) => ({ label: str(i.label, 40), value: Number(i.value) }))
        .filter((i) => i.label && Number.isFinite(i.value) && i.value >= 0);
      if (!items.length) return null;
      const max = Number(w.max) > 0 ? Number(w.max) : Math.max(...items.map((i) => i.value), 1);
      return { type: 'bars', title, unit: optional(w.unit, 8), max, items };
    }
    case 'steps': {
      const items = list(w.items)
        .map(obj)
        .map((i) => ({ title: str(i.title, 80), detail: optional(i.detail, 200), time: optional(i.time, 24) }))
        .filter((i) => i.title);
      return items.length ? { type: 'steps', title, items } : null;
    }
    case 'checklist': {
      const items = list(w.items)
        .map((i) => (typeof i === 'string' ? { text: str(i, 120), done: false } : { text: str(obj(i).text, 120), done: obj(i).done === true }))
        .filter((i) => i.text);
      return items.length ? { type: 'checklist', title, items } : null;
    }
    case 'callout': {
      const text = str(w.text, 400);
      return text ? { type: 'callout', tone: tone(w.tone) ?? 'info', title, text } : null;
    }
    case 'table': {
      const columns = list(w.columns, 6).map((c) => str(c, 30)).filter(Boolean);
      if (!columns.length) return null;
      const rows = list(w.rows, 20).map((r) => columns.map((_, i) => str(Array.isArray(r) ? r[i] : '', 80)));
      return rows.length ? { type: 'table', title, columns, rows } : null;
    }
    default:
      return null;
  }
}

/** ```ui ... ``` blocks, complete ones only. */
const BLOCK = /```ui[ \t]*\n([\s\S]*?)\n?```/g;

export type DataSnapshot = {
  todayKey: string;
  tomorrowKey: string;
  schedule: Record<string, { label: string; rows: ScheduleRow[] }>;
  exams: ExamRow[];
  homework: HomeworkRow[];
  marks: MarkRow[];
};

/**
 * Turn every ui block in a finished reply into its checked, saved form: data
 * blocks get the real rows, drawn blocks are cleaned, broken ones vanish.
 */
export function fillDataBlocks(text: string, data: DataSnapshot): string {
  return text.replace(BLOCK, (_, json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return '';
    }
    const widget = readWidget(parsed);
    if (!widget) return '';
    let filled: Widget = widget;
    if (widget.type === 'schedule') {
      const key = widget.day === 'today' ? data.todayKey : widget.day === 'tomorrow' ? data.tomorrowKey : widget.day;
      const day = data.schedule[key];
      if (!day) return '';
      filled = { ...widget, label: day.label, rows: day.rows };
    } else if (widget.type === 'exams') filled = { ...widget, rows: data.exams.slice(0, MAX_ITEMS) };
    else if (widget.type === 'homework') filled = { ...widget, rows: data.homework.slice(0, MAX_ITEMS) };
    else if (widget.type === 'marks') filled = { ...widget, rows: data.marks.slice(0, MAX_ITEMS) };
    return `\`\`\`ui\n${JSON.stringify(filled)}\n\`\`\``;
  });
}

/** Read a saved block for display. Data blocks keep their rows (already checked on save). */
export function widgetForDisplay(json: string): Widget | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const widget = readWidget(parsed);
  if (!widget) return null;
  const rows = obj(parsed).rows;
  if ((DATA_TYPES as readonly string[]).includes(widget.type) && Array.isArray(rows)) {
    return { ...widget, rows: rows.slice(0, MAX_ITEMS), label: optional(obj(parsed).label, 40) } as Widget;
  }
  return widget;
}

/** What the model sees of an earlier reply: blocks as one short line each. */
export function widgetsForModel(content: string): string {
  return content.replace(BLOCK, (_, json: string) => {
    try {
      const t = obj(JSON.parse(json)).type;
      return `(A ${String(t)} card was shown.)`;
    } catch {
      return '';
    }
  });
}

export const DRAWING_INSTRUCTIONS = `DRAWING: the chat can show visual cards. Put one in a reply when it makes the answer clearer than text. Write a fenced block with the language ui and ONE JSON object on one line:
\`\`\`ui
{"type":"..."}
\`\`\`
Cards filled from the student's real records (just name them, never write their rows):
- {"type":"schedule","day":"today" | "tomorrow" | "YYYY-MM-DD"} their study blocks that day, with done/missed status
- {"type":"exams"} upcoming exams with countdowns
- {"type":"homework"} unfinished homework, soonest first
- {"type":"marks"} each subject's latest mark against their goal
Cards you fill in yourself:
- {"type":"stats","items":[{"label":"Exams this week","value":"3","hint":"optional","tone":"primary|success|warning|danger|info"}]} 2-4 key numbers
- {"type":"bars","title":"...","unit":"%","max":100,"items":[{"label":"Java","value":82}]} comparing amounts
- {"type":"steps","title":"...","items":[{"title":"...","detail":"...","time":"optional"}]} a method, a study order, a worked process
- {"type":"checklist","title":"...","items":[{"text":"...","done":false}]} things to do or revise
- {"type":"callout","tone":"info|success|warning|danger","title":"...","text":"..."} one key tip or warning
- {"type":"table","title":"...","columns":["..."],"rows":[["..."]]} when rows and columns genuinely help
Rules: for "what do I have today/tomorrow/on <day>" use a schedule card; for exams, homework or marks questions use those cards. At most three cards a reply. Add one or two sentences of your own around them; do not repeat in text what a card already shows. Never put a ui card inside a list or table. Use only numbers from the data above.`;

export type ReplyPart = { kind: 'text'; text: string } | { kind: 'widget'; json: string; complete: boolean };

/**
 * Split a reply into text and cards, so cards are drawn outside the
 * markdown's styles. A block still being written (no closing fence yet) is a
 * card that is not complete: it shows as a placeholder.
 */
export function splitReply(text: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  let rest = text;
  for (;;) {
    const open = rest.search(/```ui[ \t]*(\n|$)/);
    if (open < 0) break;
    if (rest.slice(0, open).trim()) parts.push({ kind: 'text', text: rest.slice(0, open) });
    const afterOpen = rest.slice(open).replace(/^```ui[ \t]*\n?/, '');
    const close = afterOpen.indexOf('```');
    if (close < 0) {
      parts.push({ kind: 'widget', json: afterOpen.trim(), complete: false });
      return parts;
    }
    parts.push({ kind: 'widget', json: afterOpen.slice(0, close).trim(), complete: true });
    rest = afterOpen.slice(close + 3);
  }
  if (rest.trim() || parts.length === 0) parts.push({ kind: 'text', text: rest });
  return parts;
}
