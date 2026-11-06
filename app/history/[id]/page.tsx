import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, CircleDashed, ClipboardList, Clock3, FileText, FolderOpen, GraduationCap, Target, Timer, XCircle } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getCurrentUserTimezone, getSubjectSessions } from '@/lib/actions';
import { getViewScope } from '@/lib/scope';
import { readStudyLog } from '@/lib/study-log';
import { focusDuration } from '@/lib/focus-record';
import { blockMinutes, formatMinutes } from '@/lib/schedule-layout';
import { taskDayKey } from '@/lib/schedule-placement';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';
import { cleanSubject } from '../history-model';

export const dynamic = 'force-dynamic';

const OTHER_BLOCKS_SHOWN = 6;

/** One study block and what happened in it, laid out like a single exam. */
export default async function StudyLogPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  const [{ id }, scope, timezone] = await Promise.all([params, getViewScope(userId), getCurrentUserTimezone()]);
  const log = await readStudyLog(prisma, id, userId, scope?.termIds);
  if (!log) notFound();

  const { task, summary, sessions } = log;
  const subject = cleanSubject(task.subject) || task.subject;
  const [homework, subjectBlocks] = await Promise.all([
    prisma.homework.findFirst({ where: { userId, taskId: id }, select: { id: true, title: true } }),
    getSubjectSessions(subject),
  ]);
  const otherBlocks = subjectBlocks.filter((block) => block.id !== id && (block.isDone || block.isMissed));

  const measured = summary._count > 0;
  const plannedMinutes = blockMinutes(task.startTime, task.endTime);
  const focusSeconds = summary._sum.focusSeconds ?? 0;
  const focusShare = plannedMinutes > 0 ? Math.round((focusSeconds / (plannedMinutes * 60)) * 100) : 0;
  const overnight = task.endTime < task.startTime;
  const when = `${task.startTime}–${task.endTime}${overnight ? ' (next day)' : ''}`;
  const day = format(parseISO(taskDayKey(task.date, timezone)), 'EEEE d MMMM yyyy');
  const stamp = (value: Date) => new Intl.DateTimeFormat('en', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(value);
  const encoded = encodeURIComponent(subject);

  return (
    <Page>
      <PageHeader
        back={{ href: '/history', label: 'All completed work' }}
        title={<span className="break-words">{subject}</span>}
        highlight={{
          label: task.type === 'REVISION' ? 'Revision' : 'Homework',
          value: task.isDone ? 'Finished' : task.isMissed ? 'Missed' : 'Still to do',
        }}
        description={`${day} · ${when}`}
      />

      <PageBody className="space-y-6 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {!task.isDone && (
            <Button asChild>
              <Link href={`/focus/${task.id}`}><Timer /> Focus on it</Link>
            </Button>
          )}
          {homework && (
            <Button asChild variant="outline">
              <Link href={`/homeworks/${homework.id}`}><ClipboardList /> Open homework</Link>
            </Button>
          )}
          {task.exam && (
            <Button asChild variant="outline">
              <Link href={`/exams/${task.exam.id}`}><GraduationCap /> Open exam</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/subjects?subject=${encoded}`}><BookOpen /> Open {subject}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/resources/${encoded}`}><FolderOpen /> Resources</Link>
          </Button>
          <div className="ml-auto">
            <DeleteTaskButton taskId={task.id} />
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
            <Panel>
              <PanelTitle icon={<FileText />}>What you studied</PanelTitle>
              {task.workDescription ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{task.workDescription}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes were added to this block.</p>
              )}
              {task.proofPdfUrl && (
                <Button asChild variant="outline" className="mt-4">
                  <a href={task.proofPdfUrl} target="_blank" rel="noreferrer">
                    Open attached work <ArrowUpRight />
                  </a>
                </Button>
              )}
            </Panel>

            <Panel>
              <PanelTitle icon={<Timer />} action={measured && <Pill>{summary._count}</Pill>}>Focus sessions</PanelTitle>
              {!measured ? (
                <p className="text-sm text-muted-foreground">No focus sessions were recorded for this block. Focus time is saved when you finish a focus session on a block.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border/60 text-sm">
                    {sessions.map((session) => (
                      <li key={session.id} className="flex items-center gap-2.5 py-2">
                        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
                        <span className="min-w-0 flex-1 truncate">{stamp(session.createdAt)}</span>
                        <span className="shrink-0 font-medium tabular-nums">{focusDuration(session.focusSeconds ?? 0)}</span>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{session.amount} XP</span>
                      </li>
                    ))}
                  </ul>
                  {summary._count > sessions.length && (
                    <p className="mt-2 text-xs text-muted-foreground">Showing the latest {sessions.length}. Totals include every session.</p>
                  )}
                </>
              )}
            </Panel>

            {otherBlocks.length > 0 && (
              <Panel>
                <PanelTitle icon={<CalendarDays />} action={<Pill>{otherBlocks.length}</Pill>}>Other {subject} blocks</PanelTitle>
                <ul className="divide-y divide-border/60 text-sm">
                  {otherBlocks.slice(0, OTHER_BLOCKS_SHOWN).map((block) => (
                    <li key={block.id}>
                      <Link href={`/history/${block.id}`} className="flex items-center gap-2.5 py-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                        {block.isDone ? (
                          <CheckCircle2 aria-label="Finished" className="size-4 shrink-0 text-success" />
                        ) : block.isMissed ? (
                          <XCircle aria-label="Missed" className="size-4 shrink-0 text-destructive" />
                        ) : (
                          <CircleDashed aria-label="Still to do" className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{format(parseISO(taskDayKey(new Date(block.date), timezone)), 'EEE d MMM')}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{block.startTime}–{block.endTime}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {otherBlocks.length > OTHER_BLOCKS_SHOWN && (
                  <Link href={`/subjects?subject=${encoded}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                    See all in {subject}
                  </Link>
                )}
              </Panel>
            )}
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-5 xl:col-span-4">
            <Panel>
              <PanelTitle icon={<Target />}>This block</PanelTitle>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Focused of planned time</span>
                  <span className="font-heading text-lg font-bold tabular-nums text-foreground">{measured ? `${focusShare}%` : '0%'}</span>
                </div>
                <Progress value={Math.min(100, focusShare)} className="h-2" />
              </div>
              <dl className="mt-3 divide-y divide-border/60 text-sm">
                {(
                  [
                    ['Planned length', formatMinutes(plannedMinutes)],
                    ['Focus time', measured ? focusDuration(focusSeconds) : 'None'],
                    ['Focus sessions', measured ? String(summary._count) : 'None'],
                    ['Focus XP', measured ? String(summary._sum.amount ?? 0) : 'None'],
                    ...(measured ? [['Longest session', focusDuration(summary._max.focusSeconds ?? 0)]] : []),
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel>
              <PanelTitle icon={<Clock3 />}>Details</PanelTitle>
              <dl className="divide-y divide-border/60 text-sm">
                {(
                  [
                    ['Scheduled', when],
                    ['Kind of block', task.template ? 'From your routine' : 'Added by hand'],
                    ...(task.template ? [['Due day', task.template.deadlineDay]] : []),
                    ...(homework ? [['Homework', homework.title]] : []),
                    ['Last changed', stamp(task.updatedAt)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
