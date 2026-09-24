'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmModal } from '@/components/ConfirmModal';
import { createEvent, deleteEvent } from '@/lib/actions';
import { useIsArchived } from '@/components/ArchiveContext';

const EMPTY = { title: '', date: '', priority: 'NORMAL' };

/** The Exams page's primary action: add an exam. Hidden in an archived year. */
export function ExamsClient({ variant = 'default' }: { variant?: 'default' | 'outline' } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState(EMPTY);
  const archived = useIsArchived();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createEvent({
          title: formData.title.trim(),
          date: new Date(formData.date),
          priority: formData.priority,
        });
        toast.success(`${formData.title.trim()} added. Open it to link its subject and plan revision.`);
        setFormData(EMPTY);
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error('Add exam:', err);
        toast.error('Could not add the exam. Try again.');
      }
    });
  };

  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant={variant}>
          <Plus /> Add exam
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Add exam</DialogTitle>
          <DialogDescription>A test, exam or major assessment and the day it is on.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exam-title">Title</Label>
            <Input
              id="exam-title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Physics midterm, paper 1"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exam-date">Date</Label>
              <Input
                id="exam-date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger id="exam-priority" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending} className="h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="h-10 gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Adding' : 'Add exam'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete an exam after a confirmation. `redirectTo` is for the exam's own
 * page, which no longer exists once the exam is gone.
 */
export function DeleteExamButton({
  id,
  title,
  redirectTo,
  withLabel = false,
}: {
  id: string;
  title?: string;
  redirectTo?: string;
  withLabel?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const archived = useIsArchived();

  if (archived) return null;

  return (
    <>
      <Button
        variant="ghost"
        size={withLabel ? 'lg' : 'icon'}
        aria-label={withLabel ? undefined : `Delete ${title ?? 'exam'}`}
        disabled={isPending}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault();
          setConfirming(true);
        }}
      >
        <Trash2 />
        {withLabel && 'Delete'}
      </Button>
      <ConfirmModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        isPending={isPending}
        title="Delete this exam?"
        description={`${title ? `"${title}"` : 'This exam'} will be removed from your exams.`}
        onConfirm={() =>
          startTransition(async () => {
            try {
              await deleteEvent(id);
              toast.success('Exam deleted.');
              setConfirming(false);
              if (redirectTo) router.push(redirectTo);
              else router.refresh();
            } catch (err) {
              console.error('Delete exam:', err);
              toast.error('Could not delete the exam. Try again.');
            }
          })
        }
      />
    </>
  );
}
