"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Flag, Pause, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleState } from "@/lib/term";
import {
  completeActiveClass,
  endActiveTerm,
  extendActiveTerm,
  resumeSchedule,
  startNewClass,
  startNextTerm,
} from "@/lib/term-actions";

/**
 * Surfaces the one thing the user needs to decide about their term right now,
 * and nothing when there is nothing to decide.
 *
 * Every transition here is explicit. Term dates only ever produce a prompt -
 * the app never ends or starts a term on its own, because doing so could stop
 * the schedule on a day the user was not expecting.
 */
export function TermStatusBanner({ state }: { state: ScheduleState | null }) {
  const [isPending, startTransition] = useTransition();
  const [newYearLabel, setNewYearLabel] = useState("");

  if (!state) return null;

  // Running normally with nothing due: say nothing.
  if (state.isRunning && !state.termEndDue) return null;

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else toast.success(ok);
    });

  if (state.reason === "PAUSED") {
    return (
      <Banner
        tone="amber"
        icon={<Pause className="size-5" />}
        title="Schedule paused"
        body="No tasks are being generated and your streak is frozen at its current value. Nothing is lost while you are away."
        action={
          <Button
            onClick={() => run(resumeSchedule, "Schedule resumed.")}
            disabled={isPending}
            className="gap-2"
          >
            <Play className="size-4" />
            {isPending ? "Resuming..." : "Resume"}
          </Button>
        }
      />
    );
  }

  if (state.reason === "BETWEEN_TERMS") {
    const next = state.nextTerm;
    return (
      <Banner
        tone="amber"
        icon={<CalendarCheck className="size-5" />}
        title={next ? `${next.name} is ready to start` : "Between terms"}
        body={
          state.nextTermStartDue
            ? `${next?.name} was due to start. Your timetable is waiting exactly as you left it.`
            : "Your last term is finished. Your timetable is kept, so starting the next term picks up where you left off."
        }
        action={
          <Button
            onClick={() => run(() => startNextTerm(), "Term started.")}
            disabled={isPending}
            className="gap-2"
          >
            <Play className="size-4" />
            {isPending ? "Starting..." : next ? `Start ${next.name}` : "Start next term"}
          </Button>
        }
      />
    );
  }

  if (state.reason === "CLASS_COMPLETE" || state.reason === "NO_CLASS") {
    return (
      <Banner
        tone="primary"
        icon={<Sparkles className="size-5" />}
        title={state.reason === "NO_CLASS" ? "Set up your year" : "That year is complete"}
        body="A new year starts blank: no timetable, no subjects. Your XP and level carry over; the streak starts fresh."
        action={
          <div className="flex gap-2">
            <Input
              value={newYearLabel}
              onChange={(e) => setNewYearLabel(e.target.value)}
              placeholder="Year 2"
              className="h-9 w-32"
            />
            <Button
              onClick={() =>
                run(() => startNewClass(newYearLabel || "Year 2"), "New year started.")
              }
              disabled={isPending}
            >
              {isPending ? "Starting..." : "Start"}
            </Button>
          </div>
        }
      />
    );
  }

  // Running, but the end date has arrived. Prompt - never act automatically.
  return (
    <Banner
      tone="amber"
      icon={<Flag className="size-5" />}
      title={`${state.termName ?? "This term"} has reached its end date`}
      body="Tasks keep generating until you end it, so nothing stops unexpectedly. End it now, or push the date back."
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => run(endActiveTerm, "Term ended.")}
            disabled={isPending}
          >
            End term now
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              run(() => extendActiveTerm(addDays(new Date(), 14)), "Extended by two weeks.")
            }
            disabled={isPending}
          >
            Extend 2 weeks
          </Button>
        </div>
      }
    />
  );
}

function Banner({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: "amber" | "primary";
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-600",
    primary: "border-primary/30 bg-primary/5 text-primary",
  }[tone];

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${tones}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="space-y-0.5">
          <p className="font-heading text-base font-semibold text-foreground">{title}</p>
          <p className="max-w-2xl text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** Pause / resume, for somewhere always visible rather than only on a banner. */
export function PauseScheduleButton({ state }: { state: ScheduleState | null }) {
  const [isPending, startTransition] = useTransition();
  if (!state || (!state.isRunning && state.reason !== "PAUSED")) return null;

  const paused = state.reason === "PAUSED";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const { pauseSchedule } = await import("@/lib/term-actions");
          const res = paused ? await resumeSchedule() : await pauseSchedule();
          if (res?.error) toast.error(res.error);
          else toast.success(paused ? "Schedule resumed." : "Schedule paused.");
        })
      }
      className="gap-1.5 rounded-xl font-bold shrink-0"
    >
      {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
      {isPending ? "..." : paused ? "Resume" : "Pause"}
    </Button>
  );
}
