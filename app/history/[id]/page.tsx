import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Clock3, FileText, Timer } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { getCurrentUserTimezone } from '@/lib/actions';
import { getViewScope } from '@/lib/scope';
import { readStudyLog } from '@/lib/study-log';
import { focusDuration } from '@/lib/focus-record';
import { blockMinutes, formatMinutes } from '@/lib/schedule-layout';
import { Page, PageBody } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import styles from './LogDetail.module.css';

export const dynamic = 'force-dynamic';

export default async function StudyLogPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  const [{ id }, scope, timezone] = await Promise.all([params, getViewScope(userId), getCurrentUserTimezone()]);
  const log = await readStudyLog(prisma, id, userId, scope?.termIds);
  if (!log) notFound();
  const { task, summary, sessions } = log;
  const measured = summary._count > 0;
  const planned = blockMinutes(task.startTime, task.endTime);
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' }).format(task.date);
  const stamp = (value: Date) => new Intl.DateTimeFormat('en', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(value);
  const metrics = [
    { label: 'Focus time', value: measured ? focusDuration(summary._sum.focusSeconds ?? 0) : 'Not recorded', hint: 'Measured by the focus timer' },
    { label: 'Planned length', value: formatMinutes(planned), hint: `${task.startTime} – ${task.endTime}${task.endTime < task.startTime ? ' · next day' : ''}` },
    { label: 'Focus sessions', value: measured ? String(summary._count) : '—', hint: 'Saved for this study block' },
    { label: 'Focus XP', value: measured ? String(summary._sum.amount ?? 0) : '—', hint: 'From these focus sessions' },
  ];
  return <Page>
    <header className={styles.header}>
      <Link className={styles.back} href="/history"><ArrowLeft className="size-4" />All study logs</Link>
      <div className={styles.titleRow}><div><p className={styles.eyebrow}>{task.type === 'REVISION' ? 'Revision' : 'Homework'} · Study log</p><h1>{task.subject}</h1><p className={styles.date}>{date}</p></div>
        <span className={styles.status} data-status={task.isDone?'done':task.isMissed?'missed':'pending'}>{task.isDone?'Completed':task.isMissed?'Missed':'In progress'}</span>
      </div>
    </header>
    <PageBody>
      <dl className={styles.metrics}>{metrics.map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd><p>{metric.hint}</p></div>)}</dl>
      <div className={styles.columns}>
        <div className={styles.content}>
          <section><h2><FileText />What you studied</h2>{task.workDescription?<p className={styles.notes}>{task.workDescription}</p>:<p className={styles.empty}>No study notes were added to this block.</p>}
            {task.proofPdfUrl && <Button asChild variant="outline" className="mt-6 min-h-11 rounded-lg"><a href={task.proofPdfUrl} target="_blank" rel="noreferrer">Open attached work<ArrowUpRight className="size-4" /></a></Button>}
          </section>
          <section><div className={styles.sectionTop}><h2><Timer />Focus sessions</h2><span>{summary._count} recorded</span></div>
            {!measured?<p className={styles.empty}>No per-block focus measurements are available. Older logs keep their scheduled times; actual focus time is recorded when you finish a new focus session for this block.</p>:<>
              <ol className={styles.sessions}>{sessions.map((session,i)=><li key={session.id}><span className={styles.sessionNumber}>{String(summary._count-i).padStart(2,'0')}</span><div><strong>{focusDuration(session.focusSeconds ?? 0)}</strong><p>{stamp(session.createdAt)}</p></div><span>{session.amount} XP</span></li>)}</ol>
              {summary._count>sessions.length && <p className={styles.empty}>Showing the latest 50 sessions. Totals include every recorded session.</p>}
            </>}
          </section>
        </div>
        <aside className={styles.aside}>
          <h2><Clock3 />Block details</h2>
          <dl className={styles.facts}><div><dt>Scheduled start</dt><dd>{task.startTime}</dd></div><div><dt>Scheduled end</dt><dd>{task.endTime}{task.endTime<task.startTime?' (+1 day)':''}</dd></div><div><dt>Routine</dt><dd>{task.template?'Recurring block':'One-off block'}</dd></div>{task.template&&<div><dt>Deadline day</dt><dd>{task.template.deadlineDay}</dd></div>}<div><dt>Longest focus</dt><dd>{measured?focusDuration(summary._max.focusSeconds??0):'Not recorded'}</dd></div><div><dt>Average focus</dt><dd>{measured?focusDuration(summary._avg.focusSeconds??0):'Not recorded'}</dd></div><div><dt>Last updated</dt><dd>{stamp(task.updatedAt)}</dd></div><div><dt>Timezone</dt><dd>{timezone.replaceAll('_',' ')}</dd></div></dl>
          <p className={styles.explanation}>Planned length comes from your schedule. Focus time counts timer activity and excludes pauses. Session dates show when each session was saved.</p>
          {task.exam&&<Link href={`/exams/${task.exam.id}`} className={styles.back}>Related exam<ArrowUpRight className="size-4" /></Link>}
        </aside>
      </div>
    </PageBody>
  </Page>;
}
