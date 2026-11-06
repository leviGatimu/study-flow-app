import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getTemplates } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getSubjects } from '@/lib/subject-actions';
import { ScheduleFrame } from '@/components/schedule/ScheduleFrame';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';

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

  if (data) return <ManageClient initialTemplates={data.templates} subjects={data.subjects} />;

  return (
    <ScheduleFrame title="Study routine">
      <div className="p-4 md:p-6">
        <ErrorState
          title="Your study routine could not be loaded"
          description="Something went wrong reading your routine. Your data is safe - try again in a moment."
          action={
            <Button asChild variant="outline">
              <Link href="/manage">Try again</Link>
            </Button>
          }
        />
      </div>
    </ScheduleFrame>
  );
}
