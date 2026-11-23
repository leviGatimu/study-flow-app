import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserTimezone, getTodayTasks } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskWithTemplate } from '@/lib/types';
import { DEFAULT_TIMEZONE } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { FocusLauncher, type PlanTask } from '@/components/focus/FocusLauncher';

export const dynamic = 'force-dynamic';

/**
 * Focus: choose what to work on, then hand over to the full-screen session
 * at /focus/<taskId> (or /focus/free).
 *
 * ?subject=<name> comes from an exam or a subject page ("revise this"). The
 * exam pages pass the exam's title, which usually contains the subject rather
 * than equalling it, so a task matches when either name contains the other.
 * Matching tasks are listed first and marked; with none today, the free
 * session carries the subject instead.
 */
function matchesSubject(taskSubject: string, wanted: string): boolean {
  const a = taskSubject.trim().toLowerCase();
  const b = wanted.trim().toLowerCase();
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
}

function freeHref(subject: string) {
  return subject ? `/focus/free?subject=${encodeURIComponent(subject)}` : '/focus/free';
}

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const params = await searchParams;
  const subject = typeof params.subject === 'string' ? params.subject.trim() : '';

  let tasks: TaskWithTemplate[];
  try {
    tasks = (await getTodayTasks()) as TaskWithTemplate[];
  } catch (error) {
    console.error('Focus page failed to load today', error);
    return (
      <Page>
        <PageHeader title="Focus" description="Pick what to work on, then start a timed session." />
        <PageBody>
          <ErrorState
            title="Today's tasks could not be loaded"
            description="You can still start a free session, or try again in a moment."
            action={
              <>
                <Button asChild>
                  <Link href={freeHref(subject)}>Start a free session</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/focus">Try again</Link>
                </Button>
              </>
            }
          />
        </PageBody>
      </Page>
    );
  }

  const isMatch = (t: TaskWithTemplate) => Boolean(subject) && matchesSubject(t.subject, subject);
  // Still to do before done; within each, the subject asked for first, then by
  // start time.
  const ordered = [...tasks].sort(
    (a, b) =>
      Number(a.isDone) - Number(b.isDone) ||
      Number(isMatch(b)) - Number(isMatch(a)) ||
      a.startTime.localeCompare(b.startTime)
  );
  const matchCount = tasks.filter((t) => !t.isDone && isMatch(t)).length;

  // Extras for the page; it still works if any of them fail.
  const [focusByTask, progress, timezone] = await Promise.all([
    tasks.length
      ? prisma.xpEvent
          .groupBy({
            by: ['taskId'],
            where: { userId, source: 'FOCUS', deletedAt: null, taskId: { in: tasks.map((t) => t.id) } },
            _sum: { focusSeconds: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.userProgress
      .findUnique({ where: { userId }, select: { currentStreak: true, totalFocusMinutes: true, focusSessions: true } })
      .catch(() => null),
    getCurrentUserTimezone().catch(() => DEFAULT_TIMEZONE),
  ]);
  const focused = new Map(focusByTask.map((row) => [row.taskId, row._sum.focusSeconds ?? 0]));

  const plan: PlanTask[] = ordered.map((t) => ({
    id: t.id,
    subject: t.subject,
    revision: t.type === 'REVISION',
    startTime: t.startTime,
    endTime: t.endTime,
    isDone: t.isDone,
    isMissed: Boolean(t.isMissed),
    focusedSeconds: focused.get(t.id) ?? 0,
    match: isMatch(t),
  }));

  return (
    <Page>
      <PageHeader
        title="Focus"
        description="Pick what to work on, then start a timed session."
        meta={
          subject
            ? matchCount > 0
              ? `Showing ${subject} first.`
              : `Nothing left on today's plan for ${subject}. A free session will be labelled with it.`
            : undefined
        }
      />
      <PageBody>
        <FocusLauncher
          tasks={plan}
          subject={subject}
          freeHref={freeHref(subject)}
          timezone={timezone}
          stats={
            progress
              ? { streak: progress.currentStreak, totalMinutes: progress.totalFocusMinutes, sessions: progress.focusSessions }
              : null
          }
        />
      </PageBody>
    </Page>
  );
}
