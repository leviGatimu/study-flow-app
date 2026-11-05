"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  ListChecks,
  Plus,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { AddMasteryForm } from "@/components/AddMasteryForm";
import { MasteryList } from "@/components/MasteryList";
import { KindIcon } from "@/components/resources/file-kind";
import { AddHomeworkButton } from "@/app/homeworks/CreateHomeworkForm";
import { cn } from "@/lib/utils";
import { GradeChart } from "./GradeChart";
import {
  countdown,
  daysFromToday,
  isOverdue,
  pendingHomework,
  plural,
  points,
  resourceHref,
  shortDate,
  upcomingExams,
  type ExamEvent,
  type GradePoint,
  type Homework,
  type MasteryItem,
  type Resource,
  type SubjectGoal,
} from "./subject-model";

/** How many items "Up next" lists before the links to the full pages take over. */
const UP_NEXT_LIMIT = 6;
/** How many of the newest files the Files panel shows. */
const FILES_LIMIT = 6;

type Tone = "default" | "success" | "warning" | "danger";

/** Mean of a subject's report-card grades, or null with none. */
export function averageGrade(chartData: GradePoint[]): number | null {
  if (chartData.length === 0) return null;
  return Math.round(chartData.reduce((sum, d) => sum + d.grade, 0) / chartData.length);
}

/**
 * The four numbers that sum a subject up, one tile each: what is open, when
 * the next exam is, how marks compare with the target, and how much of the
 * syllabus is done.
 */
export function SubjectStats({
  homeworks,
  exams,
  chartData,
  goal,
  mastery,
}: {
  homeworks: Homework[];
  exams: ExamEvent[];
  chartData: GradePoint[];
  goal: SubjectGoal | null;
  mastery: MasteryItem[];
}) {
  const pending = pendingHomework(homeworks);
  const overdue = pending.filter(isOverdue).length;
  const nextExam = upcomingExams(exams)[0] ?? null;
  const examDays = nextExam ? daysFromToday(nextExam.date) : null;
  const average = averageGrade(chartData);
  const onTarget = goal && average !== null ? average >= goal.targetGrade : null;
  const mastered = mastery.filter((m) => m.isCompleted).length;

  const tiles: { label: string; icon: React.ReactNode; value: React.ReactNode; tone: Tone; hint: string }[] = [
    {
      label: "Homework open",
      icon: <BookOpen />,
      value: pending.length,
      tone: overdue > 0 ? "danger" : "default",
      hint: overdue > 0 ? `${overdue} overdue` : pending.length ? "None overdue" : "All caught up",
    },
    {
      label: "Next exam",
      icon: <CalendarClock />,
      value: examDays === null ? "None" : examDays === 0 ? "Today" : examDays === 1 ? "Tomorrow" : `${examDays} days`,
      tone: examDays === null ? "default" : examDays <= 3 ? "danger" : examDays <= 7 ? "warning" : "default",
      hint: nextExam ? nextExam.title : "Nothing scheduled",
    },
    {
      label: "Average mark",
      icon: <TrendingUp />,
      value: average !== null ? `${average}%` : "None",
      tone: onTarget === null ? "default" : onTarget ? "success" : "warning",
      hint: goal ? `Target ${goal.targetGrade}%` : average !== null ? "No target set" : "No marks yet",
    },
    {
      label: "Syllabus",
      icon: <ListChecks />,
      value: mastery.length ? `${mastered}/${mastery.length}` : "None",
      tone: mastery.length > 0 && mastered === mastery.length ? "success" : "default",
      hint: mastery.length ? `${Math.round((mastered / mastery.length) * 100)}% mastered` : "No topics yet",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <Panel key={t.label} className="p-5">
          <Stat
            label={t.label}
            icon={t.icon}
            value={t.value}
            tone={t.tone}
            hint={<span className="block truncate">{t.hint}</span>}
          />
        </Panel>
      ))}
    </div>
  );
}

type UpNextItem =
  | { kind: "homework"; id: string; title: string; date: Date; detail: string | null; overdue: boolean }
  | { kind: "exam"; id: string; title: string; date: Date };

/** When an item is due, as a pill: overdue and near dates stand out. */
function DuePill({ item }: { item: UpNextItem }) {
  const days = daysFromToday(item.date);
  if (item.kind === "homework") {
    if (item.overdue) return <Pill tone="danger">Overdue</Pill>;
    if (days === 0) return <Pill tone="warning">Due today</Pill>;
    if (days === 1) return <Pill tone="warning">Due tomorrow</Pill>;
    return <Pill>{shortDate(item.date)}</Pill>;
  }
  return <Pill tone={days <= 3 ? "danger" : days <= 7 ? "warning" : "default"}>{countdown(item.date)}</Pill>;
}

/**
 * Open homework and coming exams in one list, by date, so the page answers
 * "what is next for this subject" without reading two panels.
 */
export function UpNextPanel({
  subject,
  homeworks,
  exams,
  subjectOptions,
  archived,
}: {
  subject: string;
  homeworks: Homework[];
  exams: ExamEvent[];
  subjectOptions: { id: string; name: string }[];
  archived: boolean;
}) {
  const homeworkHref = `/homeworks?subject=${encodeURIComponent(subject)}`;
  const examsHref = `/exams?subject=${encodeURIComponent(subject)}`;
  const pending = pendingHomework(homeworks);
  const done = homeworks.length - pending.length;

  const items: UpNextItem[] = [
    ...pending.map((h) => ({
      kind: "homework" as const,
      id: h.id,
      title: h.title,
      date: new Date(h.dueDate),
      detail: h.description,
      overdue: isOverdue(h),
    })),
    ...upcomingExams(exams).map((e) => ({ kind: "exam" as const, id: e.id, title: e.title, date: new Date(e.date) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const shown = items.slice(0, UP_NEXT_LIMIT);
  const hidden = items.length - shown.length;

  return (
    <Panel>
      <PanelTitle
        icon={<ListChecks />}
        action={
          !archived && (
            <>
              <AddHomeworkButton subjects={subjectOptions} defaultSubject={subject} variant="outline" label="Homework" />
              <Button asChild variant="outline" className="h-9 gap-1.5 px-3.5">
                <Link href="/exams">
                  <Plus className="size-4" /> Exam
                </Link>
              </Button>
            </>
          )
        }
      >
        Up next
      </PanelTitle>

      {items.length === 0 ? (
        <EmptyState
          icon={homeworks.length ? <CheckCircle2 /> : <ListChecks />}
          title={homeworks.length ? "All caught up" : `Nothing due for ${subject}`}
          description={
            homeworks.length
              ? "All homework is done and no exam is coming up. Add the next one when you get it."
              : "Homework and exams you add for this subject show here, soonest first."
          }
        />
      ) : (
        <ol className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
          {shown.map((item) => {
            const isHomework = item.kind === "homework";
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={isHomework ? homeworkHref : `/exams/${item.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4",
                      isHomework ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    )}
                  >
                    {isHomework ? <BookOpen /> : <CalendarClock />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {isHomework ? "Homework" : "Exam"} · {shortDate(item.date)}
                      {isHomework && item.detail ? ` · ${item.detail}` : ""}
                    </span>
                  </span>
                  <DuePill item={item} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {hidden > 0 && <span className="text-muted-foreground">{hidden} more not shown.</span>}
        <Link href={homeworkHref} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          All homework{homeworks.length ? ` (${done} of ${homeworks.length} done)` : ""}
          <ChevronRight className="size-3.5" />
        </Link>
        <Link href={examsHref} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          All exams <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Panel>
  );
}

/** The newest files and links filed under the subject, as tiles. */
export function FilesPanel({ subject, resources }: { subject: string; resources: Resource[] }) {
  const href = `/resources/${encodeURIComponent(subject)}`;

  return (
    <Panel>
      <PanelTitle
        icon={<FolderOpen />}
        action={
          <>
            {resources.length > 0 && <Pill>{plural(resources.length, "item")}</Pill>}
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href={href}>Open folder</Link>
            </Button>
          </>
        }
      >
        Files
      </PanelTitle>

      {resources.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title={`No files for ${subject} yet`}
          description="Keep notes, past papers and links in the subject's folder so they are here when you revise."
          action={
            <Button asChild variant="outline">
              <Link href={href}>
                <Plus />
                Add files
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* Newest first: the server orders by createdAt desc. */}
          {resources.slice(0, FILES_LIMIT).map((r) => (
            <Link
              key={r.id}
              href={resourceHref({ subject, folder: r.folder })}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-background px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <KindIcon item={{ type: r.type === "LINK" ? "LINK" : "FILE", ext: r.ext }} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold group-hover:text-primary">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.folder ? r.folder.replace(/\//g, " › ") : `Added ${shortDate(r.createdAt)}`}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function MarksPanel({
  chartData,
  goal,
  archived,
  onSetGoal,
}: {
  chartData: GradePoint[];
  goal: SubjectGoal | null;
  archived: boolean;
  onSetGoal: () => void;
}) {
  const average = averageGrade(chartData);
  const onTarget = goal && average !== null ? average >= goal.targetGrade : null;

  return (
    <Panel>
      <PanelTitle
        icon={<TrendingUp />}
        action={
          !archived && (
            <Button size="sm" variant="outline" onClick={onSetGoal}>
              {goal ? "Change target" : "Set target"}
            </Button>
          )
        }
      >
        Marks
      </PanelTitle>

      {chartData.length > 0 ? (
        <div className="space-y-4">
          {goal && average !== null && (
            <div className="space-y-2">
              {/* 0-100 scale: the fill is the average, the tick is the target. */}
              <div
                role="img"
                aria-label={`Average ${average}% against a target of ${goal.targetGrade}%`}
                className="relative h-2 w-full rounded-full bg-muted"
              >
                <div
                  className={cn("h-full rounded-full transition-all duration-500", onTarget ? "bg-success" : "bg-primary")}
                  style={{ width: `${Math.min(100, Math.max(0, average))}%` }}
                />
                <div
                  aria-hidden
                  className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                  style={{ left: `${Math.min(100, Math.max(0, goal.targetGrade))}%` }}
                />
              </div>
              {onTarget ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4 shrink-0" />
                  On target, {points(average - goal.targetGrade)} points above.
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="size-4 shrink-0 text-orange-500" />
                  {points(goal.targetGrade - average)} points below your target.
                </p>
              )}
            </div>
          )}
          <GradeChart data={chartData} />
        </div>
      ) : (
        <EmptyState
          title="No marks yet"
          description="Add a report card on Marks and this subject's grades will chart here."
          action={
            <Button asChild variant="outline">
              <Link href="/marks">Go to Marks</Link>
            </Button>
          }
        />
      )}
    </Panel>
  );
}

export function SyllabusPanel({ subject, items }: { subject: string; items: MasteryItem[] }) {
  const mastered = items.filter((m) => m.isCompleted).length;
  const percent = items.length ? Math.round((mastered / items.length) * 100) : 0;
  return (
    <Panel>
      <PanelTitle
        icon={<ListChecks />}
        action={
          items.length > 0 && (
            <Pill tone={mastered === items.length ? "success" : "default"}>
              {mastered}/{items.length} mastered
            </Pill>
          )
        }
      >
        Syllabus
      </PanelTitle>
      <div className="space-y-4">
        {items.length > 0 && (
          <div
            role="progressbar"
            aria-label="Syllabus mastered"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full transition-all duration-500", percent === 100 ? "bg-success" : "bg-primary")}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        <AddMasteryForm subject={subject} />
        <MasteryList items={items} subject={subject} />
      </div>
    </Panel>
  );
}
