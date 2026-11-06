'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { saveUpload, deleteUpload } from '@/lib/upload';
import { grantXp } from './gamification';
import { cleanWork, HOMEWORK_TITLE_MAX, parseDueDay, workError } from '@/lib/homework-work';
import { decideSlot, firstFreeSlot, type ClashResolution, type TimeSlot } from '@/lib/schedule-clash';
import { clearBlocks, openBlocksAround, taskDateFromKey, todayKey } from '@/lib/schedule-placement';
import { isDateKey, validateQuickTask } from '@/lib/task-input';
import { DEFAULT_TIMEZONE, getZonedNow } from '@/lib/utils';
import {
  getViewScope,
  byTerm,
  requireTermStamp,
  isViewingArchive,
  ARCHIVE_WRITE_ERROR,
} from '@/lib/scope';

export async function getHomeworks() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.homework.findMany({
    where: { userId, ...byTerm(await getViewScope(userId)) },
    orderBy: [
      { isCompleted: 'asc' },
      { dueDate: 'asc' }
    ],
    include: { task: { select: { startTime: true, endTime: true, isDeleted: true } } },
  });
}

async function timeZoneOf(userId: string) {
  const row = await prisma.userProgress.findUnique({ where: { userId }, select: { timezone: true } });
  return row?.timezone ?? DEFAULT_TIMEZONE;
}

const EVENING_START = 18 * 60;

/** The next free time on a day, for the form to fill in. */
export async function suggestHomeworkSlot(dateKey: string, minutes: number): Promise<TimeSlot | null> {
  const userId = await getUserId();
  if (!userId || !isDateKey(dateKey) || !Number.isFinite(minutes)) return null;
  if (await isViewingArchive(userId)) return null;

  const timeZone = await timeZoneOf(userId);
  let from = EVENING_START;
  if (dateKey === todayKey(timeZone)) {
    const now = getZonedNow(timeZone);
    from = Math.max(from, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  }
  const length = Math.min(Math.max(Math.round(minutes), 15), 8 * 60);
  return firstFreeSlot(length, from, await openBlocksAround(userId, dateKey, timeZone));
}

function parseResolution(value: unknown): ClashResolution | undefined {
  return value === 'next-free' || value === 'replace' ? value : undefined;
}

function refreshSchedule() {
  revalidatePath('/');
  revalidatePath('/timetable');
  revalidatePath('/calendar');
  revalidatePath('/homeworks');
}

export async function createHomework(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const subject = formData.get('subject') as string;
  const title = (formData.get('title') as string | null)?.trim();
  const description = formData.get('description') as string;
  const dueDateStr = formData.get('dueDate') as string;

  if (!subject || !title || !isDateKey(dueDateStr)) {
    return { error: 'Add a subject, a title and a due date.' };
  }

  const checked = validateQuickTask({
    subject,
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    type: 'HOMEWORK',
    date: formData.get('doDay'),
  });
  if (!checked.ok) return { error: checked.error };
  const { dateKey, startTime, endTime } = checked.value;
  if (!dateKey) return { error: 'Pick the day you will do it.' };

  const timeZone = await timeZoneOf(userId);
  const decision = decideSlot(
    { startTime, endTime },
    await openBlocksAround(userId, dateKey, timeZone),
    parseResolution(formData.get('onClash'))
  );
  if (!('slot' in decision)) return decision;

  const stamp = await requireTermStamp(userId);
  await clearBlocks(userId, decision.clear.map((block) => block.id));

  const date = taskDateFromKey(dateKey);
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: { userId, subject, ...decision.slot, type: 'HOMEWORK', date, isDone: false, isMissed: false, isDeleted: false, ...stamp },
      select: { id: true },
    });
    await tx.homework.create({
      data: { userId, subject, title, description, dueDate: new Date(dueDateStr), plannedDate: date, taskId: task.id, ...stamp },
    });
  });

  refreshSchedule();
  return { success: true, slot: decision.slot };
}

/** Put homework on the schedule, or move the block it already has. */
export async function planHomework(
  homeworkId: string,
  input: { dateKey: string; startTime: string; endTime: string },
  onClash?: ClashResolution
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // A finished year is a record, not a workspace. This action reports failure
  // by returning it, so the refusal is returned rather than thrown.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const homework = await prisma.homework.findFirst({ where: { id: homeworkId, userId } });
  if (!homework) return { error: 'That homework no longer exists.' };

  const checked = validateQuickTask({ subject: homework.subject, startTime: input.startTime, endTime: input.endTime, type: 'HOMEWORK', date: input.dateKey });
  if (!checked.ok) return { error: checked.error };
  const dateKey = checked.value.dateKey;
  if (!dateKey) return { error: 'Pick the day you will do it.' };

  const current = homework.taskId
    ? await prisma.task.findFirst({ where: { id: homework.taskId, userId, isDeleted: false, isDone: false } })
    : null;

  const timeZone = await timeZoneOf(userId);
  const decision = decideSlot(
    { startTime: checked.value.startTime, endTime: checked.value.endTime },
    await openBlocksAround(userId, dateKey, timeZone, current?.id),
    onClash
  );
  if (!('slot' in decision)) return decision;

  const stamp = current ? {} : await requireTermStamp(userId);
  await clearBlocks(userId, decision.clear.map((block) => block.id));

  const date = taskDateFromKey(dateKey);
  const taskId = current
    ? (await prisma.task.update({ where: { id: current.id }, data: { ...decision.slot, date, isMissed: false }, select: { id: true } })).id
    : (await prisma.task.create({
        data: { userId, subject: homework.subject, ...decision.slot, type: 'HOMEWORK', date, isDone: false, isMissed: false, isDeleted: false, ...stamp },
        select: { id: true },
      })).id;

  await prisma.homework.updateMany({ where: { id: homeworkId, userId }, data: { plannedDate: date, taskId } });

  refreshSchedule();
  return { success: true, slot: decision.slot };
}

export async function completeHomework(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // Before the upload, so a refused completion does not leave an orphan file.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const homeworkId = formData.get('homeworkId') as string;
  const file = formData.get('file') as File;
  const existing = await prisma.homework.findFirst({ where: { id: homeworkId, userId }, select: { proofUrl: true, taskId: true } });
  if (!existing) return { error: 'That homework no longer exists.' };

  let proofUrl = '';

  if (file && file.size > 0) {
    try {
      proofUrl = await saveUpload(file, 'proof-hw');
    } catch (e: any) {
      return { error: e.message || 'Failed to upload file.' };
    }
  } else if (formData.get('keepProof') === '1' && existing.proofUrl) {
    // Finishing again after "Mark as not done", with the proof already there.
    proofUrl = existing.proofUrl;
  } else {
    return { error: 'Add a photo or PDF of your work to finish this homework.' };
  }

  await prisma.homework.updateMany({
    where: { id: homeworkId, userId },
    data: {
      isCompleted: true,
      completedAt: new Date(),
      proofUrl
    }
  });
  if (existing.proofUrl && existing.proofUrl !== proofUrl) await deleteUpload(existing.proofUrl);

  // Finishing the homework finishes its block. The block earns nothing extra:
  // the bonus below is the reward for this work.
  if (existing.taskId) {
    await prisma.task.updateMany({ where: { id: existing.taskId, userId }, data: { isDone: true, isMissed: false } });
    revalidatePath('/timetable');
    revalidatePath('/calendar');
  }

  // Keyed on the homework, so re-completing it cannot pay the bonus
  // again - this had the same double-grant bug as task completion.
  await grantXp(userId, 200, 'HOMEWORK', `homework:${homeworkId}`);

  refreshHomework(homeworkId);
  revalidatePath('/history');
  return { success: true };
}

export async function deleteHomework(homeworkId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const homework = await prisma.homework.findFirst({
    where: { id: homeworkId, userId }
  });

  for (const url of [homework?.proofUrl, homework?.briefFileUrl, homework?.answerFileUrl]) {
    if (url) await deleteUpload(url);
  }

  await softDelete(prisma, 'homework', { id: homeworkId, userId });

  // Its block goes too, unless that block is a record of work already done.
  if (homework?.taskId) {
    await prisma.task.updateMany({ where: { id: homework.taskId, userId, isDone: false }, data: { isDeleted: true } });
  }

  refreshSchedule();
  return { success: true };
}

function refreshHomework(id?: string) {
  revalidatePath('/homeworks');
  if (id) revalidatePath(`/homeworks/${id}`);
  revalidatePath('/');
  revalidatePath('/subjects');
}

/** One homework of the signed-in user, in the year on screen. */
export async function getHomework(id: string) {
  const userId = await getUserId();
  if (!userId || !id) return null;
  return prisma.homework.findFirst({ where: { id, userId, ...byTerm(await getViewScope(userId)) } });
}

/**
 * Save what was set and the answers: text for each, and optionally a photo or
 * PDF for each. A new file replaces the old one; "remove" drops it. Files are
 * uploaded before the row changes and old ones deleted after, so a failure
 * part-way never leaves the homework pointing at a missing file.
 */
export async function saveHomeworkWork(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const id = String(formData.get('homeworkId') ?? '');
  const homework = await prisma.homework.findFirst({ where: { id, userId } });
  if (!homework) return { error: 'That homework no longer exists.' };

  const description = cleanWork(formData.get('description'));
  const answer = cleanWork(formData.get('answer'));
  const tooLong = workError('What was set', description) ?? workError('Your answers', answer);
  if (tooLong) return { error: tooLong };

  const upload = async (name: string, prefix: string) => {
    const file = formData.get(name);
    return file instanceof File && file.size > 0 ? saveUpload(file, prefix) : null;
  };
  let briefUpload: string | null;
  let answerUpload: string | null = null;
  try {
    briefUpload = await upload('briefFile', 'hw-brief');
    answerUpload = await upload('answerFile', 'hw-answer');
  } catch (e) {
    return { error: (e as Error).message || 'The file could not be uploaded.' };
  }

  const briefFileUrl = briefUpload ?? (formData.get('removeBriefFile') === '1' ? null : homework.briefFileUrl);
  const answerFileUrl = answerUpload ?? (formData.get('removeAnswerFile') === '1' ? null : homework.answerFileUrl);

  await prisma.homework.update({ where: { id }, data: { description, answer, briefFileUrl, answerFileUrl } });

  for (const [before, after] of [
    [homework.briefFileUrl, briefFileUrl],
    [homework.answerFileUrl, answerFileUrl],
  ]) {
    if (before && before !== after) await deleteUpload(before);
  }

  refreshHomework(id);
  return { success: true, briefFileUrl, answerFileUrl };
}

/** Change the title, subject or due date. */
export async function updateHomeworkDetails(id: string, data: { title: string; subject: string; dueDay: string }) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const title = data.title.trim();
  const subject = data.subject.trim();
  const dueDate = parseDueDay(data.dueDay);
  if (!title) return { error: 'Give the homework a title.' };
  if (title.length > HOMEWORK_TITLE_MAX) return { error: `Keep the title under ${HOMEWORK_TITLE_MAX} characters.` };
  if (!subject) return { error: 'Choose a subject.' };
  if (!dueDate) return { error: 'Enter a valid due date.' };

  const result = await prisma.homework.updateMany({ where: { id, userId }, data: { title, subject, dueDate } });
  if (result.count === 0) return { error: 'That homework no longer exists.' };
  refreshHomework(id);
  return { success: true };
}

/**
 * Undo "finished". The proof is kept, so finishing again can reuse it, and the
 * XP is not taken back or paid twice (grantXp is keyed on the homework).
 */
export async function reopenHomework(id: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const result = await prisma.homework.updateMany({
    where: { id, userId },
    data: { isCompleted: false, completedAt: null },
  });
  if (result.count === 0) return { error: 'That homework no longer exists.' };
  refreshHomework(id);
  return { success: true };
}
