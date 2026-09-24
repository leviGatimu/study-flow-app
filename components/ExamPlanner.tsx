'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarClock, CheckCircle2, Circle, Link2, Loader2, Trash2, Trophy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useIsArchived } from '@/components/ArchiveContext';
import { Button } from '@/components/ui/button';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clearRevisionPlan,
  planRevision,
  recordExamResult,
  setExamSubject,
} from '@/lib/exam-actions';

type RevisionTask = {
  id: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  isDone: boolean;
};

/**
 * Everything you can actually DO about an exam: say what it assesses, plan the
 * revision for it, and record how it went.
 *
 * The old exam page was a countdown - it told you an exam was coming and left
 * you there.
 */
export function ExamPlanner({
  examId,
  subjectId,
  subjectName,
  subjects,
  revisionTasks,
  score,
  maxScore,
  isPast,
}: {
  examId: string;
  subjectId: string | null;
  subjectName: string | null;
  subjects: { id: string; name: string }[];
  revisionTasks: RevisionTask[];
  score: number | null;
  maxScore: number | null;
  isPast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const archived = useIsArchived();

  const [pickedSubject, setPickedSubject] = useState(subjectId ?? '');
  const [sessions, setSessions] = useState(6);
  const [daysBefore, setDaysBefore] = useState(14);
  const [startTime, setStartTime] = useState('19:00');
  const [scoreInput, setScoreInput] = useState(score?.toString() ?? '');
  const [maxInput, setMaxInput] = useState(maxScore?.toString() ?? '100');

  const done = revisionTasks.filter((t) => t.isDone).length;
  const total = revisionTasks.length;

  const run = <T extends { error?: string }>(fn: () => Promise<T>, ok: (r: T) => string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(ok(res));
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {/* 1. What does this exam actually assess? */}
      {!subjectId && !archived && (
        <Panel className="border-orange-500/30">
          <PanelTitle icon={<Link2 />}>Link a subject</PanelTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            This exam is not linked to a subject yet. Link it so preparation
            stats, syllabus topics, practice and revision planning know what it
            is about.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={pickedSubject} onValueChange={setPickedSubject}>
              <SelectTrigger aria-label="Subject this exam assesses" className="h-9 w-full sm:w-64">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="lg"
              disabled={isPending || !pickedSubject}
              onClick={() =>
                run(() => setExamSubject(examId, pickedSubject), () => 'Subject linked.')
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              Link subject
            </Button>
          </div>
          {subjects.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              You have no subjects yet.{' '}
              <Link href="/subjects" className="font-medium text-primary hover:underline">Add one in Subjects</Link>.
            </p>
          )}
        </Panel>
      )}

      {/* 2. Plan the revision backwards from the date. Never offered in a
          finished year - there is nothing left to revise for. */}
      {!isPast && !archived && (
        <Panel className="space-y-4">
          <PanelTitle
            icon={<CalendarClock />}
            className="mb-0"
            action={
              total > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  className="text-muted-foreground"
                  onClick={() =>
                    run(() => clearRevisionPlan(examId), (r) => `${r.removed} blocks removed.`)
                  }
                >
                  <Trash2 /> Clear
                </Button>
              )
            }
          >
            Revision plan
          </PanelTitle>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${done} of ${total} blocks done. They are on your timetable.`
              : `Schedule sessions leading up to the exam${subjectName ? ` for ${subjectName}` : ''}.`}
          </p>

          {total > 0 && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {revisionTasks.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 text-sm">
                    {t.isDone ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        t.isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                      )}
                    >
                      {format(new Date(t.date), 'EEE d MMM')}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {t.startTime}–{t.endTime}
                    </span>
                  </div>
                ))}
                {revisionTasks.length > 8 && (
                  <p className="text-xs text-muted-foreground">
                    +{revisionTasks.length - 8} more
                  </p>
                )}
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="revision-sessions" className="text-xs text-muted-foreground">Sessions</Label>
              <Input
                id="revision-sessions"
                type="number"
                min={1}
                max={20}
                value={sessions}
                onChange={(e) => setSessions(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision-days-before" className="text-xs text-muted-foreground">Days before</Label>
              <Input
                id="revision-days-before"
                type="number"
                min={1}
                max={60}
                value={daysBefore}
                onChange={(e) => setDaysBefore(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision-start-time" className="text-xs text-muted-foreground">Start at</Label>
              <Input
                id="revision-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Sessions are weighted towards the exam, and skip times you are already
            busy. Blocks you have already completed are kept.
          </p>

          <Button
            disabled={isPending}
            onClick={() =>
              run(
                () => planRevision(examId, { sessions, daysBefore, startTime }),
                (r) => `${r.created} revision blocks scheduled.`
              )
            }
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {total > 0 ? 'Re-plan revision' : 'Plan revision'}
          </Button>
        </Panel>
      )}

      {/* 3. How did it go? */}
      <Panel className="space-y-4">
        <div>
          <PanelTitle icon={<Trophy />} className="mb-1">Result</PanelTitle>
          <p className="text-sm text-muted-foreground">
            {score !== null && maxScore
              ? `You scored ${score} out of ${maxScore} (${Math.round((score / maxScore) * 100)}%).`
              : archived
                ? 'No mark was recorded for this exam.'
                : 'Record your mark once you have it. It feeds Marks and Insights.'}
          </p>
        </div>
        <div className={cn("flex flex-wrap items-end gap-3", archived && "hidden")}>
          <div className="space-y-1.5">
            <Label htmlFor="exam-score" className="text-xs text-muted-foreground">Score</Label>
            <Input
              id="exam-score"
              type="number"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder="—"
              className="h-9 w-24"
            />
          </div>
          <span className="pb-2 text-muted-foreground">/</span>
          <div className="space-y-1.5">
            <Label htmlFor="exam-max-score" className="text-xs text-muted-foreground">Out of</Label>
            <Input
              id="exam-max-score"
              type="number"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              className="h-9 w-24"
            />
          </div>
          <Button
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  recordExamResult(
                    examId,
                    scoreInput === '' ? null : Number(scoreInput),
                    maxInput === '' ? null : Number(maxInput)
                  ),
                () => 'Result saved.'
              )
            }
          >
            Save result
          </Button>
        </div>
      </Panel>
    </div>
  );
}
