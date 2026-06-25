'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { deleteTask } from '@/lib/actions';
import { cn } from '@/lib/utils';

interface DeleteTaskButtonProps {
  taskId: string;
  variant?: "ghost" | "destructive" | "outline";
  className?: string;
}

export function DeleteTaskButton({ taskId, variant = "ghost", className }: DeleteTaskButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    const res = await deleteTask(taskId);
    setIsPending(false);
    if (res.success) {
      setIsOpen(false);
    } else {
      alert("Failed to delete task.");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={cn(
          "rounded-xl h-8 w-8 p-0 text-destructive hover:bg-destructive/10 transition-all border border-destructive/10 shadow-sm shadow-destructive/5",
          className
        )}
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <ConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        description="Are you sure you want to remove this task? This action cannot be undone."
        isPending={isPending}
      />
    </>
  );
}
