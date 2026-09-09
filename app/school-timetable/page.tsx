import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';

import { SchoolTimetable } from '@/components/SchoolTimetable';
import { getSchoolLessons } from '@/lib/school-actions';
import { getViewScope } from '@/lib/scope';

export const dynamic = 'force-dynamic';

/**
 * Your school day: upload it, then correct it.
 *
 * This replaces the old admin-only "School Portal", which showed a timetable
 * hardcoded in the component - one real student's lessons, rendered on every
 * account's dashboard and week view. The lessons are per-user rows now, read off
 * a photo of the real timetable and edited here.
 */
export default async function SchoolTimetablePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [lessons, scope] = await Promise.all([getSchoolLessons(), getViewScope(userId)]);

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto px-4 md:px-8 pb-16">
      <div className="pt-6 pb-2 border-b border-border/40 flex items-center justify-between gap-6">
        <div data-tour="school-timetable-intro">
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">
            School Timetable
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {scope
              ? `The lessons you attend in ${scope.label}. Upload a photo of your timetable and it will be read for you — then fix anything that came out wrong.`
              : 'The lessons you attend. Upload a photo of your timetable and it will be read for you — then fix anything that came out wrong.'}
          </p>
        </div>
        <div className="p-4 bg-primary/10 rounded-3xl text-primary shrink-0">
          <GraduationCap className="w-8 h-8" />
        </div>
      </div>

      <SchoolTimetable lessons={lessons} canEdit={!scope?.isArchive} />
    </div>
  );
}
