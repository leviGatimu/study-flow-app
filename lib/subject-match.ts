/**
 * One spelling per subject.
 *
 * Lessons and study blocks store the subject as text, so "Physics", "physics"
 * and "Physics " would otherwise be three subjects as far as every list and
 * filter is concerned. Anything typed (or read off a timetable photo) is
 * matched against the subjects the person already has, ignoring case and
 * spacing, and stored under that existing name.
 */

export const normalizeSubject = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');

/** The existing subject this name refers to, or the tidied name itself when it is new. */
export function canonicalSubject(name: string, known: string[]): string {
  const wanted = normalizeSubject(name);
  return known.find((k) => normalizeSubject(k) === wanted) ?? tidy(name);
}

export type FoundSubject = { name: string; isNew: boolean };

/**
 * The subjects a timetable contains, once each.
 *
 * A timetable repeats its subjects across the week, so its lessons are not a
 * subject list: "Math II" on Monday and "Math II" on Tuesday are one subject.
 * Lesson names are mapped onto, in order: a subject the person already has,
 * then the model's own de-duplicated list, then themselves. Breaks are never
 * subjects.
 */
export function unifyTimetableSubjects<L extends { subject: string; isBreak?: boolean }>(
  lessons: L[],
  modelSubjects: unknown,
  existing: string[]
): { lessons: L[]; subjects: FoundSubject[] } {
  const proposed = Array.isArray(modelSubjects) ? modelSubjects.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
  const vocabulary: string[] = [...existing];
  for (const s of proposed) if (!vocabulary.some((v) => normalizeSubject(v) === normalizeSubject(s))) vocabulary.push(tidy(s));

  const mapped = lessons.map((lesson) => (lesson.isBreak ? lesson : { ...lesson, subject: canonicalSubject(lesson.subject, vocabulary) }));

  const seen = new Map<string, string>();
  for (const lesson of mapped) {
    if (lesson.isBreak) continue;
    const key = normalizeSubject(lesson.subject);
    if (!seen.has(key)) seen.set(key, lesson.subject);
  }
  const existingKeys = new Set(existing.map(normalizeSubject));
  const subjects = [...seen.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, isNew: !existingKeys.has(normalizeSubject(name)) }));
  return { lessons: mapped, subjects };
}
