"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, FolderOpen, ListChecks, Plus, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { ListRow, Pill } from "@/components/ui/list-row";
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

/** How many rows a panel lists before "View all" takes over. */
const PREVIEW = 5;

/** The right-hand side of a panel heading: a count and where to see everything. */
function TitleAction({ count, href, label = "View all" }: { count?: string; href: string; label?: string }) {
  return (
    <>
      {count && <Pill>{count}</Pill>}
      <Button asChild variant="ghost" size="sm" className="text-primary">
        <Link href={href}>{label}</Link>
      </Button>
    </>
  );
}

export function HomeworkPanel({
  subject,
  homeworks,
  subjectOptions,
}: {
  subject: string;
  homeworks: Homework[];
  subjectOptions: { id: string; name: string }[];
}) {
  const pending = pendingHomework(homeworks);
  const done = homeworks.length - pending.length;
  const href = `/homeworks?subject=${encodeURIComponent(subject)}`;

  return (
    <Panel>
      <PanelTitle
        icon={<BookOpen />}
        action={<TitleAction count={homeworks.length ? `${done}/${homeworks.length} done` : undefined} href={href} />}
      >
        Homework
      </PanelTitle>

      {pending.length === 0 ? (
        <EmptyState
          icon={homeworks.length ? <CheckCircle2 /> : <BookOpen />}
          title={homeworks.length ? "All caught up" : `No homework for ${subject} yet`}
          description={
            homeworks.length
              ? "Everything set for this subject is done. Add the next assignment when you get it."
              : "Add an assignment when you get one and it will show here, soonest first."
          }
          action={<AddHomeworkButton subjects={subjectOptions} defaultSubject={subject} variant="outline" />}
        />
      ) : (
        <div className="space-y-3">
          {pending.slice(0, PREVIEW).map((hw) => {
            const late = isOverdue(hw);
            const days = daysFromToday(hw.dueDate);
            return (
              <ListRow
                key={hw.id}
                href={href}
                title={hw.title}
                subtitle={hw.description ?? undefined}
                trailing={
                  <Pill tone={late ? "danger" : days <= 1 ? "warning" : "default"}>
                    {late ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : shortDate(hw.dueDate)}
                  </Pill>
                }
              />
            );
          })}
          {pending.length > PREVIEW && (
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {pending.length - PREVIEW} more open.{" "}
              <Link href={href} className="text-primary hover:underline">See them all</Link>
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

export function ExamsPanel({ subject, exams }: { subject: string; exams: ExamEvent[] }) {
  const upcoming = upcomingExams(exams);
  const href = `/exams?subject=${encodeURIComponent(subject)}`;

  return (
    <Panel>
      <PanelTitle
        icon={<CalendarClock />}
        action={<TitleAction count={upcoming.length ? `${upcoming.length} coming` : undefined} href={href} />}
      >
        Exams
      </PanelTitle>

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title={`No ${subject} exams coming up`}
          description="Add the exam date when it is announced, then plan revision sessions back from it."
          action={
            <Button asChild variant="outline">
              <Link href="/exams"><Plus />Add an exam</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {upcoming.slice(0, PREVIEW).map((exam) => {
            const days = daysFromToday(exam.date);
            return (
              <ListRow
                key={exam.id}
                href={`/exams/${exam.id}`}
                title={exam.title}
                subtitle={shortDate(exam.date)}
                trailing={
                  <Pill tone={days <= 3 ? "danger" : days <= 7 ? "warning" : "default"}>{countdown(exam.date)}</Pill>
                }
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function ResourcesPanel({ subject, resources }: { subject: string; resources: Resource[] }) {
  const href = `/resources/${encodeURIComponent(subject)}`;

  return (
    <Panel>
      <PanelTitle
        icon={<FolderOpen />}
        action={
          <TitleAction
            count={resources.length ? `${resources.length} ${resources.length === 1 ? "item" : "items"}` : undefined}
            href={href}
            label="Open folder"
          />
        }
      >
        Resources
      </PanelTitle>

      {resources.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title={`No files for ${subject} yet`}
          description="Keep notes, past papers and links in the subject's folder so they are here when you revise."
          action={
            <Button asChild variant="outline">
              <Link href={href}><Plus />Add files</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Newest first: the server orders by createdAt desc. */}
          {resources.slice(0, PREVIEW + 1).map((r) => (
            <ListRow
              key={r.id}
              href={resourceHref({ subject, folder: r.folder })}
              leading={<KindIcon item={{ type: r.type === "LINK" ? "LINK" : "FILE", ext: r.ext }} size="sm" />}
              title={r.title}
              subtitle={[r.folder.replace(/\//g, " › "), `Added ${shortDate(r.createdAt)}`].filter(Boolean).join(" · ")}
            />
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
  const average =
    chartData.length > 0 ? Math.round(chartData.reduce((sum, d) => sum + d.grade, 0) / chartData.length) : null;
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

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Average"
            value={average !== null ? `${average}%` : "None"}
            tone={onTarget === null ? "default" : onTarget ? "success" : "primary"}
          />
          <Stat label="Target" value={goal ? `${goal.targetGrade}%` : "Not set"} />
        </div>

        {goal && average !== null && (
          <div className="space-y-2.5">
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

        {chartData.length > 0 ? (
          <GradeChart data={chartData} />
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
      </div>
    </Panel>
  );
}

export function SyllabusPanel({ subject, items }: { subject: string; items: MasteryItem[] }) {
  const mastered = items.filter((m) => m.isCompleted).length;
  return (
    <Panel>
      <PanelTitle
        icon={<ListChecks />}
        action={items.length > 0 && <Pill tone={mastered === items.length ? "success" : "default"}>{mastered}/{items.length} mastered</Pill>}
      >
        Syllabus
      </PanelTitle>
      <div className="space-y-3">
        <AddMasteryForm subject={subject} />
        <MasteryList items={items} subject={subject} />
      </div>
    </Panel>
  );
}
