'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { deleteTask } from '@/lib/actions';
import { useIsArchived } from '@/components/ArchiveContext';
import { cn } from '@/lib/utils';

interface DeleteTaskButtonProps {
  taskId: string;
  variant?: "ghost" | "destructive" | "outline";
  className?: string;
}

/**
 * The delete confirmation on its own, for callers whose trigger lives in a
 * menu: a modal rendered inside a dropdown would unmount with it.
 */
export function useDeleteTaskConfirm() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    if (!taskId) return;
    setIsPending(true);
    const res = await deleteTask(taskId);
    setIsPending(false);
    if (res.success) {
      setTaskId(null);
    } else {
      alert("Failed to delete task.");
    }
  };

  const modal = (
    <ConfirmModal
      isOpen={taskId !== null}
      onClose={() => setTaskId(null)}
      onConfirm={handleDelete}
      title="Delete Task"
      description="Are you sure you want to remove this task? This action cannot be undone."
      isPending={isPending}
    />
  );

  return { ask: setTaskId, modal };
}

export function DeleteTaskButton({ taskId, variant = "ghost", className }: DeleteTaskButtonProps) {
  const { ask, modal } = useDeleteTaskConfirm();
  const archived = useIsArchived();

  // A finished year is a record: deleting from it is refused server-side,
  // so the control is not offered.
  if (archived) return null;

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ask(taskId);
        }}
        className={cn(
          "rounded-xl h-8 w-8 p-0 text-destructive hover:bg-destructive/10 transition-all border border-destructive/10 shadow-sm shadow-destructive/5",
          className
        )}
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      {modal}
    </>
  );
}
