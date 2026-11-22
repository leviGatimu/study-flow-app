import { getMentorSession } from '@/lib/auth';

/**
 * What a mentor is not shown: the student's own notes and attached work on a
 * study block, and their homework answers and proof. Applied where pages load
 * those rows, so the private fields never reach a mentor's browser at all -
 * hiding them in the UI would still ship them in the page payload.
 */

type WithTaskPrivate = { workDescription?: string | null; proofPdfUrl?: string | null };
type WithHomeworkPrivate = { answer?: string | null; answerFileUrl?: string | null; proofUrl?: string | null };

export async function redactTasksForMentor<T extends WithTaskPrivate>(rows: T[]): Promise<T[]> {
  if (!(await getMentorSession())) return rows;
  return rows.map((row) => ({ ...row, workDescription: null, proofPdfUrl: null }));
}

export async function redactHomeworkForMentor<T extends WithHomeworkPrivate>(rows: T[]): Promise<T[]> {
  if (!(await getMentorSession())) return rows;
  return rows.map((row) => ({ ...row, answer: null, answerFileUrl: null, proofUrl: null }));
}
