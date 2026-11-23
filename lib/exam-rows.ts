import { format } from 'date-fns';

import { examDaysAway, examStatus, examTimeLabel, type TimedExam } from './exam-time';
import { normaliseCategory } from './exam-category';

/** What the Exams pages need to draw one exam row. Kept in step with ExamRowData. */
export type ExamRowFields = {
  id: string;
  title: string;
  subject: string | null;
  category: string | null;
  at: number;
  when: string;
  days: number;
  inProgress: boolean;
  isDone: boolean;
  percent: number | null;
  priority: string;
};

type RowExam = TimedExam & {
  id: string;
  title: string;
  category: string | null;
  priority: string;
  score: number | null;
  maxScore: number | null;
  subject: { name: string } | null;
};

export function toExamRow(exam: RowExam, timezone: string, now: Date): ExamRowFields {
  const status = examStatus(exam, timezone, now);
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject?.name ?? null,
    category: normaliseCategory(exam.category),
    at: new Date(exam.date).getTime(),
    when: [format(new Date(exam.date), 'EEE d MMM yyyy'), examTimeLabel(exam)].filter(Boolean).join(' · '),
    days: examDaysAway(exam, timezone, now),
    inProgress: status === 'IN_PROGRESS',
    isDone: status === 'DONE',
    percent: exam.score !== null && exam.maxScore ? Math.round((exam.score / exam.maxScore) * 1000) / 10 : null,
    priority: exam.priority,
  };
}
