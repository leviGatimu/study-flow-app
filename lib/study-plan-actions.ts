'use server';

/**
 * "Plan my week for me": ask the AI for a recurring study week built around
 * the person's own subjects and school lessons, inside the hours they choose.
 *
 * Like the timetable-photo importer, this only PROPOSES. Nothing is written;
 * the wizard shows the blocks, the person removes what they do not want, and
 * only then are they saved through createTemplate like hand-made ones.
 */

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { askAIBuddy } from '@/lib/ai-actions';
import { parseJsonLoose } from '@/lib/ai-parse';
import { getViewScope, byClass, isViewingArchive, ARCHIVE_WRITE_ERROR } from '@/lib/scope';
import { DAY_NAMES } from '@/lib/school';
import { toMin, validatePlan, type PlanBlock } from '@/lib/study-plan';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function generateStudyWeek(input: { days: number[]; start: string; end: string }): Promise<{ blocks?: PlanBlock[]; dropped?: number; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Not signed in' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const days = [...new Set(input.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) return { error: 'Pick at least one day.' };
  if (!TIME.test(input.start) || !TIME.test(input.end)) return { error: 'Times must look like 19:00.' };
  if (toMin(input.end) - toMin(input.start) < 30) return { error: 'Give yourself at least 30 minutes between start and finish.' };

  const scope = byClass(await getViewScope(userId));
  const [subjects, lessons, templates] = await Promise.all([
    prisma.subject.findMany({ where: { userId, ...scope }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.schoolLesson.findMany({ where: { userId, ...scope }, select: { dayOfWeek: true, startTime: true, endTime: true, subject: true, isBreak: true } }),
    prisma.scheduleTemplate.findMany({ where: { userId, ...scope }, select: { dayOfWeek: true, startTime: true, endTime: true, subject: true } }),
  ]);
  const subjectNames = subjects.map((s) => s.name);
  if (subjectNames.length === 0) return { error: 'Add your subjects first.' };

  const busy = [...lessons, ...templates].map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
  const lessonLines = lessons.filter((l) => !l.isBreak && days.includes(l.dayOfWeek))
    .map((l) => `${DAY_NAMES[l.dayOfWeek]} ${l.startTime}-${l.endTime} ${l.subject}`);
  const takenLines = templates.filter((t) => days.includes(t.dayOfWeek))
    .map((t) => `${DAY_NAMES[t.dayOfWeek]} ${t.startTime}-${t.endTime} ${t.subject}`);

  const prompt = [
    'Plan a recurring weekly study routine for a student.',
    `Subjects (use these exact names, no others): ${subjectNames.join(', ')}.`,
    `Study days: ${days.map((d) => DAY_NAMES[d]).join(', ')}.`,
    `Every block must start at or after ${input.start} and end at or before ${input.end}.`,
    lessonLines.length ? `School lessons this week (a subject taught that day is good to review the same evening):\n${lessonLines.join('\n')}` : 'No school lessons are recorded.',
    takenLines.length ? `Times already taken by existing study blocks (do not overlap):\n${takenLines.join('\n')}` : '',
    'Rules: blocks of 30 to 120 minutes; leave 10 to 15 minutes between blocks; never overlap; spread every subject across the week, giving each at least one block when time allows; use HOMEWORK for doing set work and REVISION for going over material, with more REVISION on weekends.',
    'Reply with JSON only, no prose: {"blocks":[{"day":"Monday","subject":"Physics","start":"19:00","end":"20:00","type":"HOMEWORK"}]}',
  ].filter(Boolean).join('\n\n');

  const result = await askAIBuddy(prompt, [], undefined, undefined, 'You plan study timetables. You reply with valid JSON only.', { tools: false, xp: false });
  if (result.error) return { error: result.error };

  const parsed = parseJsonLoose(result.text || '');
  const { blocks, dropped } = validatePlan(parsed?.blocks ?? parsed, { subjects: subjectNames, days, start: input.start, end: input.end, busy });
  if (blocks.length === 0) return { error: 'The plan that came back did not fit your hours and subjects. Try again, or widen your study hours.' };
  return { blocks, dropped };
}
