"use client";

import { useMemo, useState } from "react";
import { BookOpen, BookOpenText, CalendarClock, Edit3, FolderOpen, MoreHorizontal, Plus, Search, Target, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageBody } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isSubjectSimilar } from "@/lib/utils";
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
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
  const pending = pendingHomework(homeworks);
  const nextHomework = pending[0] ?? null;
  const nextExam = upcomingExams(exams)[0] ?? null;
  const late = nextHomework ? isOverdue(nextHomework) : false;
  const examDays = nextExam ? daysFromToday(nextExam.date) : null;

  return (
    <li className="relative">
      <Panel interactive className="group flex h-full flex-col gap-4">
        {/* The whole card opens the subject; the menu sits above this layer. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${subject.name}`}
          className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 font-heading text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {subject.name}
          </h3>
          {!archived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Options for ${subject.name}`}
                  className="relative z-10 -mr-1.5 -mt-1 shrink-0 text-muted-foreground"
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

        <dl className="space-y-3 text-sm">
          <Fact icon={<BookOpen />} label="Homework">
            {nextHomework ? (
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-foreground">{nextHomework.title}</span>
                <Pill tone={late ? "danger" : "default"}>
                  {late ? "Overdue" : shortDate(nextHomework.dueDate)}
                </Pill>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {homeworks.length > 0 ? "All done" : "None yet"}
              </span>
            )}
          </Fact>
          <Fact icon={<CalendarClock />} label="Next exam">
            {nextExam && examDays !== null ? (
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-foreground">{nextExam.title}</span>
                <Pill tone={examDays <= 3 ? "danger" : examDays <= 7 ? "warning" : "default"}>
                  {countdown(nextExam.date)}
                </Pill>
              </span>
            ) : (
              <span className="text-muted-foreground">None scheduled</span>
            )}
          </Fact>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-4 text-xs font-medium text-muted-foreground">
          {pending.length > 0 && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" /> {pending.length} open
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <FolderOpen className="size-3.5" /> {plural(fileCount, "file")}
          </span>
          <span className="flex items-center gap-1.5">
            <Target className="size-3.5" />
            {goal ? `Target ${goal.targetGrade}%` : "No target"}
            {latestGrade && ` · latest ${latestGrade}`}
          </span>
        </div>
      </Panel>
    </li>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <dt className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" title={label}>
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
