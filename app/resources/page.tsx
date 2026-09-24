import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getLibraryOverview } from '@/lib/library-actions';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { AddResourceForm } from '@/components/AddResourceForm';
import { LibraryOverview } from '@/components/resources/LibraryOverview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Resources: a folder per subject.
 *
 * On the desktop this is a real folder - Documents\Study Tracker\<Year> - and
 * the page reconciles it with the database before rendering, so a subject
 * folder created in Windows Explorer shows up here and vice versa. On the web
 * the same tree is virtual. Either way, opening a subject opens its folder.
 */
export default async function ResourcesPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const overview = await getLibraryOverview();
  if (!overview) redirect('/welcome');

  return (
    <Page>
      <PageHeader
        title="Resources"
        description={
          overview.folderPath
            ? 'Every subject is a folder on this computer. Add files here or drop them into the folder - both show up in both places.'
            : 'Notes, past papers and links, filed by subject and folder.'
        }
        actions={<AddResourceForm allSubjects={overview.subjects.map((s) => s.name)} />}
      />
      <PageBody>
        <LibraryOverview overview={overview} />
      </PageBody>
    </Page>
  );
}
