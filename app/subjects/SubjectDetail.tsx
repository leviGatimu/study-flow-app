"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, Edit3, MessageCircle, MoreHorizontal, Timer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageBody } from "@/components/ui/page";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilesPanel, MarksPanel, SubjectStats, SyllabusPanel, UpNextPanel } from "./SubjectPanels";
import { SubjectBuddy, buddyGreeting, type BuddyMessage } from "./SubjectBuddy";
import type {
  ExamEvent,
  GradePoint,
  Homework,
  MasteryItem,
  Resource,
  Subject,
  SubjectGoal,
} from "./subject-model";

/**
 * One subject's page: four numbers that sum it up, what is due next, its
 * files, and on the side its marks and syllabus. The chat about the subject
 * opens in a drawer. Mount with a key per subject so the chat starts fresh.
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
  const [askOpen, setAskOpen] = useState(false);
  const [chat, setChat] = useState<BuddyMessage[]>(() => buddyGreeting(subject.name));

  return (
    <>
      <PageHeader
        back={{ onClick: onBack, label: "All subjects" }}
        title={subject.name}
        description="What is due, your files, marks and syllabus for this subject."
        actions={
          <>
            <Button asChild size="lg">
              <Link href={`/focus?subject=${encodeURIComponent(subject.name)}`}>
                <Timer />
                Focus
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/ai/practices?subject=${encodeURIComponent(subject.name)}`}>
                <Brain />
                Practice
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => setAskOpen(true)}>
              <MessageCircle />
              Ask
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
                  <DropdownMenuItem
                    onSelect={onDelete}
                    className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <PageBody>
        <SubjectStats homeworks={homeworks} exams={exams} chartData={chartData} goal={goal} mastery={mastery} />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <UpNextPanel
              subject={subject.name}
              homeworks={homeworks}
              exams={exams}
              subjectOptions={subjectOptions}
              archived={archived}
            />
            <FilesPanel subject={subject.name} resources={resources} />
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-4">
            <MarksPanel chartData={chartData} goal={goal} archived={archived} onSetGoal={onSetGoal} />
            <SyllabusPanel subject={subject.name} items={mastery} />
          </div>
        </div>
      </PageBody>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent
          className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-md sm:rounded-l-2xl data-open:zoom-in-100 data-open:slide-in-from-right-8 data-closed:zoom-out-100 data-closed:slide-out-to-right-8"
        >
          <div className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="font-heading text-lg font-semibold">Ask about {subject.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Answers use this subject&apos;s topics, homework and exams.
            </DialogDescription>
          </div>
          <div className="min-h-0 flex-1">
            <SubjectBuddy
              subject={subject.name}
              mastery={mastery}
              homeworks={homeworks}
              exams={exams}
              note={note}
              messages={chat}
              setMessages={setChat}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
