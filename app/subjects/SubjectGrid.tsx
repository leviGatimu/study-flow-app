"use client";

import { useMemo, useState } from "react";
import { BookOpen, BookOpenText, Edit3, FolderOpen, MoreHorizontal, Plus, Search, Target, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageBody } from "@/components/ui/page";
import { subjectStyle } from "@/components/subjects/SubjectIcon";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, isSubjectSimilar } from "@/lib/utils";
import {
  countdown,
  daysFromToday,
  isOverdue,
  pendingHomework,
  plural,
  shortDate,
  upcomingExams,
  type ExamEvent,
  type Homework,
  type ReportCard,
  type Resource,
  type Subject,
  type SubjectGoal,
} from "./subject-model";

/**
 * The section landing: every subject with what is live in it right now - the
 * next homework, the next exam, how many files, the target and the latest
 * mark. Opening one shows its page (?subject=).
 */
export function SubjectGrid({
  subjects,
  homeworks,
  exams,
  resources,
  goals,
  reportCards,
  archived,
  repairing,
  onOpen,
  onAdd,
  onRepair,
  onRename,
  onDelete,
}: {
  subjects: Subject[];
  homeworks: Homework[];
  exams: ExamEvent[];
  resources: Resource[];
  goals: SubjectGoal[];
  reportCards: ReportCard[];
  archived: boolean;
  repairing: boolean;
  onOpen: (name: string) => void;
  onAdd: () => void;
  onRepair: () => void;
  onRename: (subject: Subject) => void;
  onDelete: (subject: Subject) => void;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? subjects.filter((s) => s.name.toLowerCase().includes(q)) : subjects;
  }, [subjects, query]);

  const pending = pendingHomework(homeworks);
  const overdue = pending.filter(isOverdue).length;
  const nextExam = upcomingExams(exams)[0] ?? null;

  return (
    <>
      <div data-tour="subjects-hero">
        <PageHeader
          title="Subjects"
          description="Each subject holds its homework, exams, files, marks and syllabus. Open one to work on it."
          meta={nextExam ? `Next exam ${countdown(nextExam.date).toLowerCase()}` : undefined}
          highlight={
            subjects.length > 0
              ? {
                  label: "Homework open",
                  value: (
                    <>
                      {pending.length}
                      {overdue > 0 && <span className="text-destructive font-bold text-lg"> · {overdue} overdue</span>}
                    </>
                  ),
                }
              : undefined
          }
          actions={
            !archived && (
              <>
                {/* Tidying up used to happen invisibly on every page that listed
                    subjects. It is a deliberate action now, and only here. */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onRepair}
                  disabled={repairing}
                  title="Remove '(revision)' entries and merge duplicate subjects"
                >
                  <Wand2 />
                  {repairing ? "Tidying..." : "Tidy up"}
                </Button>
                <Button size="lg" onClick={onAdd}>
                  <Plus />
                  Add subject
                </Button>
              </>
            )
          }
        />
      </div>

      <PageBody>
        {subjects.length === 0 ? (
          <EmptyState
            icon={<BookOpenText />}
            title="No subjects yet"
            description="Add the courses you take. Each one gets a page for its homework, exams, files and marks."
            action={!archived && <Button onClick={onAdd}><Plus />Add a subject</Button>}
          />
        ) : (
          <div className="space-y-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search subjects"
                placeholder="Search subjects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title={`No subject matches "${query}"`}
                description="Check the spelling, or add it as a new subject."
                action={
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                {shown.map((s) => (
                  <SubjectCard
                    key={s.id}
                    subject={s}
                    homeworks={homeworks.filter((h) => isSubjectSimilar(h.subject, s.name))}
                    exams={exams.filter((e) => isSubjectSimilar(e.subject?.name ?? e.title, s.name))}
                    fileCount={resources.filter((r) => isSubjectSimilar(r.subject, s.name)).length}
                    goal={goals.find((g) => isSubjectSimilar(g.subject, s.name)) ?? null}
                    latestGrade={latestGrade(reportCards, s.name)}
                    archived={archived}
                    onOpen={() => onOpen(s.name)}
                    onRename={() => onRename(s)}
                    onDelete={() => onDelete(s)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}

function latestGrade(reportCards: ReportCard[], subject: string): string | null {
  for (let i = reportCards.length - 1; i >= 0; i--) {
    const g = reportCards[i].grades.find((x) => isSubjectSimilar(x.subject, subject));
    if (g) return g.grade;
  }
  return null;
}

function SubjectCard({
  subject,
  homeworks,
  exams,
  fileCount,
  goal,
  latestGrade,
  archived,
  onOpen,
  onRename,
  onDelete,
}: {
  subject: Subject;
  homeworks: Homework[];
  exams: ExamEvent[];
  fileCount: number;
  goal: SubjectGoal | null;
  latestGrade: string | null;
  archived: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { Icon, classes } = subjectStyle(subject.name);
  const pending = pendingHomework(homeworks);
  const nextHomework = pending[0] ?? null;
  const nextExam = upcomingExams(exams)[0] ?? null;
  const late = nextHomework ? isOverdue(nextHomework) : false;
  const examDays = nextExam ? daysFromToday(nextExam.date) : null;

  // The one thing on the tile's corner: what most needs attention.
  const flag = late
    ? { text: "Overdue", className: "bg-destructive text-white" }
    : examDays !== null && examDays <= 7
      ? { text: `Exam ${countdown(nextExam!.date).toLowerCase()}`, className: examDays <= 3 ? "bg-destructive text-white" : "bg-amber-500 text-white" }
      : null;

  return (
    <li className="relative">
      <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        {/* The whole card opens the subject; the menu sits above this layer. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${subject.name}`}
          className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />

        <div className={cn("relative grid aspect-[16/10] place-items-center overflow-hidden", classes.tile, classes.ink)}>
          {/* Soft shapes behind the icon, so each tile reads as a little picture. */}
          <span aria-hidden className="absolute -top-6 -left-6 size-24 rounded-full bg-white/30 dark:bg-white/5" />
          <span aria-hidden className="absolute -right-4 -bottom-8 size-28 rounded-full bg-white/25 dark:bg-white/5" />
          <Icon aria-hidden strokeWidth={1.5} className="relative size-14 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none sm:size-16" />

          {flag && (
            <span className={cn("absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm", flag.className)}>
              {flag.text}
            </span>
          )}
          {!archived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Options for ${subject.name}`}
                  className="absolute top-1.5 right-1.5 z-10 bg-white/50 text-current hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onRename}>
                  <Edit3 /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive [&_svg]:text-destructive">
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 font-heading text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary sm:text-lg">
            {subject.name}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {nextHomework ? (
              <>
                <span className={cn(late && "font-medium text-destructive")}>{nextHomework.title}</span>
                {!late && <> · due {shortDate(nextHomework.dueDate)}</>}
              </>
            ) : nextExam ? (
              <>{nextExam.title} · {countdown(nextExam.date).toLowerCase()}</>
            ) : homeworks.length > 0 ? (
              "All homework done"
            ) : (
              "Nothing due"
            )}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-xs font-medium">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", classes.soft)}>
              <BookOpen className="size-3" /> {pending.length} open
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              <FolderOpen className="size-3" /> {plural(fileCount, "file")}
            </span>
            {(goal || latestGrade) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <Target className="size-3" />
                {latestGrade ?? "–"}
                {goal && ` / ${goal.targetGrade}%`}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
