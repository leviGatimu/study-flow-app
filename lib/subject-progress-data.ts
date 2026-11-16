import { getCurrentUserTimezone, getEvents } from '@/lib/actions';
import { getSubjects } from '@/lib/subject-actions';
import { getReportCards } from '@/lib/marks-actions';
import { getGoals } from '@/lib/goal-actions';
import { examDaysAway, examStatus } from '@/lib/exam-time';
import { buildSubjectProgress, type SubjectProgress } from '@/lib/subject-progress';

/**
 * Every subject's standing for the year and term being viewed: exam results,
 * the newest report card and the target. Server-side only (server components
 * call it); the rules live in lib/subject-progress.ts.
 */
export async function loadSubjectProgress(): Promise<SubjectProgress[]> {
  const [exams, reportCards, goals, subjects, timezone] = await Promise.all([
    getEvents(),
    getReportCards(),
    getGoals(),
    getSubjects(),
    getCurrentUserTimezone(),
  ]);
  const now = new Date();

  return buildSubjectProgress({
    subjects: subjects.map((s) => s.name),
    goals: goals.map((g) => ({ subject: g.subject, targetGrade: g.targetGrade })),
    reportCards,
    exams: exams.map((e) => ({
      ...e,
      done: examStatus(e, timezone, now) === 'DONE',
      daysAway: examDaysAway(e, timezone, now),
    })),
    now,
  });
}
