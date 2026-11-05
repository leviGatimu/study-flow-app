'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, FileEdit, FileText, MoreHorizontal, Paperclip, Pause, Play, Save, Trash2, Upload, X, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { ModeBar, TaskTick, useTaskStatus } from '@/components/TaskCheckbox';
import { useDeleteTaskConfirm } from '@/components/DeleteTaskButton';
import { useIsArchived } from '@/components/ArchiveContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * Today's blocks as a timeline: the time and length down the left on a line,
 * each block a card beside it. A card answers what, when and what to do: tick
 * it off, start a focus session, and (in the menu) proof, missed, delete.
 *
 * The card's left edge carries the focus mode, per the original brief:
 * HOMEWORK is a solid primary edge, REVISION a dashed orange one. The dot on
 * the line carries the status: done green, missed red, in session pulsing.
 */
export function TaskList({ tasks }: { tasks: TaskType[] }) {
  const { activeTask, isPaused, step } = useFocus();
  const { ask: askDelete, modal: deleteModal } = useDeleteTaskConfirm();
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
    <div>
      <ol aria-label="Today's blocks, in time order">
        {tasks.map((task, index) => (
          <TimelineItem
            key={task.id}
            task={task}
            last={index === tasks.length - 1}
            isActiveSession={activeTask?.id === task.id && step === 'FOCUS'}
            isPaused={isPaused}
            archived={archived}
            onEditProof={() => handleOpenEdit(task)}
            onDelete={() => askDelete(task.id)}
          />
        ))}
      </ol>
      {deleteModal}

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

function TimelineItem({
  task,
  last,
  isActiveSession,
  isPaused,
  archived,
  onEditProof,
  onDelete,
}: {
  task: TaskType;
  last: boolean;
  isActiveSession: boolean;
  isPaused: boolean;
  archived: boolean;
  onEditProof: () => void;
  onDelete: () => void;
}) {
  const isHomework = task.type === 'HOMEWORK';
  const isOpen = !task.isDone && !task.isMissed;
  const hasProof = Boolean(task.workDescription || task.proofPdfUrl);
  const duration = formatDuration(task.startTime, task.endTime);
  // For the menu's "Mark as missed"; the tick has its own.
  const { toggleMissed, locked } = useTaskStatus({
    taskId: task.id,
    isDone: task.isDone,
    isMissed: task.isMissed,
    hasProof,
  });

  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-4">
      {/* Time column */}
      <div className="pt-3.5 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{task.startTime}</p>
        {duration && <p className="text-xs tabular-nums text-muted-foreground">{duration}</p>}
      </div>

      {/* Line, status dot and card */}
      <div className={cn('relative pl-6', !last && 'pb-3')}>
        {!last && <span aria-hidden className="absolute bottom-0 left-[7px] top-6 w-px bg-border" />}
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-[18px] flex size-[15px] items-center justify-center rounded-full border-2 bg-background',
            task.isDone
              ? 'border-success bg-success'
              : task.isMissed
                ? 'border-destructive bg-destructive'
                : isActiveSession
                  ? 'border-primary bg-primary ring-4 ring-primary/20'
                  : isHomework
                    ? 'border-primary'
                    : 'border-dashed border-orange-500'
          )}
        >
          {task.isDone && <Check className="size-2.5 text-white" strokeWidth={4} />}
          {task.isMissed && <X className="size-2.5 text-white" strokeWidth={4} />}
          {isActiveSession && !isPaused && (
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
          )}
        </span>

        <article
          className={cn(
            'relative rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md',
            task.isDone && 'bg-success/[0.04]',
            task.isMissed && 'bg-destructive/[0.04]',
            isActiveSession && 'border-primary/40 ring-1 ring-primary/20'
          )}
        >
          <ModeBar type={task.type} isDone={task.isDone} isMissed={task.isMissed} />
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Ticking a block without proof opens the proof editor straight away. */}
            <TaskTick
              taskId={task.id}
              subject={task.subject}
              isDone={task.isDone}
              isMissed={task.isMissed}
              hasProof={hasProof}
              onNeedProof={onEditProof}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/subjects?subject=${encodeURIComponent(subjectOf(task.subject))}`}
                  className={cn(
                    'min-w-0 truncate rounded text-[15px] font-semibold leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    !isOpen && 'text-muted-foreground line-through decoration-1'
                  )}
                >
                  {task.subject}
                </Link>
                {isActiveSession ? (
                  <Pill tone={isPaused ? 'warning' : 'primary'}>
                    {isPaused ? <Pause /> : <Zap />}
                    {isPaused ? 'Paused' : 'In session'}
                  </Pill>
                ) : task.isUrgent && isOpen ? (
                  <Pill tone="warning">Exam this week</Pill>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-medium',
                    isHomework ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                  )}
                >
                  {isHomework ? 'Homework' : 'Revision'}
                </span>
                <span className="tabular-nums">
                  {task.startTime} – {task.endTime}
                </span>
                {task.template?.deadlineDay && <span>· Due {task.template.deadlineDay}</span>}
                {hasProof && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Paperclip className="size-3" /> Proof
                  </span>
                )}
                {task.isDone && <span className="font-medium text-success">· Done</span>}
                {task.isMissed && <span className="font-medium text-destructive">· Missed</span>}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {isActiveSession ? (
                <Button asChild size="sm">
                  <Link href={`/focus/${task.id}`}>
                    <Play /> {isPaused ? 'Resume' : 'Open'}
                  </Link>
                </Button>
              ) : (
                isOpen && !archived && (
                  <Button asChild variant="outline" size="sm" title="Start a focus session on this block">
                    <Link href={`/focus/${task.id}`}>
                      <Zap /> <span className="hidden sm:inline">Focus</span>
                    </Link>
                  </Button>
                )
              )}
              {!archived && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${task.subject}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {!task.isMissed && !isActiveSession && (
                      <DropdownMenuItem onSelect={onEditProof}>
                        <FileEdit /> {hasProof ? 'Edit proof' : 'Add proof'}
                      </DropdownMenuItem>
                    )}
                    {!task.isDone && (
                      <DropdownMenuItem onSelect={toggleMissed} disabled={locked}>
                        <XCircle /> {task.isMissed ? 'Not missed' : 'Mark as missed'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 /> Delete block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {hasProof && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 py-2.5 pl-[3.75rem] pr-4">
              {task.workDescription && (
                <p className="min-w-0 flex-1 text-sm text-muted-foreground line-clamp-1">{task.workDescription}</p>
              )}
              {task.proofPdfUrl && (
                <a
                  href={task.proofPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="size-4" /> PDF
                </a>
              )}
            </div>
          )}
        </article>
      </div>
    </li>
  );
}
