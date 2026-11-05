'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { saveUpload, deleteUpload } from '@/lib/upload';
import { grantXp } from './gamification';
import { cleanWork, HOMEWORK_TITLE_MAX, parseDueDay, workError } from '@/lib/homework-work';
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
    ]
  });
}

export async function createHomework(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const subject = formData.get('subject') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const dueDateStr = formData.get('dueDate') as string;

  if (!subject || !title || !dueDateStr) {
    return { error: 'Missing required fields' };
  }

  await prisma.homework.create({
    data: {
      userId,
      subject,
      title,
      description,
      dueDate: new Date(dueDateStr),
      ...(await requireTermStamp(userId)),
    }
  });

  revalidatePath('/homeworks');
  return { success: true };
}

export async function planHomework(homeworkId: string, plannedDate: Date) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // A finished year is a record, not a workspace. This action reports failure
  // by returning it, so the refusal is returned rather than thrown.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  await prisma.homework.updateMany({
    where: { id: homeworkId, userId },
    data: { plannedDate: startOfDay(plannedDate) }
  });

  revalidatePath('/homeworks');
  return { success: true };
}

export async function completeHomework(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // Before the upload, so a refused completion does not leave an orphan file.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  const homeworkId = formData.get('homeworkId') as string;
  const file = formData.get('file') as File;
  const existing = await prisma.homework.findFirst({ where: { id: homeworkId, userId }, select: { proofUrl: true } });
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

  revalidatePath('/homeworks');
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
