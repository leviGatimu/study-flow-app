import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUserTimezone, getTemplates } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getSubjects } from '@/lib/subject-actions';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { ManageForm } from '@/components/ManageForm';

import { ManageClient } from './ManageClient';
import { formatMinutes, totalMinutes } from './routine-hours';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Study routine: the recurring blocks that fill every week. */
export default async function StudyRoutinePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let data: {
    templates: Awaited<ReturnType<typeof getTemplates>>;
    subjects: { id: string; name: string }[];
    timezone: string;
  } | null = null;
  try {
    const [templates, subjects, timezone] = await Promise.all([
      getTemplates(),
      getSubjects(),
      getCurrentUserTimezone(),
    ]);
    data = { templates, subjects, timezone };
  } catch (error) {
    console.error('Study routine failed to load', error);
  }

  return (
    <Page>
      <div data-tour="manage-intro">
        <PageHeader
          title="Study routine"
          description="The study blocks you repeat every week. They are added to your Week and Month automatically while a term is running."
          highlight={
            data && data.templates.length > 0
              ? { label: 'Study time each week', value: formatMinutes(totalMinutes(data.templates)) }
              : undefined
          }
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
      <PageBody>
        {data ? (
          <ManageClient initialTemplates={data.templates} subjects={data.subjects} timezone={data.timezone} />
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
