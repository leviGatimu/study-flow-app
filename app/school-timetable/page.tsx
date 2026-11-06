import Link from 'next/link';
import { format } from 'date-fns';
import { getZonedNow } from '@/lib/utils';
import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { getCurrentUserTimezone } from '@/lib/actions';
import { getSchoolLessons } from '@/lib/school-actions';
import { listSubjects } from '@/lib/subject-actions';
import { getViewScope } from '@/lib/scope';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { SchoolTimetable } from '@/components/SchoolTimetable';

export const dynamic = 'force-dynamic';

/**
 * School lessons: your school day - upload it, then correct it.
 *
 * This replaces the old admin-only "School Portal", which showed a timetable
 * hardcoded in the component - one real student's lessons, rendered on every
 * account's dashboard and week view. The lessons are per-user rows now, read off
 * a photo of the real timetable and edited here.
 */
export default async function SchoolLessonsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let data: {
    lessons: Awaited<ReturnType<typeof getSchoolLessons>>;
    subjects: string[];
    scope: Awaited<ReturnType<typeof getViewScope>>;
    timezone: string;
  } | null = null;
  try {
    const [lessons, scope, timezone, subjects] = await Promise.all([
      getSchoolLessons(),
      getViewScope(userId),
      getCurrentUserTimezone(),
      listSubjects(),
    ]);
    data = { lessons, scope, timezone, subjects: subjects.map((s) => s.name) };
  } catch (error) {
    console.error('School lessons failed to load', error);
  }

  if (!data) {
    return (
      <Page>
        <PageHeader title="School lessons" description="The lessons you attend at school each week." />
        <PageBody>
          <ErrorState
            title="Your school lessons could not be loaded"
            description="Something went wrong reading your timetable. Your data is safe - try again in a moment."
            action={
              <Button asChild variant="outline">
                <Link href="/school-timetable">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return (
    <SchoolTimetable
      lessons={data.lessons}
      subjects={data.subjects}
      canEdit={!data.scope?.isArchive}
      timezone={data.timezone}
      yearLabel={data.scope?.label ?? null}
      initialNow={format(getZonedNow(data.timezone), "yyyy-MM-dd'T'HH:mm:ss")}
    />
  );
}
