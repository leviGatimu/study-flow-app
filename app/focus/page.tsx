import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarPlus, ListTodo, Play, Timer } from 'lucide-react';

import { getTodayTasks } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { TaskWithTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

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
  const next = ordered.find((t) => !t.isDone);
  const matchCount = tasks.filter((t) => !t.isDone && isMatch(t)).length;
  const done = tasks.filter((t) => t.isDone).length;

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
            : tasks.length > 0
              ? `${done} of ${tasks.length} done today`
              : undefined
        }
        actions={
          next ? (
            <Button asChild size="lg">
              <Link href={`/focus/${next.id}`}>
                <Play />
                Start {next.subject}
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href={freeHref(subject)}>
                <Play />
                Start a free session
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Panel>
              <PanelTitle icon={<ListTodo />}>Today&apos;s tasks</PanelTitle>
              {ordered.length === 0 ? (
                <EmptyState
                  title="Nothing scheduled today"
                  description="Start a free session, or add study blocks to your routine so they show up here."
                  action={
                    <>
                      <Button asChild>
                        <Link href={freeHref(subject)}>Start a free session</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/manage">
                          <CalendarPlus />
                          Study routine
                        </Link>
                      </Button>
                    </>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {ordered.map((task) => {
                    const revision = task.type === 'REVISION';
                    return (
                      <li key={task.id}>
                        <ListRow
                          className={cn(
                            // The app's focus-mode convention: homework solid
                            // blue, revision dashed orange.
                            revision ? 'border-dashed border-orange-500/50' : 'border-primary/40',
                            isMatch(task) && !task.isDone && 'bg-primary/5',
                            task.isDone && 'opacity-70'
                          )}
                          title={task.subject}
                          subtitle={`${revision ? 'Revision' : 'Homework'} · ${task.startTime}–${task.endTime}`}
                          trailing={
                            task.isDone ? (
                              <Pill tone="success">Done</Pill>
                            ) : (
                              <>
                                {isMatch(task) && (
                                  <Pill tone="primary" className="hidden sm:inline-flex">
                                    {subject}
                                  </Pill>
                                )}
                                <Button asChild size="sm" variant={task.id === next?.id ? 'default' : 'outline'}>
                                  <Link href={`/focus/${task.id}`} aria-label={`Start a focus session for ${task.subject}`}>
                                    <Play />
                                    Start
                                  </Link>
                                </Button>
                              </>
                            )
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-4">
            <Panel>
              <PanelTitle icon={<Timer />}>Free session</PanelTitle>
              <p className="text-sm text-muted-foreground">
                No task attached, and a timer you set yourself. Good for unplanned study or
                {subject ? ` a quick round of ${subject}.` : ' anything not on the plan.'}
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href={freeHref(subject)}>
                  <Play />
                  Start a free session
                </Link>
              </Button>
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
