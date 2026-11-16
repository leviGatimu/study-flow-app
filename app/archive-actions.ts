'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VIEW_COOKIE } from '@/lib/scope';

/**
 * Opening and closing a finished academic year.
 *
 * Which year the app reads from is a single cookie (see lib/scope.ts): absent
 * means the active year, present means "browse that class instead". Both
 * actions are plain <form action> submits rather than transitions, because
 * both end in a navigation - the whole app has to re-render against the other
 * year, and a form post plus redirect does that without any client state to
 * keep in sync.
 */

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days, same as the session
} as const;

/** Pages a year can be opened onto; anything else lands on the Year home. */
const OPEN_TARGETS = new Set(['/calendar', '/marks', '/exams', '/homeworks', '/history', '/resources', '/summaries']);

/**
 * Browse a finished year read-only. Lands on that year's home page (its
 * highlights and recap), or on `to` when it names one of OPEN_TARGETS, which
 * is how the Year home's "Look back" links open the year onto a page.
 */
export async function openArchivedYear(formData: FormData) {
  const classId = String(formData.get('classId') ?? '');
  const to = String(formData.get('to') ?? '');
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  // Only ever the user's own class, and only one that still exists.
  const cls = await prisma.class.findFirst({
    where: { id: classId, userId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!cls) redirect('/year');

  const store = await cookies();
  if (cls.status === 'ACTIVE') {
    // The active year is "no cookie". Pinning it by id would silently turn
    // into an archive the moment the user starts their next year.
    store.delete(VIEW_COOKIE);
  } else {
    store.set(VIEW_COOKIE, cls.id, COOKIE_OPTIONS);
  }

  if (OPEN_TARGETS.has(to)) redirect(to);
  redirect(cls.status === 'ACTIVE' ? '/' : `/year/${cls.id}`);
}

/** Leave the archive and go back to the active year. */
export async function exitArchive() {
  const store = await cookies();
  store.delete(VIEW_COOKIE);
  redirect('/');
}
