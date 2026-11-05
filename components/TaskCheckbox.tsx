'use client';

import { useState, useTransition } from 'react';
import { toggleTaskDone, toggleTaskMissed } from '@/lib/actions';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValidationModal } from './ValidationModal';
import { useArchiveReason } from '@/components/ArchiveContext';
import { toast } from 'sonner';

/**
 * Done / missed toggles for one block, shared by the tick buttons here and
 * the dashboard timeline. A block needs proof before it can be ticked off:
 * `onNeedProof` lets the caller open its proof editor instead of the
 * "Add proof first" notice.
 */
export function useTaskStatus({
  taskId,
  isDone,
  isMissed,
  hasProof,
  onNeedProof,
}: {
  taskId: string;
  isDone: boolean;
  isMissed: boolean;
  hasProof: boolean;
  onNeedProof?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showValidation, setShowValidation] = useState(false);
  // In a finished year these stay visible but inert: they are the record
  // of what was done, not just a control.
  const archiveReason = useArchiveReason();
  const locked = isPending || archiveReason !== null;

  const toggleDone = () => {
    if (!isDone && !hasProof) {
      if (onNeedProof) {
        onNeedProof();
        return;
      }
      toast.error("Add proof first", {
        description: "Write what you did, or attach a PDF, before ticking this block off."
      });
      setShowValidation(true);
      return;
    }
    startTransition(async () => {
      await toggleTaskDone(taskId, !isDone);
      if (!isDone) {
        toast.success("Task completed! +100 XP");
      }
    });
  };

  const toggleMissed = () => {
    startTransition(async () => {
      await toggleTaskMissed(taskId, !isMissed);
      if (!isMissed) {
        toast.info("Task marked as missed");
      }
    });
  };

  const validationModal = (
    <ValidationModal
      isOpen={showValidation}
      onClose={() => setShowValidation(false)}
      title="Add proof first"
      description="Use Add proof on this block to write a line about what you did, or attach a PDF. Then you can tick it off."
    />
  );

  return { toggleDone, toggleMissed, isPending, locked, archiveReason, validationModal };
}

/**
 * The focus-mode marker on a block card, per the original brief: a short
 * straight bar inside the card's left edge - solid primary for HOMEWORK,
 * dashed orange for REVISION, green when done, red when missed. A bar rather
 * than a coloured border, which bends round the card's rounded corners.
 */
export function ModeBar({ type, isDone, isMissed }: { type: string; isDone: boolean; isMissed: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-3 bottom-3 border-l-[3px]',
        isDone
          ? 'border-success'
          : isMissed
            ? 'border-destructive'
            : type === 'REVISION'
              ? 'border-dashed border-orange-500'
              : 'border-primary'
      )}
    />
  );
}

/**
 * One round tick for a block (the dashboard timeline and the month's day
 * panel). Missed is secondary: `showMissed` adds a small icon button for it,
 * otherwise callers offer it in a menu via useTaskStatus.
 */
export function TaskTick({
  taskId,
  subject,
  isDone,
  isMissed,
  hasProof,
  onNeedProof,
  showMissed = false,
  mode,
  size = 'md',
}: {
  taskId: string;
  subject: string;
  isDone: boolean;
  isMissed: boolean;
  hasProof: boolean;
  onNeedProof?: () => void;
  showMissed?: boolean;
  /** HOMEWORK draws an open tick solid blue, REVISION dashed orange (the app's mode convention). */
  mode?: string;
  size?: 'sm' | 'md';
}) {
  const { toggleDone, toggleMissed, locked, archiveReason, validationModal } = useTaskStatus({ taskId, isDone, isMissed, hasProof, onNeedProof });

  return (
    <>
      <button
        type="button"
        onClick={toggleDone}
        disabled={locked || isMissed}
        title={archiveReason ?? (isMissed ? 'Marked as missed' : undefined)}
        aria-label={isDone ? `Mark ${subject} as not done` : `Mark ${subject} as done`}
        aria-pressed={isDone}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed',
          size === 'sm' ? 'size-6' : 'size-8',
          isDone
            ? 'border-success bg-success text-white'
            : isMissed
              ? 'border-destructive bg-destructive text-white'
              : cn(
                  'bg-background text-transparent hover:border-success hover:text-success',
                  mode === 'REVISION' ? 'border-dashed border-orange-500' : mode ? 'border-primary' : 'border-border'
                )
        )}
      >
        {isMissed ? <X className={size === 'sm' ? 'size-3' : 'size-4'} strokeWidth={3} /> : <Check className={size === 'sm' ? 'size-3' : 'size-4'} strokeWidth={3} />}
      </button>
      {showMissed && !isDone && (
        <button
          type="button"
          onClick={toggleMissed}
          disabled={locked}
          title={archiveReason ?? undefined}
          aria-label={isMissed ? `${subject} was not missed` : `Mark ${subject} as missed`}
          aria-pressed={isMissed}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed',
            isMissed ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive'
          )}
        >
          <X className="size-3.5" strokeWidth={3} />
        </button>
      )}
      {!onNeedProof && validationModal}
    </>
  );
}

export function TaskCheckbox({ taskId, isDone, isMissed, hasProof }: { taskId: string; isDone: boolean; isMissed: boolean; hasProof: boolean }) {
  const { toggleDone, toggleMissed, locked, archiveReason, validationModal } = useTaskStatus({ taskId, isDone, isMissed, hasProof });

  return (
    <div className="flex items-center gap-2">
      {/* Done Button (Green Tick) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleDone();
        }}
        aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        title={archiveReason ?? undefined}
        disabled={locked}
        className={cn(
          "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all",
          isDone
            ? "bg-success border-success text-white"
            : "border-border hover:border-success/50 text-transparent hover:text-success/30"
        )}
      >
        <Check className={cn("w-5 h-5", isDone ? "opacity-100" : "opacity-0 hover:opacity-100")} strokeWidth={4} />
      </button>

      {/* Missed Button (Red Cross) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleMissed();
        }}
        aria-label={isMissed ? 'Unmark as missed' : 'Mark as missed'}
        title={archiveReason ?? undefined}
        disabled={locked}
        className={cn(
          "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all",
          isMissed
            ? "bg-destructive border-destructive text-white"
            : "border-border hover:border-destructive/50 text-transparent hover:text-destructive/30"
        )}
      >
        <X className={cn("w-5 h-5", isMissed ? "opacity-100" : "opacity-0 hover:opacity-100")} strokeWidth={4} />
      </button>

      {validationModal}
    </div>
  );
}
