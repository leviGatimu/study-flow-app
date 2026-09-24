import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import { GraduationCap } from 'lucide-react';

import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

type ExamEvent = {
  id: string;
  title: string;
  date: Date;
  priority: string;
};

function daysLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/**
 * The dashboard's one exam widget: a countdown to the next paper, then the
 * few after it. Adding, editing and planning revision for exams happen on
 * /exams - this only points there, so there is one place exams are managed.
 *
 * `today` is the start of the user's day in their own timezone, passed in by
 * the page so server and client agree on what "in 3 days" means.
 */
export function ExamCountdown({ events, today }: { events: ExamEvent[]; today: Date }) {
  const upcoming = events
    .map((e) => ({ ...e, days: differenceInCalendarDays(new Date(e.date), today) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days);

  const [next, ...rest] = upcoming;

  return (
    <Panel interactive>
      <PanelTitle
        icon={<GraduationCap />}
        action={
          <Link href="/exams" className="text-sm font-medium text-primary hover:underline">
            All exams
          </Link>
        }
      >
        Exams
      </PanelTitle>

      {!next ? (
        <EmptyState
          title="No exams coming up"
          description="Add your exam dates and revision gets planned backwards from each one."
          action={
            <Button asChild variant="outline">
              <Link href="/exams">Add an exam</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <Link
            href={`/exams/${next.id}`}
            className="block rounded-2xl border border-border/40 bg-muted/40 px-5 py-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <p className="truncate text-xs font-bold text-orange-600 dark:text-orange-400">
              Next exam · {next.title}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-5xl font-black tracking-tight tabular-nums">
                {next.days}
              </span>
              <span className="text-lg font-bold text-muted-foreground">
                {next.days === 1 ? 'day' : 'days'} left
              </span>
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {format(new Date(next.date), 'EEEE, MMMM do')}
            </p>
          </Link>

          {rest.slice(0, 3).map((exam) => (
            <ListRow
              key={exam.id}
              href={`/exams/${exam.id}`}
              title={exam.title}
              subtitle={format(new Date(exam.date), 'EEE d MMM')}
              trailing={<Pill tone={exam.days <= 7 ? 'warning' : 'default'}>{daysLabel(exam.days)}</Pill>}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
