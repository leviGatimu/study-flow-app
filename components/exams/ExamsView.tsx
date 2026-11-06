'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';

import { CategoryDialog, type PickableExam } from '@/components/ExamCategories';
import { DeleteExamButton } from '@/components/ExamsClient';
import { useIsArchived } from '@/components/ArchiveContext';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/list-row';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normaliseCategory, type CategorySummary } from '@/lib/exam-category';
import { cn } from '@/lib/utils';

export type ExamRowData = {
  id: string;
  title: string;
  subject: string | null;
  category: string | null;
  /** Milliseconds, for ordering. */
  at: number;
  when: string;
  days: number;
  inProgress: boolean;
  isDone: boolean;
  /** Rounded percentage once a mark is in. */
  percent: number | null;
  priority: string;
};

const NO_CATEGORY = '__none';
const keyOf = (category: string | null) => normaliseCategory(category)?.toLowerCase() ?? NO_CATEGORY;

function countdown(exam: ExamRowData) {
  if (exam.inProgress) return { label: 'In progress', tone: 'danger' as const };
  if (exam.days === 0) return { label: 'Today', tone: 'danger' as const };
  if (exam.days === 1) return { label: 'Tomorrow', tone: 'danger' as const };
  return { label: `In ${exam.days} days`, tone: exam.days <= 3 ? ('danger' as const) : exam.days <= 7 ? ('warning' as const) : ('default' as const) };
}

const shownPercent = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** Every exam in one list, grouped by its category, with that category's average. */
export function ExamsView({
  exams,
  categories,
  pickable,
  names,
}: {
  exams: ExamRowData[];
  categories: CategorySummary[];
  pickable: PickableExam[];
  names: string[];
}) {
  const archived = useIsArchived();
  const [tab, setTab] = useState<'upcoming' | 'done'>(() => (exams.some((e) => !e.isDone) ? 'upcoming' : 'done'));
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState<{ name: string | null } | null>(null);

  const counts = { upcoming: exams.filter((e) => !e.isDone).length, done: exams.filter((e) => e.isDone).length };

  const groups = useMemo(() => {
    const shown = exams
      .filter((e) => (tab === 'done' ? e.isDone : !e.isDone))
      .filter((e) => filter === 'all' || keyOf(e.category) === filter)
      .sort((a, b) => (tab === 'done' ? b.at - a.at : a.at - b.at));
    const byCategory = new Map<string, { key: string; name: string | null; rows: ExamRowData[] }>();
    for (const exam of shown) {
      const key = keyOf(exam.category);
      const group = byCategory.get(key) ?? { key, name: normaliseCategory(exam.category), rows: [] };
      group.rows.push(exam);
      byCategory.set(key, group);
    }
    // Keeps the order rows were sorted in, except that exams with no category go last.
    return [...byCategory.values()].sort((a, b) => Number(a.key === NO_CATEGORY) - Number(b.key === NO_CATEGORY));
  }, [exams, tab, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Which exams" className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
          {([['upcoming', 'Coming up'], ['done', 'Done']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label} <span className="tabular-nums text-muted-foreground">{counts[value]}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {names.length > 0 && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger aria-label="Filter by category" className="h-9 w-48 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {names.map((name) => (
                  <SelectItem key={name} value={keyOf(name)}>{name}</SelectItem>
                ))}
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!archived && pickable.length > 0 && (
            <Button variant="outline" onClick={() => setDialog({ name: null })}>
              <Plus /> New category
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={tab === 'done' ? 'No finished exams here yet' : 'Nothing coming up here'} description={filter === 'all' ? 'Exams appear here as you add them.' : 'Try a different category.'} />
      ) : (
        groups.map((group) => {
          const summary = group.name ? categories.find((c) => keyOf(c.name) === group.key) : null;
          return (
            <section key={group.key} aria-label={group.name ?? 'No category'} className="overflow-hidden rounded-xl border border-border/60 bg-card">
              <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 bg-muted/30 px-4 py-2.5">
                <h2 className="min-w-0 flex-1 basis-48 break-words font-heading text-sm font-semibold text-foreground">{group.name ?? 'No category'}</h2>
                {summary && (
                  <p className="text-sm text-muted-foreground">
                    {summary.average !== null ? (
                      <>Average <span className="font-semibold tabular-nums text-foreground">{shownPercent(summary.average)}</span></>
                    ) : (
                      'No marks yet'
                    )}
                    {summary.best && summary.lowest && ` · Best ${summary.best.subject ?? summary.best.title} · Lowest ${summary.lowest.subject ?? summary.lowest.title}`}
                  </p>
                )}
                {summary && !archived && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${group.name}`} onClick={() => setDialog({ name: summary.name })}>
                    <Pencil />
                  </Button>
                )}
              </header>
              <ul className="divide-y divide-border/60">
                {group.rows.map((exam) => (
                  <ExamRow key={exam.id} exam={exam} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {dialog && (
        <CategoryDialog key={dialog.name ?? '__new'} initialName={dialog.name} exams={pickable} names={names} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function ExamRow({ exam }: { exam: ExamRowData }) {
  const due = countdown(exam);
  return (
    <li className="flex items-center gap-2 pr-2 transition-colors hover:bg-muted/40">
      <Link href={`/exams/${exam.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1 basis-56">
          <span className="block break-words font-semibold text-foreground">{exam.title}</span>
          <span className="block text-sm text-muted-foreground">{exam.when}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {exam.priority === 'HIGH' && !exam.isDone && <Pill tone="danger">High priority</Pill>}
          {exam.isDone ? (
            exam.percent !== null ? (
              <Pill tone="success"><CheckCircle2 /> {shownPercent(exam.percent)}</Pill>
            ) : (
              <Pill tone="warning">Marks pending</Pill>
            )
          ) : (
            <Pill tone={due.tone}>{due.label}</Pill>
          )}
        </span>
      </Link>
      <DeleteExamButton id={exam.id} title={exam.title} />
    </li>
  );
}
