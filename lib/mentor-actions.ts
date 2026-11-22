'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

import { getMentorSession, getUserId } from '@/lib/auth';
import { IS_SQLITE, prisma } from '@/lib/prisma';

/**
 * A student's mentor sign-ins: make one, list them, turn one off.
 *
 * A mentor signs in on the website with the username and password made here
 * and sees the student's Study Flow read-only (lib/auth.ts login with a
 * mentorId, lib/mentor-guard.ts, proxy.ts). These live on the website only:
 * a desktop has its own database that no mentor can reach.
 */

export type MentorAccessRow = {
  id: string;
  username: string;
  createdAt: string;
  lastSeenAt: string | null;
};

const MAX_MENTORS = 5;

/** The signed-in student, never a mentor: a mentor must not hand out or revoke access. */
async function studentId(): Promise<string | null> {
  if (await getMentorSession()) return null;
  return getUserId();
}

export async function listMentorAccess(): Promise<{ available: boolean; mentors: MentorAccessRow[] }> {
  const userId = await studentId();
  if (!userId || IS_SQLITE) return { available: false, mentors: [] };
  const rows = await prisma.mentorAccess.findMany({
    where: { studentId: userId, revokedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, createdAt: true, lastSeenAt: true },
  });
  return {
    available: true,
    mentors: rows.map((r) => ({
      id: r.id,
      username: r.username,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    })),
  };
}

export async function createMentorAccess(input: {
  username: string;
  password: string;
}): Promise<{ success: true } | { error: string }> {
  const userId = await studentId();
  if (!userId) return { error: 'Sign in to your own account to add a mentor.' };
  if (IS_SQLITE) return { error: 'Add a mentor on the Study Flow website. Mentors sign in there.' };

  const username = String(input?.username ?? '').trim();
  const password = String(input?.password ?? '');
  // The same rules as a student's own sign-up (lib/registration.ts).
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return { error: 'Use 3–32 letters, numbers, dots, dashes or underscores for the username.' };
  }
  if (password.length < 8) return { error: 'Use a password with at least 8 characters.' };
  if (new TextEncoder().encode(password).length > 72) return { error: 'Please use a shorter password.' };

  const active = await prisma.mentorAccess.count({ where: { studentId: userId, revokedAt: null } });
  if (active >= MAX_MENTORS) return { error: `You can have up to ${MAX_MENTORS} mentors. Turn one off first.` };

  // One login box for students and mentors, so one set of names.
  const [student, mentor] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.mentorAccess.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (student || mentor) return { error: 'That username is taken. Try another.' };

  try {
    await prisma.mentorAccess.create({
      data: { studentId: userId, username, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch {
    // Two tabs racing for the same name: the unique index decides.
    return { error: 'That username is taken. Try another.' };
  }
  revalidatePath('/settings');
  return { success: true };
}

/**
 * Turn a mentor's access off. They are signed out on their next click
 * (getUserId re-checks the row). The row is kept, revoked, so the name is
 * never quietly reused for someone else.
 */
export async function revokeMentorAccess(id: string): Promise<{ success: true } | { error: string }> {
  const userId = await studentId();
  if (!userId) return { error: 'Sign in to your own account to change mentor access.' };
  const result = await prisma.mentorAccess.updateMany({
    where: { id: String(id), studentId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return { error: 'That mentor access is already off.' };
  revalidatePath('/settings');
  return { success: true };
}
