import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getTemplates } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getSubjects } from '@/lib/subject-actions';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { ManageForm } from '@/components/ManageForm';

import { ManageClient } from './ManageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Study routine: the recurring blocks that fill every week. */
export default async function StudyRoutinePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let data: { templates: Awaited<ReturnType<typeof getTemplates>>; subjects: { id: string; name: string }[] } | null =
    null;
  try {
    const [templates, subjects] = await Promise.all([getTemplates(), getSubjects()]);
    data = { templates, subjects };
  } catch (error) {
    console.error('Study routine failed to load', error);
  }

  return (
    <Page>
      <div data-tour="manage-intro">
        <PageHeader
          className="pt-7 pb-5 [&_h1]:text-3xl [&_h1]:font-semibold"
          title="Study routine"
          description="Plan your recurring homework and revision. Your routine fills each week while a term is running."
          actions={
            <>
              {data && data.templates.length > 0 && (
                <Button asChild variant="outline" size="lg">
                  <Link href="/timetable">See this week</Link>
                </Button>
              )}
              <span data-tour="manage-add">
                <ManageForm subjects={data?.subjects ?? []} />
              </span>
            </>
          }
        />
      </div>
      <PageBody className="space-y-6 pt-6">
        {data ? (
          <ManageClient initialTemplates={data.templates} subjects={data.subjects} />
        ) : (
          <ErrorState
            title="Your study routine could not be loaded"
            description="Something went wrong reading your routine. Your data is safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href="/manage">Try again</Link>
              </Button>
            }
          />
        )}
      </PageBody>
    </Page>
  );
}
