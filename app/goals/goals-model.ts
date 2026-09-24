import { parseGradeToPercentage } from "../subjects/subject-model";

export type SubjectGradeType = {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
};

export type ReportCardType = {
  id: string;
  term: string;
  overallAverage: number | null;
  aiSummary: string | null;
  fileUrl: string | null;
  createdAt: Date;
  grades: SubjectGradeType[];
};

export type GoalType = {
  id: string;
  subject: string;
  targetGrade: number;
  createdAt: Date;
};

export type SubjectStanding = {
  subject: string;
  /** Latest numeric mark across report cards; undefined when never graded. */
  currentGrade?: number;
};

/** Strip "(revision)" and apostrophes so "Math (revision)" and "Math" collapse together. */
export function cleanSubject(s: string): string {
  if (!s) return "";
  return s.replace(/\s*\(revision\)\s*/gi, "").replace(/'/g, "").trim();
}

/**
 * Every subject the student has, with its latest numeric mark. Subjects come
 * from the timetable, resources and grades; the mark from the newest report
 * card that lists the subject.
 */
export function buildSubjectStandings(
  reportCards: ReportCardType[],
  uniqueSubjects: string[]
): SubjectStanding[] {
  const map = new Map<string, number>();
  uniqueSubjects.forEach((sub) => {
    if (sub) map.set(cleanSubject(sub), NaN);
  });

  // Oldest first, so newer grades overwrite older ones.
  const sorted = [...reportCards].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const rc of sorted) {
    for (const g of rc.grades) {
      const numGrade = parseGradeToPercentage(g.grade);
      if (numGrade === null) continue;
      const cleaned = cleanSubject(g.subject);
      // Match case-insensitively so "physics" on a card lands on "Physics".
      let key = cleaned;
      for (const existing of map.keys()) {
        if (existing.toLowerCase() === cleaned.toLowerCase()) {
          key = existing;
          break;
        }
      }
      map.set(key, numGrade);
    }
  }

  return Array.from(map.entries())
    .map(([subject, grade]) => ({ subject, currentGrade: Number.isNaN(grade) ? undefined : grade }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

/** The latest mark for a goal's subject, matched case-insensitively. */
export function currentGradeFor(standings: SubjectStanding[], subject: string): number | undefined {
  const wanted = cleanSubject(subject).toLowerCase();
  return standings.find((s) => s.subject.toLowerCase() === wanted)?.currentGrade;
}

/** The latest report card's average, or the mean of latest marks when it has none. Null with no marks. */
export function currentAverage(reportCards: ReportCardType[], standings: SubjectStanding[]): number | null {
  const latest = [...reportCards].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  if (latest?.overallAverage) return latest.overallAverage;
  const grades = standings.map((s) => s.currentGrade).filter((g): g is number => g !== undefined);
  if (grades.length === 0) return null;
  return parseFloat((grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1));
}
