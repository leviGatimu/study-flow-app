'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteTemplate, getTemplateDeletionImpact } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useIsArchived } from '@/components/ArchiveContext';

/**
 * Remove a recurring block from the weekly timetable.
 *
 * This used to delete on a single unconfirmed click. Task.template is ON
 * DELETE CASCADE, so that one click also destroyed every task the block had
 * ever generated - finished work, written descriptions and uploaded proof
 * included. It was the most destructive control in the app and the least
 * protected.
 *
 * Now it asks first, and says what will actually happen using real counts
 * fetched when the dialog opens rather than a vague warning. deleteTemplate
 * detaches completed tasks before removing the block, so history survives
 * either way - the confirmation explains that rather than threatening it.
 */
export function DeleteTemplateButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<{ completed: number; pending: number; subject: string } | null>(null);
  const archived = useIsArchived();

  const openDialog = async () => {
    setOpen(true);
    setImpact(null);
    try {
      setImpact(await getTemplateDeletionImpact(id));
    } catch {
      // Leave impact null; the dialog falls back to generic wording rather
      // than blocking the user on a count it could not fetch.
    }
  };

  const describe = () => {
    if (!impact) return 'Checking what this affects...';

    const name = impact.subject ? `"${impact.subject}"` : 'this block';
    const parts: string[] = [];

    if (impact.pending > 0) {
      parts.push(`${impact.pending} scheduled ${impact.pending === 1 ? 'block' : 'blocks'} you have not done yet will be removed`);
    }
    if (impact.completed > 0) {
      parts.push(`${impact.completed} completed ${impact.completed === 1 ? 'session' : 'sessions'} will be KEPT in your history, along with any proof you attached`);
    }

    if (parts.length === 0) {
      return `${name} will be removed from your weekly timetable. Nothing else is affected.`;
    }

    return `${name} will be removed from your weekly timetable. ${parts.join(', and ')}.`;
  };

  if (archived) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete this timetable block"
        title="Delete this timetable block"
        disabled={isPending}
        onClick={openDialog}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <ConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        isPending={isPending}
        title="Remove this from your timetable?"
        description={describe()}
        onConfirm={() =>
          startTransition(async () => {
            await deleteTemplate(id);
            setOpen(false);
            toast.success('Removed from your timetable. Completed sessions were kept.');
          })
        }
      />
    </>
  );
}
