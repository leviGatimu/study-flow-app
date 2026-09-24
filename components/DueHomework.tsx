import Link from 'next/link';
import { BookOpen } from 'lucide-react';

import { Panel, PanelTitle } from '@/components/ui/panel';
import { ListRow, Pill } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

type Homework = {
  id: string;
  subject: string;
  title: string;
  dueDate: Date;
  isCompleted: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Homework that needs doing soon, on the dashboard: anything overdue plus
 * anything due in the next seven days, soonest first.
 *
 * Due dates are stored as UTC midnight of the chosen day (the create form
 * sends a bare yyyy-mm-dd), so they are compared as calendar days against
 * `todayKey` - today's yyyy-mm-dd in the user's own timezone - never as
 * instants, or a 9pm check in Kigali would call tomorrow's homework "today".
 */
export function DueHomework({ homework, todayKey }: { homework: Homework[]; todayKey: string }) {
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const due = homework
    .filter((h) => !h.isCompleted)
    .map((h) => {
      const key = new Date(h.dueDate).toISOString().slice(0, 10);
      return { ...h, days: Math.round((Date.parse(`${key}T00:00:00Z`) - today) / DAY_MS) };
    })
    .filter((h) => h.days <= 7)
    .sort((a, b) => a.days - b.days);

  const shown = due.slice(0, 5);

  return (
    <Panel interactive>
      <PanelTitle
        icon={<BookOpen />}
        action={
          <Link href="/homeworks" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        }
      >
        Homework due
      </PanelTitle>

      {shown.length === 0 ? (
        <EmptyState
          title="Nothing due this week"
          description="Homework you add shows up here as its due date gets close."
          action={
            <Button asChild variant="outline">
              <Link href="/homeworks">Add homework</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((h) => (
            <ListRow
              key={h.id}
              href={`/homeworks?subject=${encodeURIComponent(h.subject)}`}
              title={h.title}
              subtitle={h.subject}
              trailing={
                <Pill tone={h.days < 0 ? 'danger' : h.days <= 1 ? 'warning' : 'default'}>
                  {h.days < 0
                    ? `${-h.days}d overdue`
                    : h.days === 0
                      ? 'Today'
                      : h.days === 1
                        ? 'Tomorrow'
                        : `In ${h.days} days`}
                </Pill>
              }
            />
          ))}
          {due.length > shown.length && (
            <p className="text-center text-xs font-medium text-muted-foreground">
              and {due.length - shown.length} more
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
