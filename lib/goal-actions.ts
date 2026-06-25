'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getGoals() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.subjectGoal.findMany({
    where: { userId },
    orderBy: { subject: 'asc' },
  });
}

export async function saveGoal(subject: string, targetGrade: number) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const trimmedSubject = subject.trim();
  if (!trimmedSubject) throw new Error('Subject is required');
  if (targetGrade < 0 || targetGrade > 100) throw new Error('Target grade must be between 0 and 100');

  const goal = await prisma.subjectGoal.upsert({
    where: {
      userId_subject: {
        userId,
        subject: trimmedSubject,
      },
    },
    update: {
      targetGrade,
    },
    create: {
      userId,
      subject: trimmedSubject,
      targetGrade,
    },
  });

  revalidatePath('/goals');
  revalidatePath('/marks');
  return { success: true, goal };
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  await prisma.subjectGoal.deleteMany({
    where: {
      id,
      userId,
    },
  });

  revalidatePath('/goals');
  revalidatePath('/marks');
  return { success: true };
}
