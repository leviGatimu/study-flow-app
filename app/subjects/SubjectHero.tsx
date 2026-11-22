"use client";

import Link from "next/link";
import { ArrowLeft, Brain, Edit3, MessageCircle, MoreHorizontal, Timer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionNav } from "@/components/SectionNav";
import { subjectStyle } from "@/components/subjects/SubjectIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { averageGrade } from "./SubjectPanels";
import {
  countdown,
  isOverdue,
  pendingHomework,
  plural,
  upcomingExams,
  type ExamEvent,
  type GradePoint,
  type Homework,
  type Subject,
  type SubjectGoal,
} from "./subject-model";

/**
 * A subject page's banner: the subject's own colour and icon, a one-line
 * summary of what is live, the average-vs-target ring, and the ways to start
 * working on it (Focus, Practice, Ask).
 */
export function SubjectHero({
  subject,
  homeworks,
  exams,
  fileCount,
  chartData,
  goal,
  archived,
  onBack,
  onAsk,
  onRename,
  onDelete,
}: {
  subject: Subject;
  homeworks: Homework[];
  exams: ExamEvent[];
  fileCount: number;
  chartData: GradePoint[];
  goal: SubjectGoal | null;
  archived: boolean;
  onBack: () => void;
  onAsk: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { Icon, classes } = subjectStyle(subject.name);
  const pending = pendingHomework(homeworks);
  const overdue = pending.filter(isOverdue).length;
  const nextExam = upcomingExams(exams)[0] ?? null;

  const summary = [
    pending.length ? `${pending.length} homework open${overdue ? ` (${overdue} overdue)` : ""}` : "No homework open",
    nextExam ? `${nextExam.title} ${countdown(nextExam.date).toLowerCase()}` : null,
    plural(fileCount, "file"),
  ].filter(Boolean);

  const lightButton =
    "border-0 bg-white/70 text-slate-900 hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/20";

  return (
    <section className="px-4 pt-6 md:px-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary/80 transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" /> All subjects
      </button>

      <div className={cn("relative overflow-hidden rounded-3xl p-6 md:p-8", classes.tile)}>
        {/* A big faded copy of the icon and a soft circle, for depth. */}
        <Icon
          aria-hidden
          strokeWidth={1.25}
          className={cn("pointer-events-none absolute -right-8 -bottom-10 size-56 rotate-12 opacity-15 md:size-72", classes.ink)}
        />
        <span aria-hidden className="pointer-events-none absolute -top-16 left-1/3 size-48 rounded-full bg-white/25 dark:bg-white/5" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 md:gap-5">
            <span
              className={cn(
                "grid size-16 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-sm md:size-20 dark:bg-white/10",
                classes.ink,
              )}
            >
              <Icon aria-hidden strokeWidth={1.5} className="size-9 md:size-11" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-3xl font-black tracking-tight break-words text-foreground md:text-5xl">
                {subject.name}
              </h1>
              <p className={cn("mt-2 text-sm font-medium md:text-base", classes.ink)}>{summary.join(" · ")}</p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="lg"
                  className="border-0 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                >
                  <Link href={`/focus?subject=${encodeURIComponent(subject.name)}`}>
                    <Timer />
                    Focus
                  </Link>
                </Button>
                <Button asChild size="lg" className={lightButton}>
                  <Link href={`/ai/practices?subject=${encodeURIComponent(subject.name)}`}>
                    <Brain />
                    Practice
                  </Link>
                </Button>
                <Button size="lg" className={lightButton} onClick={onAsk}>
                  <MessageCircle />
                  Ask
                </Button>
                {!archived && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-lg" className={lightButton} aria-label={`Options for ${subject.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={onRename}>
                        <Edit3 /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={onDelete}
                        className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>

          <MarkRing average={averageGrade(chartData)} target={goal?.targetGrade ?? null} ringClass={classes.ring} />
        </div>
      </div>
      <SectionNav />
    </section>
  );
}

/** Average mark as a ring, with a small tick where the target sits. */
function MarkRing({ average, target, ringClass }: { average: number | null; target: number | null; ringClass: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const value = average === null ? 0 : Math.max(0, Math.min(100, average));
  const targetAngle = target === null ? null : (Math.max(0, Math.min(100, target)) / 100) * 360;

  return (
    <div className="flex shrink-0 items-center gap-4 self-start rounded-2xl bg-white/60 p-4 pr-6 shadow-sm lg:self-center dark:bg-black/20">
      <div className="relative size-24">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-black/10 dark:stroke-white/10" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className={cn(ringClass, "transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none")}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
          />
          {targetAngle !== null && (
            <line
              x1="50"
              y1={50 - r - 7}
              x2="50"
              y2={50 - r + 7}
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-slate-900 dark:stroke-white"
              // The svg is turned -90deg, so rotating by the target's share of 360 lands it in place.
              transform={`rotate(${targetAngle + 90} 50 50)`}
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center font-heading text-xl font-black text-foreground">
          {average === null ? "–" : `${average}%`}
        </span>
      </div>
      <div className="text-sm">
        <p className="font-semibold text-foreground">Average mark</p>
        <p className="text-muted-foreground">
          {average === null
            ? "No marks yet"
            : target === null
              ? "No target set"
              : average >= target
                ? `On target (${target}%)`
                : `Target ${target}%`}
        </p>
      </div>
    </div>
  );
}
