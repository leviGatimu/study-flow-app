'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateProfile } from '@/lib/profile-input';
import { normalizeProfilePhoto } from '@/lib/profile-photo';
import { saveUpload, deleteUpload, usesRemoteStorage } from '@/lib/upload';

export async function updateProfile(form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Sign in to update your profile.' };
  const parsed = validateProfile({ name: form.get('name'), bio: form.get('bio'), school: form.get('school'), timezone: form.get('timezone') });
  if ('error' in parsed) return { error: parsed.error };
  const photo = form.get('photo');
  let avatarUrl: string | null | undefined = form.get('removePhoto') === 'true' ? null : undefined;
  let uploaded: string | null = null;
  try {
    if (photo instanceof File && photo.size > 0) {
      if (process.env.VERCEL && !usesRemoteStorage()) return { error: 'Photo storage is not configured on this server. Your profile has not changed.' };
      const bytes = await normalizeProfilePhoto(photo);
      uploaded = await saveUpload(new File([new Uint8Array(bytes)], 'photo.webp', { type: 'image/webp' }), `avatar-${randomUUID()}`, 1024 * 1024);
      avatarUrl = uploaded;
    }
    await prisma.userProgress.upsert({
      where: { userId },
      create: { userId, ...parsed.data, avatarUrl },
      update: { ...parsed.data, avatarUrl },
    });
  } catch (error) {
    if (uploaded) await deleteUpload(uploaded);
    if (error instanceof Error && error.message.startsWith('Choose a')) return { error: error.message };
    return { error: 'Your profile could not be saved. Please try again.' };
  }
  revalidatePath('/', 'layout');
  revalidatePath('/profile');
  revalidatePath('/settings');
  return { success: true };
}
