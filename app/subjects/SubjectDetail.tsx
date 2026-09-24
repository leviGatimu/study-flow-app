"use client";

import Link from "next/link";
import { Brain, Edit3, MoreHorizontal, Timer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageBody } from "@/components/ui/page";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExamsPanel, HomeworkPanel, MarksPanel, ResourcesPanel, SyllabusPanel } from "./SubjectPanels";
import { SubjectBuddy } from "./SubjectBuddy";
import {
  countdown,
  isOverdue,
  pendingHomework,
  upcomingExams,
  type ExamEvent,
  type GradePoint,
  type Homework,
  type MasteryItem,
  type Resource,
  type Subject,
  type SubjectGoal,
} from "./subject-model";

/**
 * One subject's page: everything filed under it, with the two things to do
 * next - practise it, or sit down and focus - as the header's actions.
 */
export function SubjectDetail({
  subject,
  homeworks,
  exams,
  resources,
  mastery,
  goal,
  chartData,
  note,
  subjectOptions,
  archived,
  onBack,
  onRename,
  onDelete,
  onSetGoal,
}: {
  subject: Subject;
  homeworks: Homework[];
  exams: ExamEvent[];
  resources: Resource[];
  mastery: MasteryItem[];
  goal: SubjectGoal | null;
  chartData: GradePoint[];
  note: string;
  subjectOptions: { id: string; name: string }[];
  archived: boolean;
  onBack: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSetGoal: () => void;
}) {
  const pending = pendingHomework(homeworks);
  const overdue = pending.filter(isOverdue).length;
  const nextExam = upcomingExams(exams)[0] ?? null;


  return (
    <>
      <PageHeader
        back={{ onClick: onBack, label: "All subjects" }}
        title={subject.name}
        description="Its homework, exams, files, marks and syllabus in one place."
        meta={nextExam ? `${nextExam.title} ${countdown(nextExam.date).toLowerCase()}` : undefined}
        highlight={{
          label: "Homework open",
          value: (
            <>
              {pending.length}
              {overdue > 0 && <span className="text-destructive font-bold text-lg"> · {overdue} overdue</span>}
            </>
          ),
        }}
        actions={
          <>
            <Button asChild size="lg">
              <Link href={`/ai?subject=${encodeURIComponent(subject.name)}`}>
                <Brain />
                Practice
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/focus?subject=${encodeURIComponent(subject.name)}`}>
                <Timer />
                Focus
              </Link>
            </Button>
            {!archived && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-lg" aria-label={`Options for ${subject.name}`}>
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
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <HomeworkPanel subject={subject.name} homeworks={homeworks} subjectOptions={subjectOptions} />
            <ExamsPanel subject={subject.name} exams={exams} />
            <ResourcesPanel subject={subject.name} resources={resources} />
            <SubjectBuddy
              key={subject.id}
              subject={subject.name}
              mastery={mastery}
              homeworks={homeworks}
              exams={exams}
              note={note}
            />
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-4">
            <MarksPanel chartData={chartData} goal={goal} archived={archived} onSetGoal={onSetGoal} />
            <SyllabusPanel subject={subject.name} items={mastery} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
