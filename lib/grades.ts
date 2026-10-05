/**
 * Report-card grades as percentages - the ONE parser Marks, Goals, Subjects,
 * Insights and the report-card average all use (audit D02).
 *
 * Before this there were three. Marks stripped every non-digit, so "A-" became
 * 0 and "18/20" became 1820 in a stored average; Insights read "18/20" as 18
 * and used a different letter scale from Subjects. The same report card showed
 * three different numbers on three pages.
 *
 * Unreadable or impossible grades are null, never 0: they are left out of an
 * average instead of dragging it down.
 *
 * Pure and dependency-free so `node --test` can import it directly.
 */

/** Letter grades: a plain letter is the middle of its band. */
const LETTER_BASE: Record<string, number> = { A: 93, B: 83, C: 73, D: 63, E: 55, F: 50 };
const MODIFIER: Record<string, number> = { '+': 4, '-': -3, '': 0 };

/**
 * Accepts "78", "78%", "78.5 %", "18/20", "18 / 20", "A", "A-", "b+".
 * Rejects (null) anything else, and impossible values: over 100%, a score
 * above its total, a zero or negative total.
 */
export function parseGradeToPercentage(raw: string | null | undefined): number | null {
  const grade = (raw ?? '').trim();
  if (!grade) return null;

  const fraction = grade.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const score = Number(fraction[1]);
    const out = Number(fraction[2]);
    if (!(out > 0) || score > out) return null;
    return Math.round((score / out) * 1000) / 10;
  }

  const percent = grade.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (percent) {
    const value = Number(percent[1]);
    return value <= 100 ? value : null;
  }

  const letter = grade.toUpperCase().match(/^([A-F])\s*([+-]?)$/);
  if (letter) return LETTER_BASE[letter[1]] + MODIFIER[letter[2]];

  return null;
}

/**
 * The average of the readable grades, to one decimal place, or null when none
 * can be read - a card with no marks yet has no average, not an average of 0.
 */
export function averageGrades(grades: (string | null | undefined)[]): number | null {
  const values = grades.map(parseGradeToPercentage).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
