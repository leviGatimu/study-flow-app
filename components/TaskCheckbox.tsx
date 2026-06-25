'use client';

import { useState, useTransition } from 'react';
import { toggleTaskDone, toggleTaskMissed } from '@/lib/actions';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValidationModal } from './ValidationModal';
import { toast } from 'sonner';

export function TaskCheckbox({ taskId, isDone, isMissed, hasProof }: { taskId: string; isDone: boolean; isMissed: boolean; hasProof: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showValidation, setShowValidation] = useState(false);

  const handleToggleDone = () => {
    if (!isDone && !hasProof) {
      toast.error("Proof Required", {
        description: "Please attach proof before marking this task as done."
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

  const handleToggleMissed = () => {
    startTransition(async () => {
      await toggleTaskMissed(taskId, !isMissed);
      if (!isMissed) {
        toast.info("Task marked as missed");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Done Button (Green Tick) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          handleToggleDone();
        }}
        disabled={isPending}
        className={cn(
          "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all active:scale-90",
          isDone 
            ? "bg-success border-success text-white shadow-lg shadow-success/30" 
            : "border-border hover:border-success/50 text-transparent hover:text-success/30"
        )}
      >
        <Check className={cn("w-5 h-5", isDone ? "opacity-100" : "opacity-0 hover:opacity-100")} strokeWidth={4} />
      </button>

      {/* Missed Button (Red Cross) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          handleToggleMissed();
        }}
        disabled={isPending}
        className={cn(
          "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all active:scale-90",
          isMissed 
            ? "bg-destructive border-destructive text-white shadow-lg shadow-destructive/30" 
            : "border-border hover:border-destructive/50 text-transparent hover:text-destructive/30"
        )}
      >
        <X className={cn("w-5 h-5", isMissed ? "opacity-100" : "opacity-0 hover:opacity-100")} strokeWidth={4} />
      </button>

      <ValidationModal 
        isOpen={showValidation}
        onClose={() => setShowValidation(false)}
        title="Proof Required"
        description="Please 'Attach Proof' of your work before marking this task as done!"
      />
    </div>
  );
}
