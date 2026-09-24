import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GraduationCap, Sparkles } from 'lucide-react';

import { getUserId } from '@/lib/auth';
import { getSubjectLibrary } from '@/lib/library-actions';
import { Button } from '@/components/ui/button';
import { SubjectExplorer } from '@/components/resources/SubjectExplorer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * One subject's folder, as a File Explorer window filling the whole content
 * area - nothing above or below it. The subject's numbers, homework and exams
 * live on its page in Subjects, one click away from the tab strip. On the
 * desktop the page reconciles the real folder on disk before rendering, so
 * anything dropped in from Windows Explorer is already here.
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

  const library = await getSubjectLibrary(decodeURIComponent(subject));
  if (!library) notFound();

  const initialPath = (Array.isArray(path) ? path[0] : path) ?? '';
  const encoded = encodeURIComponent(library.subject);

  return (
    <div className="h-full animate-in fade-in duration-300">
      <SubjectExplorer
        library={library}
        initialPath={initialPath}
        tabStripEnd={
          <>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={`/subjects?subject=${encoded}`}>
                <GraduationCap /> <span className="hidden sm:inline">{library.subject} hub</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={`/studio/${encoded}`}>
                <Sparkles /> <span className="hidden sm:inline">Deep work studio</span>
              </Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
