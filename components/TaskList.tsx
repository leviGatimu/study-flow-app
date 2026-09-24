'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileEdit, FileText, Pause, Play, Save, Upload, X, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { TaskCheckbox } from '@/components/TaskCheckbox';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';
import { useIsArchived } from '@/components/ArchiveContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/list-row';
import { updateTaskProof } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/FocusContext';

type TaskType = {
  id: string;
  subject: string;
  isDone: boolean;
  isMissed: boolean;
  type: string;
  startTime: string;
  endTime: string;
  /** An exam in this subject falls within the next seven days. */
  isUrgent?: boolean;
  workDescription?: string | null;
  proofPdfUrl?: string | null;
  template: {
    startTime: string;
    endTime: string;
    deadlineDay: string;
  } | null;
};

function formatDuration(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60; // crosses midnight (e.g. 22:30 - 00:00)
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** "Physics (revision)" -> "Physics": the subject a task belongs to. */
function subjectOf(taskSubject: string): string {
  return taskSubject.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').trim();
}

/**
 * Today's blocks, in time order. Each row answers: what, when, how long, and
 * what can I do about it (tick it off, record proof, start a focus session).
 *
 * The left edge carries the focus mode, per the original brief: HOMEWORK is a
 * solid primary bar, REVISION a dashed orange one. Done and missed override it
 * with their status colour so a finished day reads at a glance.
 */
export function TaskList({ tasks }: { tasks: TaskType[] }) {
  const { activeTask, isPaused, step } = useFocus();
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const archived = useIsArchived();

  const handleOpenEdit = (task: TaskType) => {
    setEditingTask(task);
    setDescription(task.workDescription || '');
    setSelectedFile(null);
  };

  const handleSaveProof = async () => {
    if (!editingTask) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append('taskId', editingTask.id);
    formData.append('description', description);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    const res = await updateTaskProof(formData);

    setIsSaving(false);
    if (res.success) {
      setEditingTask(null);
      toast.success('Proof saved', { description: 'You can now tick this block off.' });
    } else {
      toast.error('Could not save your proof', {
        description: res.error || 'Check the file is a PDF under 10 MB and try again.',
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled for today"
        description="Your study routine has no blocks on this day. Add a one-off task, or set up the week you want to repeat."
        action={
          <Button asChild variant="outline">
            <Link href="/manage">Set up your study routine</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isHomework = task.type === 'HOMEWORK';
        const isActiveSession = activeTask?.id === task.id && step === 'FOCUS';
        const isOpen = !task.isDone && !task.isMissed;
        const hasProof = Boolean(task.workDescription || task.proofPdfUrl);
        const duration = formatDuration(task.startTime, task.endTime);

        return (
          <article
            key={task.id}
            className={cn(
              'relative bg-card border border-border/60 shadow-sm rounded-2xl py-4 pl-6 pr-4 hover:shadow-md transition-shadow duration-200',
              task.isDone && 'bg-success/5',
              task.isMissed && 'bg-destructive/5',
              isActiveSession && 'border-primary/40'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute left-0 inset-y-3 border-l-4',
                task.isDone
                  ? 'border-success'
                  : task.isMissed
                    ? 'border-destructive'
                    : isHomework
                      ? 'border-primary'
                      : 'border-dashed border-orange-500'
              )}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <TaskCheckbox
                taskId={task.id}
                isDone={task.isDone}
                isMissed={task.isMissed}
                hasProof={hasProof}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/subjects?subject=${encodeURIComponent(subjectOf(task.subject))}`}
                    className={cn(
                      'font-heading font-bold text-lg leading-tight hover:text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded',
                      task.isDone && 'line-through text-muted-foreground',
                      task.isMissed && 'line-through text-muted-foreground'
                    )}
                  >
                    {task.subject}
                  </Link>
                  {isActiveSession ? (
                    <Pill tone={isPaused ? 'warning' : 'primary'}>
                      {isPaused ? <Pause /> : <Zap />}
                      {isPaused ? 'Session paused' : 'In session'}
                    </Pill>
                  ) : task.isUrgent && isOpen ? (
                    <Pill tone="warning">Exam this week</Pill>
                  ) : null}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {task.startTime} – {task.endTime}
                  </span>
                  {duration && <span className="tabular-nums">{duration}</span>}
                  <span className={cn('font-medium', isHomework ? 'text-primary' : 'text-orange-600 dark:text-orange-400')}>
                    {isHomework ? 'Homework' : 'Revision'}
                  </span>
                  {task.template?.deadlineDay && <span>Due {task.template.deadlineDay}</span>}
                  {task.isDone && <span className="font-medium text-success">Done</span>}
                  {task.isMissed && <span className="font-medium text-destructive">Missed</span>}
                  {hasProof && (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3.5" /> Proof attached
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isActiveSession ? (
                  <Button asChild size="lg">
                    <Link href={`/focus/${task.id}`}>
                      <Play /> {isPaused ? 'Resume' : 'Open session'}
                    </Link>
                  </Button>
                ) : (
                  isOpen && !archived && (
                    <Button asChild variant="outline" size="lg" title="Start a focus session on this block">
                      <Link href={`/focus/${task.id}`}>
                        <Zap /> Focus
                      </Link>
                    </Button>
                  )
                )}

                {!task.isMissed && !isActiveSession && !archived && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => handleOpenEdit(task)}
                    className={cn(hasProof && 'text-success hover:text-success')}
                    aria-label={hasProof ? `Edit proof for ${task.subject}` : `Attach proof for ${task.subject}`}
                  >
                    <FileEdit />
                    <span className="hidden sm:inline">{hasProof ? 'Edit proof' : 'Add proof'}</span>
                  </Button>
                )}

                <DeleteTaskButton taskId={task.id} className="size-9" />
              </div>
            </div>

            {hasProof && (
              <div className="mt-3 flex flex-col gap-1.5 border-t border-border/40 pt-3">
                {task.workDescription && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{task.workDescription}</p>
                )}
                {task.proofPdfUrl && (
                  <a
                    href={task.proofPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <FileText className="size-4" /> View attached PDF
                  </a>
                )}
              </div>
            )}
          </article>
        );
      })}

      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-xl flex items-center gap-2">
              <FileEdit className="size-5 text-primary" />
              Proof of work
            </DialogTitle>
            <DialogDescription>
              What did you get done in <span className="font-medium text-foreground">{editingTask?.subject}</span>?
              A line of text, a PDF, or both. You need one before the block can be ticked off.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="proof-description">What you did</Label>
              <Textarea
                id="proof-description"
                placeholder="e.g. Finished the exercises on page 42"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 resize-none"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof-upload">PDF (optional)</Label>
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                id="proof-upload"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                  selectedFile ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/40'
                )}
              >
                <label
                  htmlFor="proof-upload"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg focus-within:ring-2 focus-within:ring-ring/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background border">
                    <Upload className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {selectedFile ? selectedFile.name : 'Choose a PDF'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Up to 10 MB'}
                    </span>
                  </span>
                </label>
                {selectedFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove the chosen file"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {editingTask?.proofPdfUrl && !selectedFile && (
                <p className="text-xs text-muted-foreground">
                  A PDF is already attached.{' '}
                  <a href={editingTask.proofPdfUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    View it
                  </a>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleSaveProof}
              disabled={isSaving || (!description.trim() && !selectedFile && !editingTask?.proofPdfUrl)}
            >
              <Save /> {isSaving ? 'Saving...' : 'Save proof'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
