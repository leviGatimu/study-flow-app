"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { Archive, Check, Flag, GraduationCap, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { exitArchive, openArchivedYear } from "@/app/archive-actions";
import { useArchive } from "@/components/ArchiveContext";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeriodSummaryView } from "@/components/PeriodSummary";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";
import { subscribeOnMount } from "@/lib/use-client-value";
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

/** Runs a term action; `next` optionally offers the obvious follow-up in the toast. */
type Run = (
  fn: () => Promise<{ error?: string } | void>,
  ok: string,
  next?: { label: string; href: string }
) => void;

const day = (d: Date | string | null) => (d ? format(new Date(d), "d MMM yyyy") : null);
const forInput = (d: Date | string | null) => (d ? format(new Date(d), "yyyy-MM-dd") : "");
const fromInput = (v: string) => (v ? new Date(`${v}T00:00:00`) : null);
const hoursOf = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** "11 weeks" / "5 days" between two dates, or null when either is missing. */
function lengthOf(start: Date | string | null, end: Date | string | null) {
  if (!start || !end) return null;
  const days = differenceInCalendarDays(new Date(end), new Date(start)) + 1;
  if (days <= 0) return null;
  return days >= 14 ? `${Math.round(days / 7)} weeks` : `${days} ${days === 1 ? "day" : "days"}`;
}

// Today's date as a stable number for a store snapshot: the server has no
// "today" of the student's, so progress appears once the page is in the browser.
const todaySnapshot = () => Math.floor(Date.now() / 86_400_000);

/** How far through a dated term today is, or null when it cannot be said. */
function useTermProgress(term: TermRow | undefined) {
  const today = useSyncExternalStore(subscribeOnMount, todaySnapshot, () => null);
  if (today === null || !term?.startDate || !term.endDate) return null;
  const start = new Date(term.startDate);
  const total = differenceInCalendarDays(new Date(term.endDate), start) + 1;
  if (total <= 0) return null;
  const elapsed = Math.min(Math.max(differenceInCalendarDays(new Date(today * 86_400_000), start) + 1, 0), total);
  return { total, elapsed, left: total - elapsed, ratio: elapsed / total };
}

export function YearClient({ classes }: { classes: ClassRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingTerm, setAddingTerm] = useState(false);

  const archive = useArchive();
  const readOnly = archive !== null;

  const active = classes.find((c) => c.status === "ACTIVE") ?? null;
  const archived = classes.filter((c) => c.status !== "ACTIVE");
  const activeTerm = active?.terms.find((t) => t.status === "ACTIVE") ?? null;

  const run: Run = (fn, ok, next) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          ok,
          next ? { action: { label: next.label, onClick: () => router.push(next.href) } } : undefined
        );
        router.refresh();
      } catch (error) {
        console.error("[year] action failed", error);
        toast.error("That did not save. Check your connection and try again.");
      }
    });

  // The one thing to do next: start a term when none is running, otherwise
  // plan the next one. Nothing here while an archive is open - every control
  // on this page writes to the ACTIVE year, not the one being viewed.
  const actions =
    active && !readOnly ? (
      !activeTerm ? (
        <>
          <Button
            size="lg"
            disabled={isPending}
            className="gap-1.5"
            onClick={() => run(() => startNextTerm(), "Term started.", { label: "Open Today", href: "/" })}
          >
            <Play className="size-4" /> Start next term
          </Button>
          <Button size="lg" variant="outline" className="gap-1.5" onClick={() => setAddingTerm(true)}>
            <Plus className="size-4" /> Add a term
          </Button>
        </>
      ) : (
        <Button size="lg" className="gap-1.5" onClick={() => setAddingTerm(true)}>
          <Plus className="size-4" /> Add a term
        </Button>
      )
    ) : null;

  return (
    <Page>
      <PageHeader
        title="Year & terms"
        description="Your academic year, the terms inside it, and every year you have finished. Term dates only remind you; nothing starts or ends on its own."
        highlight={
          active
            ? {
                label: "Currently in",
                value: (
                  <>
                    {active.label}
                    <span className="text-muted-foreground font-bold text-lg">
                      {activeTerm ? ` · ${activeTerm.name}` : active.pausedAt ? " · paused" : " · between terms"}
                    </span>
                  </>
                ),
              }
            : undefined
        }
        actions={actions}
      />

      <PageBody>
        {/* data-tour: the guided tour stops here to explain years and terms. */}
        <div data-tour="year-active">
          {active ? (
            <ActiveYear
              cls={active}
              isPending={isPending}
              run={run}
              readOnly={readOnly}
              addingTerm={addingTerm && !readOnly}
              onCloseAddTerm={() => setAddingTerm(false)}
            />
          ) : (
            <NewYear isPending={isPending} run={run} readOnly={readOnly} />
          )}
        </div>

        <Section
          title="Finished years"
          description="Open one to load the whole app with that year's work in it. It is read-only: a finished year is a record, not a workspace."
        >
          {archived.length === 0 ? (
            <EmptyState
              icon={<Archive />}
              title="No finished years yet"
              description="When you finish a year it moves here, and everything in it stays readable."
            />
          ) : (
            <div className="space-y-4">
              {archived.map((c) => (
                <ArchivedYear key={c.id} cls={c} isOpen={archive?.classId === c.id} />
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </Page>
  );
}

function ActiveYear({
  cls,
  isPending,
  run,
  readOnly,
  addingTerm,
  onCloseAddTerm,
}: {
  cls: ClassRow;
  isPending: boolean;
  run: Run;
  /**
   * True while a finished year is open. Every control here writes to the
   * ACTIVE year, which is not the year you are looking at - so acting on them
   * from inside an archive would be a change you did not mean to make.
   */
  readOnly: boolean;
  addingTerm: boolean;
  onCloseAddTerm: () => void;
}) {
  const [label, setLabel] = useState(cls.label);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const paused = cls.pausedAt !== null;
  const activeTerm = cls.terms.find((t) => t.status === "ACTIVE");
  const progress = useTermProgress(activeTerm);
  const finished = cls.terms.filter((t) => t.status === "COMPLETED").length;

  const status = paused ? (
    <Pill tone="warning">Paused</Pill>
  ) : activeTerm ? (
    <Pill tone="success">{activeTerm.name} running</Pill>
  ) : (
    <Pill>Between terms</Pill>
  );

  return (
    <Section title="This year">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Panel padded={false} className="overflow-hidden">
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-heading text-2xl font-bold tracking-tight">{cls.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Started {day(cls.startedAt)} · {cls.terms.length} {cls.terms.length === 1 ? "term" : "terms"}
                      {finished > 0 && `, ${finished} finished`}
                    </p>
                  </div>
                </div>
                {status}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {paused
                  ? "No tasks are being generated and your streak is frozen. Nothing is lost while you are away."
                  : activeTerm
                    ? "Tasks generate from your weekly routine and your streak is counting."
                    : "No term is running, so nothing is being generated. Start the next term when you are ready."}
              </p>

              {activeTerm && progress && (
                <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{activeTerm.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {progress.left === 0 ? "Ends today" : `${progress.left} ${progress.left === 1 ? "day" : "days"} left`}
                    </span>
                  </div>
                  <div
                    className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${activeTerm.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.elapsed}
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress.ratio * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                    <span>{day(activeTerm.startDate)}</span>
                    <span>
                      Day {progress.elapsed} of {progress.total}
                    </span>
                    <span>{day(activeTerm.endDate)}</span>
                  </div>
                </div>
              )}
            </div>

            {!readOnly && (
              <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (label.trim() && label.trim() !== cls.label) {
                      run(() => renameActiveClass(label), "Year renamed.");
                    }
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="year-label" className="text-xs font-medium text-muted-foreground">
                      Year name
                    </Label>
                    <Input id="year-label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 w-44" />
                  </div>
                  {label.trim() !== cls.label && label.trim() !== "" && (
                    <Button type="submit" size="lg" disabled={isPending}>
                      Save
                    </Button>
                  )}
                </form>

                <Button
                  variant="outline"
                  size="lg"
                  disabled={isPending}
                  className="gap-1.5"
                  onClick={() => (paused ? run(resumeSchedule, "Schedule resumed.") : run(pauseSchedule, "Schedule paused."))}
                >
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {paused ? "Resume schedule" : "Pause schedule"}
                </Button>
              </div>
            )}
          </Panel>

          {cls.terms.length === 0 && !addingTerm ? (
            <EmptyState title="No terms in this year yet" description="Add a term so the app knows when your study routine should run." />
          ) : (
            <ol aria-label={`Terms in ${cls.label}`}>
              {cls.terms.map((term, i) => (
                <TermRowView
                  key={term.id}
                  term={term}
                  number={i + 1}
                  last={i === cls.terms.length - 1 && !addingTerm}
                  isPending={isPending}
                  run={run}
                  readOnly={readOnly}
                />
              ))}
            </ol>
          )}

          {addingTerm && <AddTermForm isPending={isPending} run={run} onClose={onCloseAddTerm} />}
        </div>

        {!readOnly && (
          <div className="lg:col-span-4">
            <Panel className="border-dashed">
              <PanelTitle icon={<Archive />}>Finish {cls.label}</PanelTitle>
              <p className="text-sm text-muted-foreground">
                Archives this year read-only and lets you start a new one. Your XP and level carry over; the streak starts
                fresh. Nothing is deleted.
              </p>
              <Button variant="outline" size="lg" disabled={isPending} onClick={() => setConfirmFinish(true)} className="mt-4">
                Finish this year
              </Button>
            </Panel>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title={`Finish ${cls.label}?`}
        description="It becomes a read-only archive and you can start a new year. Nothing is deleted."
        confirmLabel="Finish year"
        pendingLabel="Finishing…"
        isPending={isPending}
        onConfirm={() => {
          setConfirmFinish(false);
          run(completeActiveClass, "Year archived.");
        }}
      />
    </Section>
  );
}

function TermRowView({
  term,
  number,
  last,
  isPending,
  run,
  readOnly,
}: {
  term: TermRow;
  /** Position in the year, shown in the step dot. */
  number: number;
  last: boolean;
  isPending: boolean;
  run: Run;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [loadingSummary, startLoadingSummary] = useTransition();

  const toggleSummary = () => {
    if (showSummary) return setShowSummary(false);
    setShowSummary(true);
    if (!summary) {
      startLoadingSummary(async () => {
        try {
          setSummary(await getTermSummary(term.id));
          setSummaryFailed(false);
        } catch (error) {
          console.error("[year] term summary", error);
          setSummaryFailed(true);
        }
      });
    }
  };

  const running = term.status === "ACTIVE";
  const done = term.status === "COMPLETED";
  const length = lengthOf(term.startDate, term.endDate);

  return (
    <li className={cn("relative pl-14", !last && "pb-4")}>
      {/* The step line and dot: finished terms ticked, the running one filled. */}
      {!last && <span aria-hidden className="absolute bottom-0 left-[19px] top-11 w-px bg-border" />}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-3 flex size-10 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums",
          running
            ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
            : done
              ? "border-success/50 bg-success/10 text-success"
              : "border-dashed border-border bg-background text-muted-foreground"
        )}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : number}
      </span>

      {editing ? (
        <TermForm
          idPrefix={`term-${term.id}`}
          initial={{ name: term.name, start: forInput(term.startDate), end: forInput(term.endDate) }}
          submitLabel="Save"
          isPending={isPending}
          note="An end date only produces a reminder on the day. Tasks keep generating until you actually end the term."
          onCancel={() => setEditing(false)}
          onSubmit={({ name, start, end }) => {
            run(() => updateTerm(term.id, { name, startDate: fromInput(start), endDate: fromInput(end) }), "Term updated.");
            setEditing(false);
          }}
        />
      ) : (
        <Panel className={cn("py-4", running && "border-primary/40 ring-1 ring-primary/15")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg font-bold text-foreground">{term.name}</span>
                <Pill tone={running ? "success" : "default"}>{running ? "Running" : term.status === "UPCOMING" ? "Upcoming" : "Finished"}</Pill>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {day(term.startDate) ?? "No start date"} &ndash; {day(term.endDate) ?? "no end date"}
                {length && <span className="text-muted-foreground/80"> · {length}</span>}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {/* A running term can be summarised too - it just computes live
                  instead of reading the snapshot taken when it ended. */}
              <Button variant="ghost" onClick={toggleSummary} aria-expanded={showSummary}>
                {showSummary ? "Hide report" : "Report"}
              </Button>
              {!readOnly && (
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {!readOnly && running && (
                <Button variant="outline" disabled={isPending} onClick={() => setConfirmEnd(true)} className="gap-1.5">
                  <Flag className="size-4" /> End term
                </Button>
              )}
            </div>
          </div>

          {showSummary && (
            <div className="mt-4 border-t border-border/60 pt-4">
              {summary ? (
                <PeriodSummaryView summary={summary} title={term.name} />
              ) : loadingSummary ? (
                <p className="text-sm text-muted-foreground">Loading the report…</p>
              ) : summaryFailed ? (
                <p className="text-sm text-muted-foreground">The report could not be loaded. Hide it and try again.</p>
              ) : (
                <p className="text-sm text-muted-foreground">No study blocks in this term yet, so there is nothing to report.</p>
              )}
            </div>
          )}
        </Panel>
      )}

      <ConfirmModal
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={`End ${term.name}?`}
        description="Tasks stop generating until you start the next term. Nothing is deleted."
        confirmLabel="End term"
        pendingLabel="Ending…"
        isPending={isPending}
        onConfirm={() => {
          setConfirmEnd(false);
          run(endActiveTerm, "Term ended.");
        }}
      />
    </li>
  );
}

/** Name + start + end, used both to edit a term and to add one. */
function TermForm({
  idPrefix,
  initial,
  submitLabel,
  isPending,
  note,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial: { name: string; start: string; end: string };
  submitLabel: string;
  isPending: boolean;
  note?: string;
  onSubmit: (values: { name: string; start: string; end: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  return (
    <Panel>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, start, end });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-name`} className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Term 4"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-start`} className="text-xs font-medium text-muted-foreground">
              Starts
            </Label>
            <Input
              id={`${idPrefix}-start`}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-end`} className="text-xs font-medium text-muted-foreground">
              Ends
            </Label>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={isPending} className="gap-1.5">
            <Check className="size-4" /> {submitLabel}
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={onCancel} className="gap-1.5">
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function AddTermForm({
  isPending,
  run,
  onClose,
}: {
  isPending: boolean;
  run: Run;
  onClose: () => void;
}) {
  // The add-term form joins the step line as the next, dashed step.
  return (
    <div className="relative pl-14">
      <span
        aria-hidden
        className="absolute left-0 top-3 flex size-10 items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-background text-primary"
      >
        <Plus className="size-4" />
      </span>
      <TermForm
        idPrefix="new-term"
        initial={{ name: "", start: "", end: "" }}
        submitLabel="Add term"
        isPending={isPending}
        onCancel={onClose}
        onSubmit={({ name, start, end }) => {
          run(
            () => addUpcomingTerm({ name, startDate: fromInput(start), endDate: fromInput(end) }),
            "Term added."
          );
          onClose();
        }}
      />
    </div>
  );
}

function NewYear({
  isPending,
  run,
  readOnly,
}: {
  isPending: boolean;
  run: Run;
  readOnly: boolean;
}) {
  const [label, setLabel] = useState("");

  return (
    <Section title="Start a year">
      <Panel>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Close the finished year you are viewing before starting a new one, so the new year is not created from inside an old one."
            : "A new year starts blank: no routine, no subjects. Call it whatever your school calls it, such as Year 2, S6 or Level 300."}
        </p>
        {!readOnly && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (label.trim()) {
                run(() => startNewClass(label), "Year started.", { label: "Add subjects", href: "/subjects" });
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-year-label" className="text-xs font-medium text-muted-foreground">
                Year name
              </Label>
              <Input
                id="new-year-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Year 2"
                className="h-9 w-44"
              />
            </div>
            <Button type="submit" size="lg" disabled={isPending || !label.trim()}>
              {isPending ? "Starting…" : "Start year"}
            </Button>
          </form>
        )}
      </Panel>
    </Section>
  );
}

function ArchivedYear({ cls, isOpen }: { cls: ClassRow; isOpen: boolean }) {
  const [data, setData] = useState<Archive>(null);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (!data) {
      startTransition(async () => {
        try {
          const [archive, report] = await Promise.all([
            getClassArchive(cls.id),
            getClassSummary(cls.id),
          ]);
          setData(archive);
          setSummary(report);
          setFailed(false);
        } catch (error) {
          console.error("[year] archive", error);
          setFailed(true);
        }
      });
    }
  };

  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Archive className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading text-lg font-bold text-foreground">{cls.label}</p>
              {isOpen && <Pill tone="warning">Open now</Pill>}
            </div>
            <p className="text-sm text-muted-foreground">
              {day(cls.startedAt)} &ndash; {day(cls.completedAt) ?? "present"} &middot;{" "}
              {cls.terms.length} {cls.terms.length === 1 ? "term" : "terms"}
              {cls.longestStreak > 0 && ` · best streak ${cls.longestStreak} days`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={toggle} aria-expanded={open}>
            {open ? "Hide report" : "Report"}
          </Button>
          {/* A form post rather than a transition: the cookie changes what
              EVERY page reads, so the whole app has to re-render against the
              other year. Both actions redirect to the dashboard. */}
          {isOpen ? (
            <form action={exitArchive}>
              <Button type="submit" variant="outline">
                Close {cls.label}
              </Button>
            </form>
          ) : (
            <form action={openArchivedYear}>
              <input type="hidden" name="classId" value={cls.id} />
              <Button type="submit" variant="outline">
                Open {cls.label}
              </Button>
            </form>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-5 border-t border-border/60 pt-4">
          {isPending && !data ? (
            <p className="text-sm text-muted-foreground">Loading the report…</p>
          ) : data ? (
            <>
              {summary && (
                <div className="border-b border-border/60 pb-5">
                  <PeriodSummaryView summary={summary} title={`${cls.label} report`} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Tasks completed" value={`${data.totals.tasksDone} / ${data.totals.tasks}`} />
                <Stat label="Time studied" value={`${hoursOf(data.totals.minutes)}h`} />
                <Stat label="Best streak" value={data.longestStreak} hint="days" />
                <Stat label="Exams" value={data.totals.exams} />
              </div>

              {data.topSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Most studied</p>
                  {data.topSubjects.map((s) => (
                    <div key={s.subject} className="flex justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{s.subject}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {hoursOf(s.minutes)}h
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Terms</p>
                {data.terms.map((t) => (
                  <p key={t.id} className="text-sm text-foreground">
                    {t.name}
                    <span className="text-muted-foreground">
                      {" "}
                      &middot; {day(t.startDate) ?? "no start date"} to {day(t.endDate) ?? "no end date"}
                    </span>
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {failed
                ? "This year's report could not be loaded. Hide it and try again."
                : "This year could not be found."}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
