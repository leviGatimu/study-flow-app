import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, Clock, GraduationCap, Sparkles, Target } from 'lucide-react';

import { getUserId } from '@/lib/auth';
import { getMasteryItems, getSubjectStats } from '@/lib/actions';
import { getSubjectLibrary } from '@/lib/library-actions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { MasteryList } from '@/components/MasteryList';
import { SubjectExplorer } from '@/components/resources/SubjectExplorer';
import type { MasteryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * One subject's folder.
 *
 * The explorer takes the width; the rail beside it shows whatever is
 * selected, then the subject's numbers and its syllabus checklist. On the
 * desktop the page also reconciles the real folder on disk before rendering,
 * so anything dropped in from Windows Explorer is already here.
 */
export default async function SubjectResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ path?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { subject } = await params;
  const { path } = await searchParams;
  const decodedSubject = decodeURIComponent(subject);

  const [library, masteryItems, stats] = await Promise.all([
    getSubjectLibrary(decodedSubject),
    getMasteryItems(decodedSubject),
    getSubjectStats(decodedSubject),
  ]);
  if (!library) notFound();

  const initialPath = (Array.isArray(path) ? path[0] : path) ?? '';
  const files = library.items.filter((i) => i.type === 'FILE').length;
  const links = library.items.filter((i) => i.type === 'LINK').length;
  const folders = library.items.filter((i) => i.type === 'FOLDER').length;
  const summary = [
    `${files} ${files === 1 ? 'file' : 'files'}`,
    `${links} ${links === 1 ? 'link' : 'links'}`,
    `${folders} ${folders === 1 ? 'folder' : 'folders'}`,
  ].join(' · ');

  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-16 pt-6 md:px-8 animate-in fade-in duration-300">
      <Link
        href="/resources"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-3.5" /> All subjects
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
            {library.subject}
          </span>
        }
        description={summary}
        actions={
          <Button asChild variant="outline">
            <Link href={`/studio/${encodeURIComponent(library.subject)}`}>
              <Sparkles /> Deep work studio
            </Link>
          </Button>
        }
      />

      <SubjectExplorer
        library={library}
        initialPath={initialPath}
        aside={
          <>
            {stats && (
              <Panel className="grid grid-cols-2 gap-3" padded>
                <Figure icon={<Clock className="size-4 text-primary" />} label="Time spent" value={stats.timeSpent} />
                <Figure icon={<Target className="size-4 text-success" />} label="Mastery" value={`${stats.completionRate}%`} />
                <Figure label="Sessions" value={stats.totalSessions} />
                <Figure
                  label="Avg. session"
                  value={stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
                />
              </Panel>
            )}

            <Panel>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-semibold">Syllabus mastery</h2>
                <AddMasteryForm subject={library.subject} />
              </div>
              <MasteryList items={masteryItems as MasteryItem[]} subject={library.subject} />
            </Panel>
          </>
        }
      />
    </div>
  );
}

function Figure({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
