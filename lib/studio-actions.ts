'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getViewScope, byClass, requireClassStamp } from '@/lib/scope';

export async function getStudioNote(subject: string) {
  const userId = await getUserId();
  if (!userId) return null;

  // findFirst, not findUnique: the (userId, subject) key cannot express the
  // year, so the class filter has to go in an ordinary where clause.
  return prisma.studioNote.findFirst({
    where: { userId, subject, ...byClass(await getViewScope(userId)) }
  });
}

export async function saveStudioNote(subject: string, content: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // One row per (userId, subject) by schema, so - exactly as with SubjectGoal
  // - the note follows you into the year you are writing in rather than
  // silently updating a row the current year cannot see.
  const stamp = await requireClassStamp(userId);

  await prisma.studioNote.upsert({
    where: {
      userId_subject: {
        userId,
        subject
      }
    },
    update: { content, ...stamp },
    create: {
      userId,
      subject,
      content,
      ...stamp
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
      ...byClass(await getViewScope(userId)),
      subject: {
        contains: subject
      },
      type: 'FILE'
    }
  });
}
