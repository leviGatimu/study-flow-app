import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Clock, GraduationCap, Sparkles, Target } from 'lucide-react';

import { getUserId } from '@/lib/auth';
import { getMasteryItems, getSubjectStats } from '@/lib/actions';
import { getSubjectLibrary } from '@/lib/library-actions';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { AddMasteryForm } from '@/components/AddMasteryForm';
import { MasteryList } from '@/components/MasteryList';
import { SubjectExplorer } from '@/components/resources/SubjectExplorer';
import type { MasteryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * One subject's folder, as a File Explorer window, with the subject's numbers
 * and syllabus checklist beneath it. On the desktop the page reconciles the
 * real folder on disk before rendering, so anything dropped in from Windows
 * Explorer is already here.
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

  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-16 pt-4 md:px-6 animate-in fade-in duration-300">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold">
          <GraduationCap className="size-5 shrink-0 text-primary" />
          <span className="truncate">{library.subject}</span>
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/studio/${encodeURIComponent(library.subject)}`}>
            <Sparkles /> Deep work studio
          </Link>
        </Button>
      </div>

      <SubjectExplorer library={library} initialPath={initialPath} />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {stats && (
          <Panel className="grid grid-cols-2 content-start gap-3" padded>
            <Figure icon={<Clock className="size-4 text-primary" />} label="Time spent" value={stats.timeSpent} />
            <Figure icon={<Target className="size-4 text-success" />} label="Mastery" value={`${stats.completionRate}%`} />
            <Figure label="Sessions" value={stats.totalSessions} />
            <Figure
              label="Avg. session"
              value={stats.totalSessions > 0 ? `${Math.round(stats.totalMinutes / stats.totalSessions)}m` : '0m'}
            />
          </Panel>
        )}

        <Panel className={stats ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-semibold">Syllabus mastery</h2>
            <AddMasteryForm subject={library.subject} />
          </div>
          <MasteryList items={masteryItems as MasteryItem[]} subject={library.subject} />
        </Panel>
      </div>
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
