/**
 * What Ask AI looks up for one question, and how it cites it.
 *
 * "Knows my app" means scoped, bounded retrieval, not every row in the
 * prompt: the question (and the last few turns) decide which kinds of record
 * are relevant, each kind is capped, and every fact handed to the model is
 * numbered [S1], [S2]... with a link to the real record. The reply's
 * citations become the source links shown under it.
 *
 * Kept apart on purpose, because they mean different things: OFFICIAL marks
 * (report cards), PRACTICE scores (only fully-marked attempts), and goals.
 * Missing data is said to be missing - never presented as a zero.
 *
 * Pure: copilot-actions.ts fetches the rows (scoped to the user and year);
 * this decides what is relevant and writes it down. Tested directly.
 */

import { parseGradeToPercentage } from './grades.ts';

export type EvidenceKind = 'MARK' | 'GOAL' | 'HOMEWORK' | 'EXAM' | 'RESOURCE' | 'PRACTICE' | 'LESSON' | 'FOCUS';

export type Evidence = { id: string; kind: EvidenceKind; label: string; href: string; text: string };

/** A record an answer cited; `id` is the [S#] marker used in the reply's text. */
export type Source = { id: string; label: string; href: string; kind: EvidenceKind };

export type Intent = {
  marks: boolean;
  resources: boolean;
  practice: boolean;
  lessons: boolean;
  focus: boolean;
  /** Subjects the conversation is about, as the student's own subject names. */
  subjects: string[];
};

export type RetrievalRows = {
  homework: { id: string; subject: string; title: string; due: string; daysLeft: number }[];
  exams: { id: string; title: string; subject: string | null; date: string; daysLeft: number; time: string | null }[];
  grades: { subject: string; grade: string; term: string }[];
  goals: { subject: string; targetGrade: number }[];
  resources: { subject: string; title: string }[];
  attempts: {
    setId: string;
    title: string;
    subject: string;
    score: number;
    markingStatus: string;
    when: string;
    wrong: { question: string; given: string; expected: string }[];
  }[];
  lessons: { day: string; subject: string; startTime: string; endTime: string }[];
  focus: { minutes: number; sessions: number } | null;
};

const LIMITS = { homework: 10, exams: 8, grades: 24, resources: 15, attempts: 6, wrongPerAttempt: 4, lessons: 40 };

const MARKS = /\b(marks?|grades?|results?|report|scored?|average|goal|target|progress(ing)?|percent|%|\d+\s*\/\s*\d+)\b|\/\d+/i;
const RESOURCES = /\b(pdf|notes?|resources?|files?|documents?|worksheets?|past papers?|slides?|textbook)\b/i;
const PRACTICE = /\b(quiz(zes)?|practi[cs]e|attempts?|wrong|mistakes?|mock|flash ?cards?|questions? i (got|missed))\b/i;
const LESSONS = /\b(lessons?|class(es)?|school|timetable|free time|around)\b/i;
const FOCUS = /\b(focus(ed)?|pomodoro|hours? (did i|have i)|studied|time spent)\b/i;

/** What a question (plus the last few user turns) is about. */
export function detectIntent(question: string, recentUserTurns: string[], knownSubjects: string[]): Intent {
  const text = [question, ...recentUserTurns.slice(-3)].join('\n');
  const lower = text.toLowerCase();
  const subjects = knownSubjects.filter((s) => {
    const name = s.trim().toLowerCase();
    if (name.length < 2) return false;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "Maths" is "Math": an optional plural, nothing longer.
    return new RegExp(`(^|[^a-z0-9])${escaped}s?([^a-z0-9]|$)`).test(lower);
  });
  return {
    marks: MARKS.test(question),
    resources: RESOURCES.test(question),
    practice: PRACTICE.test(question),
    lessons: LESSONS.test(question),
    focus: FOCUS.test(question),
    subjects,
  };
}

const sameSubject = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const inFocus = (intent: Intent, subject: string | null) =>
  intent.subjects.length === 0 || (subject !== null && intent.subjects.some((s) => sameSubject(s, subject)));

function due(daysLeft: number): string {
  if (daysLeft < 0) return `OVERDUE by ${-daysLeft} day${daysLeft === -1 ? '' : 's'}`;
  if (daysLeft === 0) return 'due today';
  if (daysLeft === 1) return 'due tomorrow';
  return `in ${daysLeft} days`;
}

/** Number the relevant records. Deadlines are always included; the rest by intent. */
export function buildEvidence(intent: Intent, rows: RetrievalRows): Evidence[] {
  const out: Omit<Evidence, 'id'>[] = [];

  for (const h of rows.homework.slice(0, LIMITS.homework)) {
    out.push({ kind: 'HOMEWORK', label: `${h.subject}: ${h.title}`, href: '/homeworks', text: `Homework ${h.subject}: ${h.title} - due ${h.due} (${due(h.daysLeft)})` });
  }
  for (const e of rows.exams.slice(0, LIMITS.exams)) {
    out.push({
      kind: 'EXAM',
      label: e.title,
      href: `/exams/${encodeURIComponent(e.id)}`,
      text: `Exam ${e.title}${e.subject && e.subject !== e.title ? ` (${e.subject})` : ''} - ${e.date}${e.time ? ` at ${e.time}` : ''} (${due(e.daysLeft)})`,
    });
  }

  const wantMarks = intent.marks || intent.subjects.length > 0;
  if (wantMarks) {
    const grades = rows.grades.filter((g) => inFocus(intent, g.subject)).slice(0, LIMITS.grades);
    for (const g of grades) {
      const pct = parseGradeToPercentage(g.grade);
      out.push({
        kind: 'MARK',
        label: `${g.subject} · ${g.term}`,
        href: '/marks',
        text: `OFFICIAL mark ${g.subject}, ${g.term}: ${g.grade}${pct === null ? ' (could not be read as a percentage)' : pct !== Number(g.grade) ? ` = ${pct}%` : '%'}`,
      });
    }
    for (const goal of rows.goals.filter((g) => inFocus(intent, g.subject))) {
      out.push({ kind: 'GOAL', label: `${goal.subject} goal`, href: '/marks?view=goals', text: `Goal ${goal.subject}: ${goal.targetGrade}%` });
    }
  }

  if (intent.resources || intent.subjects.length > 0) {
    const resources = rows.resources.filter((r) => inFocus(intent, r.subject)).slice(0, LIMITS.resources);
    for (const r of resources) {
      out.push({
        kind: 'RESOURCE',
        label: r.title,
        href: `/resources/${encodeURIComponent(r.subject)}`,
        text: `Resource in ${r.subject}: "${r.title}" (title only - its contents are not read here)`,
      });
    }
  }

  if (intent.practice || intent.marks || intent.subjects.length > 0) {
    for (const a of rows.attempts.filter((x) => inFocus(intent, x.subject)).slice(0, LIMITS.attempts)) {
      const status = a.markingStatus === 'FINAL' ? `${a.score}%` : `${a.score}% so far, some answers not marked yet`;
      const wrong = intent.practice
        ? a.wrong
            .slice(0, LIMITS.wrongPerAttempt)
            .map((w) => ` | missed: "${w.question.slice(0, 160)}" (answered "${w.given.slice(0, 80)}", expected "${w.expected.slice(0, 80)}")`)
            .join('')
        : '';
      out.push({
        kind: 'PRACTICE',
        label: `${a.title} (${a.subject})`,
        href: `/ai?set=${encodeURIComponent(a.setId)}`,
        text: `PRACTICE (not an official mark) "${a.title}" ${a.subject}, ${a.when}: ${status}${wrong}`,
      });
    }
  }

  if (intent.lessons) {
    for (const l of rows.lessons.slice(0, LIMITS.lessons)) {
      out.push({ kind: 'LESSON', label: `${l.day} ${l.subject}`, href: '/school-timetable', text: `School lesson ${l.day} ${l.startTime}-${l.endTime} ${l.subject}` });
    }
  }

  if (intent.focus) {
    out.push({
      kind: 'FOCUS',
      label: 'Focus totals',
      href: '/focus',
      text: rows.focus
        ? `Focus sessions in total: ${rows.focus.sessions}, ${rows.focus.minutes} minutes. Per-session history is not recorded.`
        : 'No focus sessions are recorded.',
    });
  }

  return out.map((e, i) => ({ ...e, id: `S${i + 1}` }));
}

/** The evidence as the model reads it. */
export function evidencePrompt(evidence: Evidence[], intent: Intent): string {
  const lines = evidence.map((e) => `[${e.id}] ${e.text}`);
  const missing: string[] = [];
  const has = (k: EvidenceKind) => evidence.some((e) => e.kind === k);
  if ((intent.marks || intent.subjects.length) && !has('MARK')) missing.push('no official marks recorded' + (intent.subjects.length ? ` for ${intent.subjects.join(', ')}` : ''));
  if (intent.resources && !has('RESOURCE')) missing.push('no resources found');
  if (intent.practice && !has('PRACTICE')) missing.push('no fully-marked practice attempts');
  return [
    'RECORDS (cite the ones you use as [S1], [S2]...; official marks, practice scores and goals are different things - never mix them):',
    ...(lines.length ? lines : ['(none relevant)']),
    ...(missing.length ? [`MISSING: ${missing.join('; ')}. Say so plainly instead of guessing.`] : []),
  ].join('\n');
}

/** The records the reply actually cited, in the order first cited. */
export function citedSources(reply: string, evidence: Evidence[]): Source[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const match of reply.matchAll(/\[(S\d+)(?:\s*,\s*(S\d+))*\]/g)) {
    const ids = match[0].slice(1, -1).split(',').map((x) => x.trim());
    for (const id of ids) {
      const e = byId.get(id);
      if (!e || seen.has(id)) continue;
      seen.add(id);
      out.push({ id: e.id, label: e.label, href: e.href, kind: e.kind });
    }
  }
  return out;
}
