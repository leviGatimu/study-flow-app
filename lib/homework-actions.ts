'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { saveUpload, deleteUpload } from '@/lib/upload';
import { addXp } from './gamification';

export async function getHomeworks() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.homework.findMany({
    where: { userId },
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
    }
  });

  revalidatePath('/homeworks');
  return { success: true };
}

export async function planHomework(homeworkId: string, plannedDate: Date) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

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

  await addXp(userId, 200); // Homework completion bonus

  revalidatePath('/homeworks');
  revalidatePath('/history');
  return { success: true };
}

export async function deleteHomework(homeworkId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

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
