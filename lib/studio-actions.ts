'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getStudioNote(subject: string) {
  const userId = await getUserId();
  if (!userId) return null;

  return prisma.studioNote.findUnique({
    where: {
      userId_subject: {
        userId,
        subject
      }
    }
  });
}

export async function saveStudioNote(subject: string, content: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  await prisma.studioNote.upsert({
    where: {
      userId_subject: {
        userId,
        subject
      }
    },
    update: { content },
    create: {
      userId,
      subject,
      content
    }
  });

  // revalidatePath(`/studio/${encodeURIComponent(subject)}`);
  return { success: true };
}

export async function getStudioResources(subject: string) {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.resource.findMany({
    where: {
      userId,
      subject: {
        contains: subject
      },
      type: 'FILE'
    }
  });
}
