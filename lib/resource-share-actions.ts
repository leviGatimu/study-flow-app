'use server';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * The name a Resources share says it is from ("From Levi"). Null when the
 * student has not set one. The files themselves are packed and unpacked in
 * the browser (components/resources/ResourceShare.tsx) and uploaded through
 * the ordinary upload path, so no file bytes pass through here.
 */
export async function getShareSenderName(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const progress = await prisma.userProgress.findUnique({ where: { userId }, select: { name: true } });
  const name = progress?.name?.trim();
  return name && name !== 'Student' ? name : null;
}
