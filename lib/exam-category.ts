/**
 * Exam categories: one sitting across subjects, such as "Midterm 1".
 *
 * A category is a plain label on each exam, not its own table, so it syncs
 * with the exam and needs no setup. Two exams are in the same category when
 * their labels match ignoring case and spacing; the first spelling seen wins
 * for display.
 */

export const CATEGORY_MAX_LENGTH = 40;

/** Trim, collapse spaces and cap the length. Empty means "no category". */
export function normaliseCategory(value: string | null | undefined): string | null {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, CATEGORY_MAX_LENGTH).trim();
  return clean || null;
}

const keyOf = (name: string) => name.toLowerCase();

type CategorisedExam = {
  id: string;
  title: string;
  date: Date | string;
  category: string | null;
  score: number | null;
  maxScore: number | null;
  subject: { name: string } | null;
};

export type CategoryExam = {
  id: string;
  title: string;
  subject: string | null;
  date: Date | string;
  /** Rounded percentage, or null while marks are pending. */
  percent: number | null;
};

export type CategorySummary = {
  name: string;
  exams: CategoryExam[];
  /** Exams with a result. */
  graded: number;
  /** Mean of each graded exam's percentage, so every subject counts the same. */
  average: number | null;
  best: CategoryExam | null;
  lowest: CategoryExam | null;
  /** The latest exam date, used to put the newest sitting first. */
  lastDate: number;
};

function percentOf(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || !(maxScore > 0)) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

/** Group exams by category, newest sitting first. Uncategorised exams are left out. */
export function summariseCategories(exams: CategorisedExam[]): CategorySummary[] {
  const groups = new Map<string, { name: string; exams: CategoryExam[] }>();

  for (const exam of exams) {
    const name = normaliseCategory(exam.category);
    if (!name) continue;
    const group = groups.get(keyOf(name)) ?? { name, exams: [] };
    group.exams.push({
      id: exam.id,
      title: exam.title,
      subject: exam.subject?.name ?? null,
      date: exam.date,
      percent: percentOf(exam.score, exam.maxScore),
    });
    groups.set(keyOf(name), group);
  }

  return [...groups.values()]
    .map(({ name, exams: rows }) => {
      rows.sort((a, b) => (a.subject ?? a.title).localeCompare(b.subject ?? b.title));
      const graded = rows.filter((r) => r.percent !== null);
      const byScore = [...graded].sort((a, b) => (b.percent as number) - (a.percent as number));
      const average = graded.length
        ? Math.round((graded.reduce((sum, r) => sum + (r.percent as number), 0) / graded.length) * 10) / 10
        : null;
      return {
        name,
        exams: rows,
        graded: graded.length,
        average,
        best: graded.length > 1 ? byScore[0] : null,
        lowest: graded.length > 1 ? byScore[byScore.length - 1] : null,
        lastDate: Math.max(...rows.map((r) => new Date(r.date).getTime())),
      };
    })
    .sort((a, b) => b.lastDate - a.lastDate || a.name.localeCompare(b.name));
}

/** Distinct category names, for suggestions in a text field. */
export function categoryNames(exams: { category: string | null }[]): string[] {
  const seen = new Map<string, string>();
  for (const exam of exams) {
    const name = normaliseCategory(exam.category);
    if (name && !seen.has(keyOf(name))) seen.set(keyOf(name), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Whether an exam is in the named category (same matching as the groups). */
export function inCategory(exam: { category: string | null }, name: string): boolean {
  const own = normaliseCategory(exam.category);
  const wanted = normaliseCategory(name);
  return Boolean(own && wanted && keyOf(own) === keyOf(wanted));
}
