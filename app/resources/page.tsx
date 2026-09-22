import { redirect } from 'next/navigation';
import { Layers } from 'lucide-react';

import { getUserId } from '@/lib/auth';
import { getLibraryOverview } from '@/lib/library-actions';
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
    <div className="mx-auto max-w-[1800px] px-4 pb-16 pt-8 md:px-8 animate-in fade-in duration-300">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </span>
            Resources
          </span>
        }
        description={
          overview.folderPath
            ? 'Every subject is a folder on this computer. Add files here or drop them into the folder - both show up in both places.'
            : 'Notes, past papers and links, filed by subject and folder.'
        }
        actions={<AddResourceForm allSubjects={overview.subjects.map((s) => s.name)} />}
      />
      <LibraryOverview overview={overview} />
    </div>
  );
}
