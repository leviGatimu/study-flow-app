/**
 * Where each subject stands against its target, from everything the student
 * has recorded: exam results this term (a midterm, a quiz) and the newest
 * report card. Also ranks the subjects that most need attention.
 *
 * Pure, so the rules are tested on their own (test/subject-progress.test.mjs)
 * and the Goals tab, the Focus tab and the exam page all show the same numbers.
 *
 * The rules, in plain terms:
 * - Exams marked this term are the freshest evidence, so they decide "where
 *   you are" when there are any. The report card is the fallback.
 * - Exams with a weight (share of the term grade) for every result are
 *   averaged by weight; otherwise each exam counts the same, and the page says
 *   so.
 * - "Needed on what's left" is the average still needed on this subject's
 *   coming exams to land on the target, with the same weighting rule.
 */
import { parseGradeToPercentage } from './grades.ts';

export type ProgressExam = {
  id: string;
  title: string;
  date: Date | string;
  kind: string | null;
  category: string | null;
  weight: number | null;
  score: number | null;
  maxScore: number | null;
  subject: { name: string } | null;
  /** True once the exam has been sat (the caller decides, in the user's timezone). */
  done: boolean;
  /** Days from today in the user's timezone; worked out from UTC dates when absent. */
  daysAway?: number;
};

export type ProgressReportCard = {
  term: string;
  createdAt: Date | string;
  grades: { subject: string; grade: string }[];
};

export type ProgressGoal = { subject: string; targetGrade: number };

export type ExamResult = {
  id: string;
  title: string;
  date: string;
  category: string | null;
  percent: number;
  weight: number | null;
};

export type ComingExam = {
  id: string;
  title: string;
  date: string;
  /** Whole days from today; 0 is today. */
  daysAway: number;
  weight: number | null;
};

export type SubjectProgress = {
  subject: string;
  target: number | null;
  /** Marked exams this term, oldest first. */
  results: ExamResult[];
  /** Exams not sat yet, soonest first. */
  coming: ComingExam[];
  /** Exams sat with no mark entered yet. */
  pending: number;
  examAverage: number | null;
  /** True when the exam average is weighted by each exam's share of the grade. */
  weighted: boolean;
  reportMark: number | null;
  reportTerm: string | null;
  /** Where the student is now: the exam average when there is one, else the report mark. */
  current: number | null;
  source: 'exams' | 'report' | null;
  /** current - target; negative means behind. Null without both. */
  gap: number | null;
  /** Average needed on the coming exams to reach the target. Null when it cannot be worked out. */
  needed: number | null;
  /** Change between the last two results, in percentage points. */
  trend: number | null;
};

export type FocusReason = { text: string; tone: 'danger' | 'warning' | 'default' };

export type FocusItem = {
  progress: SubjectProgress;
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: FocusReason[];
};

const DAY_MS = 86_400_000;
/** An exam this close adds weight to a subject's focus score. */
const SOON_DAYS = 21;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "Math (revision)", "math" and "Math " are one subject. */
export function progressKey(subject: string): string {
  return subject.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function examPercent(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || !(maxScore > 0)) return null;
  return round1((score / maxScore) * 100);
}

function dayStart(date: Date | string): number {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function iso(date: Date | string): string {
  return new Date(date).toISOString();
}

/** Mean of results, by weight when every result has one. */
function averageOf(results: { percent: number; weight: number | null }[]): { value: number; weighted: boolean } | null {
  if (results.length === 0) return null;
  const weighted = results.every((r) => r.weight !== null && r.weight > 0);
  if (weighted) {
    const total = results.reduce((s, r) => s + (r.weight as number), 0);
    return { value: round1(results.reduce((s, r) => s + r.percent * (r.weight as number), 0) / total), weighted };
  }
  return { value: round1(results.reduce((s, r) => s + r.percent, 0) / results.length), weighted };
}

/**
 * The average still needed on the coming exams so the whole set lands on the
 * target. Uses weights only when every exam involved has one.
 */
export function neededOnRest(
  target: number,
  results: { percent: number; weight: number | null }[],
  coming: { weight: number | null }[]
): number | null {
  if (coming.length === 0) return null;
  const all = [...results, ...coming];
  const useWeights = all.every((e) => e.weight !== null && e.weight > 0);
  const w = (e: { weight: number | null }) => (useWeights ? (e.weight as number) : 1);
  const doneWeight = results.reduce((s, r) => s + w(r), 0);
  const restWeight = coming.reduce((s, c) => s + w(c), 0);
  const earned = results.reduce((s, r) => s + r.percent * w(r), 0);
  return round1((target * (doneWeight + restWeight) - earned) / restWeight);
}

/** The newest report card that lists each subject with a readable mark. */
function latestReportMarks(cards: ProgressReportCard[]): Map<string, { mark: number; term: string }> {
  const marks = new Map<string, { mark: number; term: string }>();
  const oldestFirst = [...cards].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const card of oldestFirst) {
    for (const g of card.grades) {
      const mark = parseGradeToPercentage(g.grade);
      if (mark === null) continue;
      marks.set(progressKey(g.subject), { mark, term: card.term });
    }
  }
  return marks;
}

/**
 * One entry per subject the student has (from `subjects`, goals, exams and
 * report cards), alphabetical. `now` decides how many days away an exam is.
 */
export function buildSubjectProgress(input: {
  subjects: string[];
  goals: ProgressGoal[];
  exams: ProgressExam[];
  reportCards: ProgressReportCard[];
  now: Date;
}): SubjectProgress[] {
  const names = new Map<string, string>();
  const addName = (name: string | null | undefined) => {
    const clean = (name ?? '').replace(/\s*\(revision\)\s*/gi, '').replace(/\s+/g, ' ').trim();
    if (clean && !names.has(progressKey(clean))) names.set(progressKey(clean), clean);
  };
  input.subjects.forEach(addName);
  input.goals.forEach((g) => addName(g.subject));
  input.exams.forEach((e) => addName(e.subject?.name));
  input.reportCards.forEach((c) => c.grades.forEach((g) => addName(g.subject)));

  const targets = new Map(input.goals.map((g) => [progressKey(g.subject), g.targetGrade]));
  const reports = latestReportMarks(input.reportCards);
  const today = dayStart(input.now);

  return [...names.entries()]
    .map(([key, subject]): SubjectProgress => {
      const exams = input.exams
        .filter((e) => e.subject && progressKey(e.subject.name) === key)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const results: ExamResult[] = [];
      const coming: ComingExam[] = [];
      let pending = 0;
      for (const e of exams) {
        const percent = examPercent(e.score, e.maxScore);
        if (percent !== null) {
          results.push({ id: e.id, title: e.title, date: iso(e.date), category: e.category, percent, weight: e.weight });
        } else if (e.done) {
          pending += 1;
        } else {
          coming.push({
            id: e.id,
            title: e.title,
            date: iso(e.date),
            daysAway: Math.max(0, e.daysAway ?? Math.round((dayStart(e.date) - today) / DAY_MS)),
            weight: e.weight,
          });
        }
      }

      const average = averageOf(results);
      const report = reports.get(key) ?? null;
      const target = targets.get(key) ?? null;
      const current = average?.value ?? report?.mark ?? null;
      const source = average ? 'exams' : report ? 'report' : null;
      const last = results.at(-1);
      const before = results.at(-2);

      return {
        subject,
        target,
        results,
        coming,
        pending,
        examAverage: average?.value ?? null,
        weighted: average?.weighted ?? false,
        reportMark: report?.mark ?? null,
        reportTerm: report?.term ?? null,
        current,
        source,
        gap: target !== null && current !== null ? round1(current - target) : null,
        // Only from exam results: a report card mark is a different scale of
        // thing (the whole term), so it is not mixed into exam arithmetic.
        needed: target !== null && results.length > 0 ? neededOnRest(target, results, coming) : null,
        trend: last && before ? round1(last.percent - before.percent) : null,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function whenText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${plural(days, 'day')}`;
}

/**
 * The subjects that most need attention, most urgent first, each with the
 * plain reasons behind its place. Subjects with nothing pulling them up are
 * left out (they are on track, or there is nothing to judge them by).
 *
 * Score parts (points of percentage, so they add up sensibly):
 * - behind the target: the gap itself
 * - no target: how far below the student's own average it sits
 * - falling: half the drop between the last two results
 * - an exam within three weeks: up to 10, more the closer it is, doubled
 *   when the subject is already behind
 * - needing over 90% on what is left: 10
 */
export function rankFocus(progress: SubjectProgress[]): FocusItem[] {
  const known = progress.map((p) => p.current).filter((c): c is number => c !== null);
  const ownAverage = known.length >= 2 ? round1(known.reduce((s, c) => s + c, 0) / known.length) : null;

  const items: FocusItem[] = [];
  for (const p of progress) {
    let score = 0;
    const reasons: FocusReason[] = [];
    let behind = false;

    if (p.gap !== null && p.gap < 0) {
      behind = true;
      score += -p.gap;
      reasons.push({ text: `${round1(-p.gap)} points under your ${p.target}% target`, tone: 'danger' });
    } else if (p.target === null && p.current !== null && ownAverage !== null && p.current < ownAverage - 2) {
      behind = true;
      score += ownAverage - p.current;
      reasons.push({ text: `Below your average of ${ownAverage}%`, tone: 'warning' });
    }

    if (p.trend !== null && p.trend <= -3) {
      score += -p.trend / 2;
      reasons.push({ text: `Down ${round1(-p.trend)} points since the last exam`, tone: 'warning' });
    }

    const next = p.coming[0];
    if (next && next.daysAway <= SOON_DAYS) {
      const urgency = ((SOON_DAYS - next.daysAway) / SOON_DAYS) * 10;
      score += behind || p.current === null ? urgency * 2 : urgency;
      reasons.push({ text: `${next.title} ${whenText(next.daysAway)}`, tone: next.daysAway <= 7 ? 'warning' : 'default' });
    }

    if (p.needed !== null && p.needed > 90) {
      score += 10;
      reasons.push({
        text: p.needed > 100 ? 'Target is out of reach on the exams left' : `Needs ${p.needed}% on what is left`,
        tone: 'danger',
      });
    }

    if (p.current === null && next && next.daysAway <= SOON_DAYS) {
      reasons.push({ text: 'No mark yet to judge it by', tone: 'default' });
    }

    if (score <= 0) continue;
    items.push({ progress: p, score: round1(score), level: score >= 20 ? 'high' : score >= 8 ? 'medium' : 'low', reasons });
  }

  return items.sort((a, b) => b.score - a.score || a.progress.subject.localeCompare(b.progress.subject));
}
