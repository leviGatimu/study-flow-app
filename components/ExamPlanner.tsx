'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarClock, CheckCircle2, Circle, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

  const [pickedSubject, setPickedSubject] = useState(subjectId ?? '');
  const [sessions, setSessions] = useState(6);
  const [daysBefore, setDaysBefore] = useState(14);
  const [startTime, setStartTime] = useState('19:00');
  const [scoreInput, setScoreInput] = useState(score?.toString() ?? '');
  const [maxInput, setMaxInput] = useState(maxScore?.toString() ?? '100');

  const done = revisionTasks.filter((t) => t.isDone).length;
  const total = revisionTasks.length;

  const run = (fn: () => Promise<any>, ok: (r: any) => string) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(ok(res));
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {/* 1. What does this exam actually assess? */}
      {!subjectId && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 space-y-3">
          <div>
            <p className="font-heading font-bold text-foreground">
              This exam is not linked to a subject
            </p>
            <p className="text-sm text-muted-foreground">
              Link it so preparation stats, mastery topics and revision planning
              know what they are about.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={pickedSubject} onValueChange={setPickedSubject}>
              <SelectTrigger className="w-64">
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
              disabled={isPending || !pickedSubject}
              onClick={() =>
                run(() => setExamSubject(examId, pickedSubject), () => 'Subject linked.')
              }
            >
              Link
            </Button>
          </div>
        </div>
      )}

      {/* 2. Plan the revision backwards from the date. */}
      {!isPast && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" />
                Revision plan
              </h3>
              <p className="text-sm text-muted-foreground">
                {total > 0
                  ? `${done} of ${total} blocks done`
                  : `Schedule sessions leading up to ${subjectName ?? 'this exam'}.`}
              </p>
            </div>
            {total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="gap-1.5 text-muted-foreground"
                onClick={() =>
                  run(() => clearRevisionPlan(examId), (r) => `${r.removed} blocks removed.`)
                }
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>

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
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0 text-muted-foreground/50" />
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
            className="gap-2"
            onClick={() =>
              run(
                () => planRevision(examId, { sessions, daysBefore, startTime }),
                (r) => `${r.created} revision blocks scheduled.`
              )
            }
          >
            <Wand2 className="w-4 h-4" />
            {total > 0 ? 'Re-plan revision' : 'Plan revision'}
          </Button>
        </div>
      )}

      {/* 3. How did it go? */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div>
          <h3 className="font-heading font-bold text-lg">Result</h3>
          <p className="text-sm text-muted-foreground">
            {score !== null && maxScore
              ? `You scored ${score} out of ${maxScore} (${Math.round((score / maxScore) * 100)}%).`
              : 'Record your mark once you have it. It feeds Marks and Insights.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
