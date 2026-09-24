'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, FileUp, Loader2, PartyPopper, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { completeHomework, deleteHomework, planHomework } from '@/lib/homework-actions';

import { HomeworkRow } from './HomeworkRow';
import { AddHomeworkButton } from './CreateHomeworkForm';
import {
  GROUP_ORDER,
  isWithinNextWeek,
  subjectDots,
  urgencyOf,
  type HomeworkItem,
  type SubjectChip,
  type UrgencyGroup,
} from './homework-model';

interface HomeworkListProps {
  /** Already narrowed to the active subject, when there is one. */
  homeworks: HomeworkItem[];
  /** The user's calendar day, "yyyy-MM-dd", decided on the server. */
  today: string;
  /** Every subject that has homework, whatever the filter. */
  chips: SubjectChip[];
  activeSubject: string | null;
  subjects: { id: string; name: string }[];
}

export function HomeworkList({ homeworks, today, chips, activeSubject, subjects }: HomeworkListProps) {
  const archived = useIsArchived();
  const [completing, setCompleting] = useState<HomeworkItem | null>(null);
  const [planning, setPlanning] = useState<HomeworkItem | null>(null);
  const [deleting, setDeleting] = useState<HomeworkItem | null>(null);

  const { open, done, groups, summary } = useMemo(() => {
    const open = homeworks.filter((h) => !h.isCompleted).sort((a, b) => a.dueDay.localeCompare(b.dueDay));
    const done = homeworks
      .filter((h) => h.isCompleted)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    const groups = new Map<UrgencyGroup, HomeworkItem[]>();
    for (const h of open) {
      const key = urgencyOf(h.dueDay, today);
      groups.set(key, [...(groups.get(key) ?? []), h]);
    }
    return {
      open,
      done,
      groups,
      summary: {
        overdue: groups.get('overdue')?.length ?? 0,
        today: groups.get('today')?.length ?? 0,
        week: open.filter((h) => isWithinNextWeek(h.dueDay, today)).length,
        done: done.length,
      },
    };
  }, [homeworks, today]);

  const dotFor = useMemo(() => subjectDots(chips.map((c) => c.name)), [chips]);

  const rowProps = {
    today,
    canEdit: !archived,
    onComplete: setCompleting,
    onPlan: setPlanning,
    onDelete: setDeleting,
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      {/* The rail comes first in the DOM so phones get the summary and the
          subject filter above the list; on wide screens it sits to the right. */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:order-last lg:self-start">
        <Panel className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-2">
          <Stat
            label="Overdue"
            value={summary.overdue}
            tone={summary.overdue > 0 ? 'danger' : 'default'}
            icon={<AlertCircle className="size-4" />}
          />
          <Stat
            label="Due today"
            value={summary.today}
            tone={summary.today > 0 ? 'primary' : 'default'}
            icon={<Clock className="size-4" />}
          />
          <Stat label="Next 7 days" value={summary.week} icon={<CalendarDays className="size-4" />} />
          <Stat label="Done" value={summary.done} tone="success" icon={<CheckCircle2 className="size-4" />} />
        </Panel>
        <SubjectChips chips={chips} activeSubject={activeSubject} dotFor={dotFor} />
      </aside>

      <div className="min-w-0">
        <Tabs defaultValue="todo" className="gap-4">
          <TabsList className="h-9">
            <TabsTrigger value="todo" className="px-3">
              To do <Count n={open.length} />
            </TabsTrigger>
            <TabsTrigger value="done" className="px-3">
              Done <Count n={done.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todo" className="space-y-6">
            {open.length === 0 ? (
              homeworks.length === 0 ? (
                <EmptyState
                  icon={<BookOpen />}
                  title={activeSubject ? `No homework for ${activeSubject}` : 'No homework yet'}
                  description="Add an assignment when you get one, and it will show up here sorted by when it is due."
                  action={<AddHomeworkButton subjects={subjects} defaultSubject={activeSubject} variant="outline" />}
                />
              ) : (
                <EmptyState
                  icon={<PartyPopper />}
                  title="All caught up"
                  description="Nothing is waiting to be done. Finished work is under Done."
                  action={<AddHomeworkButton subjects={subjects} defaultSubject={activeSubject} variant="outline" />}
                />
              )
            ) : (
              GROUP_ORDER.filter((g) => groups.has(g.key)).map((g) => {
                const items = groups.get(g.key)!;
                return (
                  <section key={g.key} aria-labelledby={`hw-group-${g.key}`} className="space-y-2">
                    <h2
                      id={`hw-group-${g.key}`}
                      className={cn(
                        'flex items-center gap-2 px-1 text-sm font-semibold',
                        g.key === 'overdue' ? 'text-destructive' : 'text-foreground'
                      )}
                    >
                      {g.label}
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">{items.length}</span>
                    </h2>
                    <Panel padded={false} className="overflow-hidden">
                      <ul className="divide-y divide-border">
                        {items.map((hw) => (
                          <HomeworkRow key={hw.id} homework={hw} dotClass={dotFor(hw.subject)} {...rowProps} />
                        ))}
                      </ul>
                    </Panel>
                  </section>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="done">
            {done.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title="Nothing finished yet"
                description="Completed homework, with the proof you uploaded, is kept here."
              />
            ) : (
              <Panel padded={false} className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {done.map((hw) => (
                    <HomeworkRow key={hw.id} homework={hw} dotClass={dotFor(hw.subject)} {...rowProps} />
                  ))}
                </ul>
              </Panel>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CompleteDialog homework={completing} onClose={() => setCompleting(null)} />
      <PlanDialog homework={planning} onClose={() => setPlanning(null)} />
      <DeleteDialog homework={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-xs font-normal text-muted-foreground tabular-nums">{n}</span>;
}

function SubjectChips({
  chips,
  activeSubject,
  dotFor,
}: {
  chips: SubjectChip[];
  activeSubject: string | null;
  dotFor: (subject: string) => string;
}) {
  // A subject filter can arrive from a subject page before it has any homework;
  // it still gets a chip so the active filter is visible and clearable.
  const all =
    activeSubject && !chips.some((c) => c.active) ? [...chips, { name: activeSubject, open: 0, active: true }] : chips;
  if (all.length === 0) return null;

  const chipClass = (active: boolean) =>
    cn(
      'inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
      active
        ? 'border-primary/40 bg-primary/10 font-medium text-primary'
        : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground'
    );

  return (
    // One swipeable strip on phones (it scrolls itself, never the page); wraps
    // from sm up, and becomes a card in the side rail on wide screens.
    <nav
      aria-label="Filter by subject"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-4"
    >
      <p className="hidden w-full pb-1 text-xs text-muted-foreground lg:block">Subjects</p>
      <Link href="/homeworks" className={chipClass(!activeSubject)} aria-current={!activeSubject ? 'page' : undefined}>
        All subjects
      </Link>
      {all.map((c) => (
        <Link
          key={c.name}
          href={`/homeworks?subject=${encodeURIComponent(c.name)}`}
          className={chipClass(c.active)}
          aria-current={c.active ? 'page' : undefined}
        >
          <span className={cn('size-2 rounded-full', dotFor(c.name))} aria-hidden />
          {c.name}
          {c.open > 0 && <span className="text-xs tabular-nums opacity-70">{c.open}</span>}
        </Link>
      ))}
    </nav>
  );
}

function CompleteDialog({ homework, onClose }: { homework: HomeworkItem | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);

  async function handleComplete(formData: FormData) {
    setPending(true);
    try {
      const result = await completeHomework(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Homework completed! +200 XP');
        onClose();
      }
    } catch {
      toast.error('Failed to complete');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={homework !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Finish homework</DialogTitle>
          <DialogDescription>
            Upload a photo, screenshot or PDF of <span className="font-medium text-foreground">{homework?.title}</span> to
            mark it done.
          </DialogDescription>
        </DialogHeader>
        {homework && (
          <form action={handleComplete} className="space-y-4">
            <input type="hidden" name="homeworkId" value={homework.id} />
            <label
              htmlFor="hw-proof"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/50"
            >
              <FileUp className="size-6 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-foreground">Proof of work</span>
              <span className="text-xs text-muted-foreground">Image or PDF. Required to complete.</span>
            </label>
            <Input id="hw-proof" type="file" name="file" accept="image/*,application/pdf" required className="h-10 cursor-pointer" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className="h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="h-10 gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />} Submit and finish
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ homework, onClose }: { homework: HomeworkItem | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);

  async function handlePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!homework) return;
    const dateStr = new FormData(e.currentTarget).get('plannedDate') as string;
    setPending(true);
    try {
      const result = await planHomework(homework.id, new Date(dateStr));
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Study session planned');
        onClose();
      }
    } catch {
      toast.error('Failed to plan');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={homework !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Plan a study day</DialogTitle>
          <DialogDescription>
            Pick the day you will work on <span className="font-medium text-foreground">{homework?.title}</span>.
          </DialogDescription>
        </DialogHeader>
        {homework && (
          <form onSubmit={handlePlan} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hw-plannedDate">Date</Label>
              <Input
                id="hw-plannedDate"
                type="date"
                name="plannedDate"
                defaultValue={homework.plannedDay ?? ''}
                required
                className="h-10"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className="h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="h-10 gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />} Save plan
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ homework, onClose }: { homework: HomeworkItem | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!homework) return;
    setPending(true);
    try {
      const result = await deleteHomework(homework.id);
      if (result && 'error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success('Homework deleted');
        onClose();
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setPending(false);
    }
  }

  return (
    <ConfirmModal
      isOpen={homework !== null}
      onClose={onClose}
      onConfirm={handleDelete}
      isPending={pending}
      title="Delete this homework?"
      description={homework ? `"${homework.title}" and any proof you uploaded will be removed.` : ''}
    />
  );
}
