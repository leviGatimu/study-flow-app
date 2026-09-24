import { getHomeworks } from '@/lib/homework-actions';
import { HomeworkList } from './HomeworkList';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { getSubjects } from '@/lib/subject-actions';
import { isSubjectSimilar } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomeworksPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [homeworks, subjects, params] = await Promise.all([
    getHomeworks(),
    getSubjects(),
    searchParams,
  ]);

  // ?subject= narrows the list to one subject; its page in Subjects links here.
  const subjectFilter = (Array.isArray(params.subject) ? params.subject[0] : params.subject)?.trim() || null;
  const shown = subjectFilter
    ? homeworks.filter((h) => isSubjectSimilar(h.subject, subjectFilter))
    : homeworks;

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <header className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> Homeworks
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Track, plan, and manage your academic assignments.</p>
        {subjectFilter && <SubjectFilterChip subject={subjectFilter} clearHref="/homeworks" />}
      </header>

      <div className="px-4 md:px-8">
        <HomeworkList homeworks={shown} subjects={subjects} defaultSubject={subjectFilter} />
      </div>
    </div>
  );
}

function SubjectFilterChip({ subject, clearHref }: { subject: string; clearHref: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Showing</span>
      <Link
        href={`/subjects?subject=${encodeURIComponent(subject)}`}
        className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary hover:bg-primary/15"
      >
        {subject}
      </Link>
      <Link
        href={clearHref}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" /> All subjects
      </Link>
    </div>
  );
}
