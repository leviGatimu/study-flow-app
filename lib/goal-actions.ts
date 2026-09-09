'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getViewScope, byClass, requireClassStamp, assertWritableScope } from '@/lib/scope';

export async function getGoals() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.subjectGoal.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    orderBy: { subject: 'asc' },
  });
}

export async function saveGoal(subject: string, targetGrade: number) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const trimmedSubject = subject.trim();
  if (!trimmedSubject) throw new Error('Subject is required');
  if (targetGrade < 0 || targetGrade > 100) throw new Error('Target grade must be between 0 and 100');

  // SubjectGoal is unique on (userId, subject), a constraint that predates
  // academic years - so the schema allows exactly ONE goal per subject per
  // user, not one per year. Setting a target for Physics in Year 2 therefore
  // has to adopt Year 1's row rather than create a second one, which is why
  // the class is stamped on the UPDATE branch as well as the create. The goal
  // follows you into the year you are actually working in; the alternative is
  // an upsert that silently updates a row you can no longer see.
  const stamp = await requireClassStamp(userId);

  const goal = await prisma.subjectGoal.upsert({
    where: {
      userId_subject: {
        userId,
        subject: trimmedSubject,
      },
    },
    update: {
      targetGrade,
      ...stamp,
    },
    create: {
      userId,
      subject: trimmedSubject,
      targetGrade,
      ...stamp,
    },
  });

  revalidatePath('/goals');
  revalidatePath('/marks');
  return { success: true, goal };
}

export async function deleteGoal(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  // A finished year is a record, not a workspace. The UI hides these
  // controls inside an archive; this is the guarantee behind that, because
  // hidden is not the same as prevented.
  await assertWritableScope(userId);

  await softDelete(prisma, 'subjectGoal', { id, userId });

  revalidatePath('/goals');
  revalidatePath('/marks');
  return { success: true };
}
