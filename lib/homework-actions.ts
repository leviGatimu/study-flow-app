'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { saveUpload, deleteUpload } from '@/lib/upload';
import { grantXp } from './gamification';
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

  let proofUrl = '';

  if (file && file.size > 0) {
    try {
      proofUrl = await saveUpload(file, 'proof-hw');
    } catch (e: any) {
      return { error: e.message || 'Failed to upload file.' };
    }
  } else {
    return { error: 'Proof file is required to complete homework' };
  }

  await prisma.homework.updateMany({
    where: { id: homeworkId, userId },
    data: { 
      isCompleted: true,
      completedAt: new Date(),
      proofUrl
    }
  });

  // Keyed on the homework, so re-completing it cannot pay the bonus
  // again - this had the same double-grant bug as task completion.
  await grantXp(userId, 200, 'HOMEWORK', `homework:${homeworkId}`);

  revalidatePath('/homeworks');
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

  if (homework?.proofUrl) {
    await deleteUpload(homework.proofUrl);
  }

  await prisma.homework.deleteMany({
    where: { id: homeworkId, userId }
  });

  revalidatePath('/homeworks');
  return { success: true };
}
