import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { getHomeworks } from '@/lib/homework-actions';
import { getSubjects } from '@/lib/subject-actions';
import { getCurrentUserTimezone } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getTimeZoneOffsetMinutes, getZonedNow, isSubjectSimilar } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { HomeworkList } from './HomeworkList';
import { AddHomeworkButton } from './CreateHomeworkForm';
import type { HomeworkItem, SubjectChip } from './homework-model';

export const dynamic = 'force-dynamic';

const DAY = 'yyyy-MM-dd';

/**
 * A due date is a date-only value: the form sends "yyyy-MM-dd", which the
 * action parses as UTC midnight. Its UTC fields are the day the student picked,
 * whatever timezone they are in.
 */
function dateOnlyDay(d: Date): string {
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), DAY);
}

/** A real instant (planned day, completion time) read on the user's clock. */
function instantDay(d: Date, timeZone: string): string {
  const shifted = new Date(d.getTime() + getTimeZoneOffsetMinutes(timeZone, d) * 60_000);
  return dateOnlyDay(shifted);
}

export default async function HomeworksPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [homeworks, subjects, timeZone, params] = await Promise.all([
    getHomeworks(),
    getSubjects(),
    getCurrentUserTimezone(),
    searchParams,
  ]);

  // ?subject= narrows the list to one subject; its page in Subjects links here.
  const subjectFilter = (Array.isArray(params.subject) ? params.subject[0] : params.subject)?.trim() || null;

  const items: HomeworkItem[] = homeworks.map((h) => ({
    id: h.id,
    subject: h.subject,
    title: h.title,
    description: h.description?.trim() || null,
    dueDay: dateOnlyDay(h.dueDate),
    plannedDay: h.plannedDate ? instantDay(h.plannedDate, timeZone) : null,
    isCompleted: h.isCompleted,
    completedDay: h.completedAt ? instantDay(h.completedAt, timeZone) : null,
    completedAt: h.completedAt ? h.completedAt.toISOString() : null,
    proofUrl: h.proofUrl,
  }));

  // One chip per subject that has homework, so the row always shows every
  // subject, not just the one being filtered to.
  const openBySubject = new Map<string, number>();
  for (const h of items) {
    openBySubject.set(h.subject, (openBySubject.get(h.subject) ?? 0) + (h.isCompleted ? 0 : 1));
  }
  const chips: SubjectChip[] = [...openBySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, open]) => ({
      name,
      open,
      active: subjectFilter !== null && isSubjectSimilar(name, subjectFilter),
    }));

  const shown = subjectFilter ? items.filter((h) => isSubjectSimilar(h.subject, subjectFilter)) : items;
  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 animate-in fade-in duration-300">
      <PageHeader
        title="Homework"
        description="What is due, in the order it is due. Finish an assignment by uploading proof of the work."
        actions={<AddHomeworkButton subjects={subjectOptions} defaultSubject={subjectFilter} />}
      />
      <HomeworkList
        homeworks={shown}
        today={format(getZonedNow(timeZone), DAY)}
        chips={chips}
        activeSubject={subjectFilter}
        subjects={subjectOptions}
      />
    </div>
  );
}
