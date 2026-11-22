"use client";

import { useState } from "react";

import { PageBody } from "@/components/ui/page";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AiLogo } from "@/components/ai/AiLogo";
import { FilesPanel, MarksPanel, SubjectStats, SyllabusPanel, UpNextPanel } from "./SubjectPanels";
import { SubjectHero } from "./SubjectHero";
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
      <SubjectHero
        subject={subject}
        homeworks={homeworks}
        exams={exams}
        fileCount={resources.length}
        chartData={chartData}
        goal={goal}
        archived={archived}
        onBack={onBack}
        onAsk={() => setAskOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
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
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
            <AiLogo size={36} />
            <div className="min-w-0">
              <DialogTitle className="font-heading text-lg font-semibold">Ask about {subject.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Answers use this subject&apos;s topics, homework and exams.
              </DialogDescription>
            </div>
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
