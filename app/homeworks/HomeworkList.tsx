'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarClock, CheckCircle2, Loader2, PartyPopper, Timer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/list-row';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';
import { deleteHomework, planHomework } from '@/lib/homework-actions';
import { ClashDialog } from '@/components/schedule/ClashDialog';
import type { ClashInfo, ClashResolution } from '@/lib/schedule-clash';
import { HomeworkSlotFields } from './HomeworkSlotFields';
import { HomeworkWorkspace } from './HomeworkWorkspace';
import { AddHomeworkButton } from './CreateHomeworkForm';
import {
  formatDay,
  GROUP_ORDER,
  isWithinNextWeek,
  relativeDue,
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

const ALL = '__all';

/**
 * Homework as a list with the open one beside it, filling the screen. Phones
 * have no room for two panes, so a row there goes to the homework's own page.
 */
export function HomeworkList({ homeworks, today, chips, activeSubject, subjects }: HomeworkListProps) {
  const archived = useIsArchived();
  const router = useRouter();
  const [tab, setTab] = useState<'todo' | 'done'>(() => (homeworks.some((h) => !h.isCompleted) || homeworks.length === 0 ? 'todo' : 'done'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [leavingFor, setLeavingFor] = useState<string | null>(null);
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
      },
    };
  }, [homeworks, today]);

  const dotFor = useMemo(() => subjectDots(chips.map((c) => c.name)), [chips]);
  const visible = tab === 'todo' ? open : done;
  const selected = homeworks.find((h) => h.id === selectedId) ?? visible[0] ?? null;

  const pick = (id: string) => {
    if (id === selected?.id) return;
    if (unsaved) setLeavingFor(id);
    else setSelectedId(id);
  };
  const switchTab = (next: 'todo' | 'done') => {
    setTab(next);
    const first = (next === 'todo' ? open : done)[0];
    if (first) pick(first.id);
  };

  const row = (hw: HomeworkItem) => {
    const late = !hw.isCompleted && hw.dueDay < today;
    const inner = (
      <>
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dotFor(hw.subject))} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-foreground">{hw.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {hw.subject}
            {!hw.isCompleted && hw.block && hw.plannedDay && ` · ${hw.plannedDay === today ? 'Today' : formatDay(hw.plannedDay, today)} ${hw.block.startTime}`}
          </span>
        </span>
        <span className={cn('shrink-0 text-xs font-medium tabular-nums', late ? 'text-destructive' : 'text-muted-foreground')}>
          {hw.isCompleted ? (hw.completedDay ? formatDay(hw.completedDay, today) : 'Done') : relativeDue(hw.dueDay, today)}
        </span>
      </>
    );
    const rowClass = 'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50';
    return (
      <li key={hw.id}>
        <button
          type="button"
          aria-current={hw.id === selected?.id ? 'true' : undefined}
          onClick={() => pick(hw.id)}
          className={cn(rowClass, 'hidden lg:flex', hw.id === selected?.id && 'bg-primary/10 hover:bg-primary/10')}
        >
          {inner}
        </button>
        <Link href={`/homeworks/${hw.id}`} className={cn(rowClass, 'lg:hidden')}>
          {inner}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold leading-tight tracking-tight text-foreground">Homework</h1>
          <p className="text-xs text-muted-foreground">
            {summary.overdue > 0 && <span className="font-medium text-destructive">{summary.overdue} overdue · </span>}
            {summary.today} due today · {summary.week} in the next 7 days
          </p>
        </div>
        <div role="group" aria-label="Which homework" className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
          {([['todo', 'To do', open.length], ['done', 'Done', done.length]] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => switchTab(value)}
              className={cn(
                'min-h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label} <span className="tabular-nums text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {chips.length > 0 && (
            <Select
              value={activeSubject ?? ALL}
              onValueChange={(value) => router.push(value === ALL ? '/homeworks' : `/homeworks?subject=${encodeURIComponent(value)}`)}
            >
              <SelectTrigger aria-label="Filter by subject" className="h-9 w-48 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All subjects</SelectItem>
                {activeSubject && !chips.some((c) => c.name === activeSubject) && <SelectItem value={activeSubject}>{activeSubject}</SelectItem>}
                {chips.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AddHomeworkButton subjects={subjects} defaultSubject={activeSubject} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-border/60 lg:border-r">
          {visible.length === 0 ? (
            <div className="p-4">
              {tab === 'done' ? (
                <EmptyState icon={<CheckCircle2 />} title="Nothing finished yet" description="Finished homework, with its proof, is kept here." />
              ) : homeworks.length === 0 ? (
                <EmptyState
                  icon={<BookOpen />}
                  title={activeSubject ? `No homework for ${activeSubject}` : 'No homework yet'}
                  description="Add an assignment when you get one. It goes on your schedule and shows here by when it is due."
                />
              ) : (
                <EmptyState icon={<PartyPopper />} title="All caught up" description="Nothing is waiting to be done. Finished work is under Done." />
              )}
            </div>
          ) : tab === 'done' ? (
            <ul className="divide-y divide-border/60">{done.map(row)}</ul>
          ) : (
            GROUP_ORDER.filter((g) => groups.has(g.key)).map((g) => {
              const items = groups.get(g.key)!;
              return (
                <section key={g.key} aria-labelledby={`hw-group-${g.key}`}>
                  <h2
                    id={`hw-group-${g.key}`}
                    className={cn(
                      'sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background px-4 py-1.5 text-xs font-semibold',
                      g.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {g.label}
                    <span className="font-normal tabular-nums">{items.length}</span>
                  </h2>
                  <ul className="divide-y divide-border/60">{items.map(row)}</ul>
                </section>
              );
            })
          )}
        </div>

        <div className="@container hidden min-h-0 overflow-y-auto lg:block">
          {selected ? (
            <div className="space-y-5 p-5 xl:p-6">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1 basis-72 space-y-1.5">
                  <h2 className="break-words font-heading text-2xl font-bold leading-tight tracking-tight text-foreground">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">{selected.subject} · Due {formatDay(selected.dueDay, today)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {selected.isCompleted ? (
                      <Pill tone="success"><CheckCircle2 /> Finished</Pill>
                    ) : selected.block && selected.plannedDay ? (
                      <Pill>
                        <CalendarClock /> On your schedule {selected.plannedDay === today ? 'today' : formatDay(selected.plannedDay, today)}, {selected.block.startTime}–{selected.block.endTime}
                      </Pill>
                    ) : (
                      <Pill tone="warning"><CalendarClock /> Not on your schedule yet</Pill>
                    )}
                  </div>
                </div>
                {!archived && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!selected.isCompleted && (
                      <>
                        <Button variant="outline" onClick={() => setPlanning(selected)}>
                          <CalendarClock /> {selected.block ? 'Move on schedule' : 'Put on schedule'}
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={`/focus?subject=${encodeURIComponent(selected.subject)}`}>
                            <Timer /> Focus
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete "${selected.title}"`}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleting(selected)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>

              <HomeworkWorkspace
                key={selected.id}
                subjects={subjects.map((s) => s.name)}
                onDirtyChange={setUnsaved}
                homework={{
                  id: selected.id,
                  title: selected.title,
                  subject: selected.subject,
                  dueDay: selected.dueDay,
                  description: selected.description ?? '',
                  answer: selected.answer ?? '',
                  briefFileUrl: selected.briefFileUrl ?? null,
                  answerFileUrl: selected.answerFileUrl ?? null,
                  proofUrl: selected.proofUrl,
                  isCompleted: selected.isCompleted,
                  completedLabel: selected.completedDay ? formatDay(selected.completedDay, today) : null,
                }}
              />
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">Pick a homework to open it here.</p>
          )}
        </div>
      </div>

      <PlanDialog homework={planning} onClose={() => setPlanning(null)} />
      <DeleteDialog homework={deleting} onClose={() => setDeleting(null)} />
      <Dialog open={leavingFor !== null} onOpenChange={(next) => !next && setLeavingFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>You have changes in this homework that are not saved yet.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeavingFor(null)}>Stay here</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedId(leavingFor);
                setUnsaved(false);
                setLeavingFor(null);
              }}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanDialog({ homework, onClose }: { homework: HomeworkItem | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [clash, setClash] = useState<{ info: ClashInfo; input: { dateKey: string; startTime: string; endTime: string } } | null>(null);

  async function save(input: { dateKey: string; startTime: string; endTime: string }, onClash?: ClashResolution) {
    if (!homework) return;
    setPending(true);
    try {
      const result = await planHomework(homework.id, input, onClash);
      setClash(null);
      if ('clash' in result && result.clash) {
        setClash({ info: result.clash, input });
      } else if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success('On your schedule');
        onClose();
      }
    } catch {
      toast.error('That could not be saved. Try again.');
    } finally {
      setPending(false);
    }
  }

  function handlePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void save({ dateKey: String(form.get('doDay')), startTime: String(form.get('startTime')), endTime: String(form.get('endTime')) });
  }

  return (
    <Dialog open={homework !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Plan when to do it</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{homework?.title}</span> goes on your schedule at this time.
          </DialogDescription>
        </DialogHeader>
        {homework && (
          <form key={homework.id} onSubmit={handlePlan} className="space-y-4">
            <HomeworkSlotFields idPrefix="hw-plan" defaultDay={homework.plannedDay} defaultStart={homework.block?.startTime} defaultEnd={homework.block?.endTime} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className="h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="h-10 gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />} Save
              </Button>
            </div>
          </form>
        )}
        <ClashDialog
          clash={clash?.info ?? null}
          subject={homework?.subject ?? ''}
          busy={pending}
          onChoose={(resolution) => clash && void save(clash.input, resolution)}
          onCancel={() => setClash(null)}
        />
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
