"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Archive, Check, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { exitArchive, openArchivedYear } from "@/app/archive-actions";
import { useArchive } from "@/components/ArchiveContext";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleState } from "@/lib/term";
import { PeriodSummaryView } from "@/components/PeriodSummary";
import type { PeriodSummary } from "@/lib/summary";
import {
  addUpcomingTerm,
  completeActiveClass,
  endActiveTerm,
  getClassArchive,
  getClassSummary,
  getTermSummary,
  pauseSchedule,
  renameActiveClass,
  resumeSchedule,
  startNewClass,
  startNextTerm,
  updateTerm,
} from "@/lib/term-actions";

type TermRow = {
  id: string;
  name: string;
  index: number;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
};

type ClassRow = {
  id: string;
  label: string;
  status: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  pausedAt: Date | string | null;
  longestStreak: number;
  terms: TermRow[];
};

type Archive = Awaited<ReturnType<typeof getClassArchive>>;

const day = (d: Date | string | null) => (d ? format(new Date(d), "d MMM yyyy") : null);
const forInput = (d: Date | string | null) => (d ? format(new Date(d), "yyyy-MM-dd") : "");
const fromInput = (v: string) => (v ? new Date(`${v}T00:00:00`) : null);

export function YearClient({
  classes,
  schedule,
}: {
  classes: ClassRow[];
  schedule: ScheduleState | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const archive = useArchive();

  const active = classes.find((c) => c.status === "ACTIVE") ?? null;
  const archived = classes.filter((c) => c.status !== "ACTIVE");

  const run = (fn: () => Promise<{ error?: string } | void>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) toast.error(res.error);
      else {
        toast.success(ok);
        router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 animate-in fade-in duration-500">
      <PageHeader
        title="Year & Terms"
        description="Your academic year, the terms inside it, and everything you have finished. Term dates only ever prompt you — nothing starts or ends on its own."
      />

      <div className="space-y-8">
        {/* data-tour: the guided tour stops here to explain years and terms. */}
        <div data-tour="year-active">
        {active ? (
          <ActiveYear
            cls={active}
            schedule={schedule}
            isPending={isPending}
            run={run}
            readOnly={archive !== null}
          />
        ) : (
          <NewYear isPending={isPending} run={run} readOnly={archive !== null} />
        )}
        </div>

        <Section
          title="Finished years"
          description="Open one to load the whole app with that year's work in it. Read-only — a finished year is a record, not a workspace."
        >
          {archived.length === 0 ? (
            <EmptyState
              icon={<Archive />}
              title="Nothing archived yet"
              description="When you finish this year it moves here, and everything in it stays readable."
            />
          ) : (
            <div className="space-y-3">
              {archived.map((c) => (
                <ArchivedYear key={c.id} cls={c} isOpen={archive?.classId === c.id} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function ActiveYear({
  cls,
  schedule,
  isPending,
  run,
  readOnly,
}: {
  cls: ClassRow;
  schedule: ScheduleState | null;
  isPending: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
  /**
   * True while a finished year is open. Every control here writes to the
   * ACTIVE year, which is not the year you are looking at - so acting on them
   * from inside an archive would be a change you did not mean to make.
   */
  readOnly: boolean;
}) {
  const [label, setLabel] = useState(cls.label);
  const [adding, setAdding] = useState(false);
  const paused = cls.pausedAt !== null;
  const activeTerm = cls.terms.find((t) => t.status === "ACTIVE");

  const statusText = paused
    ? "Paused"
    : activeTerm
      ? `${activeTerm.name} running`
      : "Between terms";

  return (
    <Section title="This year">
      <Panel className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="year-label" className="text-xs text-muted-foreground">
              Year name
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="year-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={readOnly}
                className="h-9 w-44"
              />
              {!readOnly && label.trim() !== cls.label && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => renameActiveClass(label), "Year renamed.")}
                >
                  Save
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                paused
                  ? "bg-amber-500/10 text-amber-600"
                  : activeTerm
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {statusText}
            </span>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className="gap-1.5"
                onClick={() =>
                  paused
                    ? run(resumeSchedule, "Schedule resumed.")
                    : run(pauseSchedule, "Schedule paused.")
                }
              >
                {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                {paused ? "Resume" : "Pause"}
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {paused
            ? "No tasks are being generated and your streak is frozen. Nothing is lost while you are away."
            : activeTerm
              ? "Tasks generate from your weekly timetable and your streak is counting."
              : "No term is running, so nothing is being generated. Start the next term when you are ready."}
        </p>
      </Panel>

      <div className="space-y-2 pt-2">
        {cls.terms.map((term) => (
          <TermRowView
            key={term.id}
            term={term}
            isPending={isPending}
            run={run}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {!activeTerm && (
            <Button
              disabled={isPending}
              className="gap-1.5"
              onClick={() => run(() => startNextTerm(), "Term started.")}
            >
              <Play className="size-4" /> Start next term
            </Button>
          )}
          {!adding ? (
            <Button variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add a term
            </Button>
          ) : (
            <AddTermForm
              isPending={isPending}
              run={run}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
      )}

      {!readOnly && (
        <Panel className="mt-4 space-y-3 border-dashed">
          <div>
            <p className="font-heading text-sm font-medium text-foreground">
              Finish {cls.label}
            </p>
            <p className="text-sm text-muted-foreground">
              Archives this year read-only and lets you open a new one. Your XP and
              level carry over; the streak starts fresh. Nothing is deleted.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(completeActiveClass, "Year archived.")}
          >
            Finish this year
          </Button>
        </Panel>
      )}
    </Section>
  );
}

function TermRowView({
  term,
  isPending,
  run,
  readOnly,
}: {
  term: TermRow;
  isPending: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(term.name);
  const [start, setStart] = useState(forInput(term.startDate));
  const [end, setEnd] = useState(forInput(term.endDate));

  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [loadingSummary, startLoadingSummary] = useTransition();

  const toggleSummary = () => {
    if (showSummary) return setShowSummary(false);
    setShowSummary(true);
    if (!summary) {
      startLoadingSummary(async () => setSummary(await getTermSummary(term.id)));
    }
  };

  const tone = {
    ACTIVE: "bg-success/10 text-success",
    UPCOMING: "bg-muted text-muted-foreground",
    COMPLETED: "bg-muted text-muted-foreground",
  }[term.status] ?? "bg-muted text-muted-foreground";

  if (editing) {
    return (
      <Panel className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Starts</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ends</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          An end date only produces a reminder on the day. Tasks keep generating
          until you actually end the term.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending}
            className="gap-1.5"
            onClick={() => {
              run(
                () =>
                  updateTerm(term.id, {
                    name,
                    startDate: fromInput(start),
                    endDate: fromInput(end),
                  }),
                "Term updated."
              );
              setEditing(false);
            }}
          >
            <Check className="size-3.5" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-3 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{term.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
              {term.status.toLowerCase()}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {day(term.startDate) ?? "no start date"} &middot;{" "}
            {day(term.endDate) ?? "no end date"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* A running term can be summarised too - it just computes live
              instead of reading the snapshot taken when it ended. */}
          <Button size="sm" variant="ghost" onClick={toggleSummary}>
            {showSummary ? "Hide" : "Report"}
          </Button>
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {!readOnly && term.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(endActiveTerm, "Term ended.")}
            >
              End term
            </Button>
          )}
        </div>
      </div>

      {showSummary && (
        <div className="border-t border-border pt-4">
          {summary ? (
            <PeriodSummaryView summary={summary} title={term.name} />
          ) : loadingSummary ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No study blocks in this term yet, so there is nothing to report.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function AddTermForm({
  isPending,
  run,
  onClose,
}: {
  isPending: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <Panel className="w-full space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Term 4" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Starts</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ends</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => {
            run(
              () =>
                addUpcomingTerm({
                  name,
                  startDate: fromInput(start),
                  endDate: fromInput(end),
                }),
              "Term added."
            );
            onClose();
          }}
        >
          Add term
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="gap-1.5">
          <X className="size-3.5" /> Cancel
        </Button>
      </div>
    </Panel>
  );
}

function NewYear({
  isPending,
  run,
  readOnly,
}: {
  isPending: boolean;
  run: (fn: () => Promise<any>, ok: string) => void;
  readOnly: boolean;
}) {
  const [label, setLabel] = useState("");

  return (
    <Section title="Start a year">
      <Panel className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Close the archive you are viewing before starting a new year, so the new year is not created from inside an old one."
            : "A new year starts blank — no timetable, no subjects. Call it whatever your school calls it: Year 2, S6, Level 300."}
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Year 2"
              className="h-9 w-44"
            />
            <Button
              disabled={isPending || !label.trim()}
              onClick={() => run(() => startNewClass(label), "Year started.")}
            >
              Start
            </Button>
          </div>
        )}
      </Panel>
    </Section>
  );
}

function ArchivedYear({ cls, isOpen }: { cls: ClassRow; isOpen: boolean }) {
  const [data, setData] = useState<Archive>(null);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (!data) {
      startTransition(async () => {
        const [archive, report] = await Promise.all([
          getClassArchive(cls.id),
          getClassSummary(cls.id),
        ]);
        setData(archive);
        setSummary(report);
      });
    }
  };

  const hours = data ? Math.round((data.totals.minutes / 60) * 10) / 10 : 0;

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-heading text-sm font-medium text-foreground">{cls.label}</p>
            {isOpen && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                Open now
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {day(cls.startedAt)} &ndash; {day(cls.completedAt) ?? "present"} &middot;{" "}
            {cls.terms.length} {cls.terms.length === 1 ? "term" : "terms"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggle}>
            {open ? "Hide report" : "Report"}
          </Button>
          {/* A form post rather than a transition: the cookie changes what
              EVERY page reads, so the whole app has to re-render against the
              other year. Both actions redirect to the dashboard. */}
          {isOpen ? (
            <form action={exitArchive}>
              <Button type="submit" variant="outline" size="sm">
                Close {cls.label}
              </Button>
            </form>
          ) : (
            <form action={openArchivedYear}>
              <input type="hidden" name="classId" value={cls.id} />
              <Button type="submit" size="sm">
                Open {cls.label}
              </Button>
            </form>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border pt-4">
          {isPending && !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data ? (
            <>
              {summary && (
                <div className="border-b border-border pb-5">
                  <PeriodSummaryView summary={summary} title={`${cls.label} report`} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact label="Tasks completed" value={`${data.totals.tasksDone} / ${data.totals.tasks}`} />
                <Fact label="Time studied" value={`${hours}h`} />
                <Fact label="Best streak" value={`${data.longestStreak} days`} />
                <Fact label="Exams" value={data.totals.exams} />
              </div>

              {data.topSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Most studied</p>
                  {data.topSubjects.map((s) => (
                    <div key={s.subject} className="flex justify-between text-sm">
                      <span className="truncate text-foreground">{s.subject}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {Math.round((s.minutes / 60) * 10) / 10}h
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Terms</p>
                {data.terms.map((t) => (
                  <p key={t.id} className="text-sm text-foreground">
                    {t.name}
                    <span className="text-muted-foreground">
                      {" "}
                      &middot; {day(t.startDate) ?? "—"} to {day(t.endDate) ?? "—"}
                    </span>
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this year.</p>
          )}
        </div>
      )}
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
