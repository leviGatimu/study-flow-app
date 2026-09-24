import { differenceInCalendarDays, format } from "date-fns";

/**
 * The Subjects section's data as its client components see it, and the small
 * pure helpers they share. Kept free of React so the grade parser can be
 * checked on its own.
 */

export interface Subject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resource {
  id: string;
  subject: string;
  title: string;
  type: string;
  url: string;
  folder: string;
  /** Lowercase file extension for FILE rows, "" otherwise (set on the server). */
  ext: string;
  createdAt: Date;
}

export interface Homework {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  dueDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
  proofUrl: string | null;
}

export interface SubjectGoal {
  id: string;
  subject: string;
  targetGrade: number;
}

export interface SubjectGrade {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
}

export interface ReportCard {
  id: string;
  term: string;
  overallAverage: number | null;
  createdAt: Date;
  grades: SubjectGrade[];
}

export interface StudioNote {
  id: string;
  subject: string;
  content: string;
}

export interface ExamEvent {
  id: string;
  title: string;
  date: Date;
  subject: { name: string } | null;
}

export interface MasteryItem {
  id: string;
  subject: string;
  title: string;
  isCompleted: boolean;
}

export interface GradePoint {
  term: string;
  grade: number;
  rawGrade: string;
}

// Midpoints of the usual letter bands. The modifier is applied after the
// letter is read, so "A-" can never be mistaken for "A" (the old parser tested
// startsWith("A") before startsWith("A-") and read every A- as 93).
const LETTER_BASE: Record<string, number> = { A: 93, B: 83, C: 73, D: 63, E: 55, F: 50 };
const MODIFIER: Record<string, number> = { "+": 4, "-": -3, "": 0 };

/**
 * A report-card grade as a percentage, or null when it cannot be read. Accepts
 * "78", "78%", "78.5 %", "18/20", "18 / 20", "A", "A-", "b+".
 *
 * Returns null rather than 0 for anything else, so an unreadable grade is left
 * out of an average instead of dragging it to zero.
 */
export function parseGradeToPercentage(raw: string): number | null {
  const grade = raw.trim();
  if (!grade) return null;

  const fraction = grade.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const [score, out] = [Number(fraction[1]), Number(fraction[2])];
    return out > 0 ? Math.round((score / out) * 1000) / 10 : null;
  }

  const percent = grade.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (percent) return Number(percent[1]);

  const letter = grade.toUpperCase().match(/^([A-F])\s*([+-]?)$/);
  if (letter) return LETTER_BASE[letter[1]] + MODIFIER[letter[2]];

  return null;
}

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Exams from today on, soonest first. */
export function upcomingExams(exams: ExamEvent[]): ExamEvent[] {
  const today = startOfToday();
  return exams
    .filter((e) => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Calendar days from today to `date`; negative in the past. */
export function daysFromToday(date: Date): number {
  return differenceInCalendarDays(new Date(date), startOfToday());
}

/** "Today", "Tomorrow", "In 5 days". */
export function countdown(date: Date): string {
  const days = daysFromToday(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function shortDate(date: Date): string {
  return format(new Date(date), "EEE d MMM");
}

export function isOverdue(hw: Homework): boolean {
  return !hw.isCompleted && new Date(hw.dueDate) < startOfToday();
}

/** Open homework, most urgent first. */
export function pendingHomework(homeworks: Homework[]): Homework[] {
  return homeworks
    .filter((h) => !h.isCompleted)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

/** Percentage points, without float noise ("7.1", not "7.099999"). */
export function points(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Where a subject's resource opens: its folder in the explorer. */
export function resourceHref(r: Pick<Resource, "subject" | "folder">): string {
  const base = `/resources/${encodeURIComponent(r.subject)}`;
  return r.folder ? `${base}?path=${encodeURIComponent(r.folder)}` : base;
}
