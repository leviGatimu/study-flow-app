import { notFound, redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getLibraryRail, getSubjectLibrary } from '@/lib/library-actions';
import { Page, PageBody } from '@/components/ui/page';
import { SubjectFolder } from '@/components/resources/SubjectFolder';
import { DriveRail } from '@/components/resources/DriveRail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * One subject's folder as a Study Flow page: breadcrumb, Upload / New folder /
 * Add link, then folders and files as cards. The subject's page in Subjects
 * and its practice are in the page's ⋯ menu. On the desktop the page
 * reconciles the real folder on disk before rendering, so anything dropped in
 * from Windows Explorer is already here.
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
  const rail = await getLibraryRail();

  return (
    <Page>
      <PageBody className="pt-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <DriveRail folders={rail} />
          <div className="min-w-0">
            <SubjectFolder library={library} initialPath={initialPath} />
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
