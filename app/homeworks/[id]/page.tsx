import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { Timer } from 'lucide-react';

import { getHomework } from '@/lib/homework-actions';
import { getSubjects } from '@/lib/subject-actions';
import { getCurrentUserTimezone } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getTimeZoneOffsetMinutes, getZonedNow } from '@/lib/utils';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Pill } from '@/components/ui/list-row';
import { Button } from '@/components/ui/button';
import { daysUntil, formatDay, relativeDue } from '../homework-model';
import { HomeworkWorkspace } from '../HomeworkWorkspace';

export const dynamic = 'force-dynamic';

const DAY = 'yyyy-MM-dd';
/** Due dates are stored as UTC midnight of the chosen day. */
const dateOnlyDay = (d: Date) => format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), DAY);

export default async function HomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const { id } = await params;
  const [hw, subjects, timeZone] = await Promise.all([getHomework(id), getSubjects(), getCurrentUserTimezone()]);
  if (!hw) notFound();

  const today = format(getZonedNow(timeZone), DAY);
  const dueDay = dateOnlyDay(hw.dueDate);
  const late = !hw.isCompleted && daysUntil(dueDay, today) < 0;
  const completedDay = hw.completedAt
    ? dateOnlyDay(new Date(hw.completedAt.getTime() + getTimeZoneOffsetMinutes(timeZone, hw.completedAt) * 60_000))
    : null;

  return (
    <Page>
      <PageHeader
        back={{ href: '/homeworks', label: 'All homework' }}
        title={hw.title}
        description={`${hw.subject} · Due ${formatDay(dueDay, today)}`}
        meta={
          hw.isCompleted ? (
            <Pill tone="success">Finished</Pill>
          ) : (
            <Pill tone={late ? 'danger' : dueDay === today ? 'warning' : 'default'}>{relativeDue(dueDay, today)}</Pill>
          )
        }
        actions={
          !hw.isCompleted && (
            <Button asChild variant="outline">
              <Link href={`/focus?subject=${encodeURIComponent(hw.subject)}`}>
                <Timer /> Focus on it
              </Link>
            </Button>
          )
        }
      />
      <PageBody className="@container">
        <HomeworkWorkspace
          subjects={subjects.map((s) => s.name)}
          homework={{
            id: hw.id,
            title: hw.title,
            subject: hw.subject,
            dueDay,
            description: hw.description ?? '',
            answer: hw.answer ?? '',
            briefFileUrl: hw.briefFileUrl,
            answerFileUrl: hw.answerFileUrl,
            proofUrl: hw.proofUrl,
            isCompleted: hw.isCompleted,
            completedLabel: completedDay ? formatDay(completedDay, today) : null,
          }}
        />
      </PageBody>
    </Page>
  );
}
