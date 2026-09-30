'use client';

import { useId, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createTemplate } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsArchived } from '@/components/ArchiveContext';
import { TemplateFields, type TemplateFormValues } from '@/app/manage/TemplateFields';

const EMPTY: TemplateFormValues = {
  dayOfWeek: '1',
  subject: '',
  startTime: '',
  endTime: '',
  deadlineDay: 'Monday',
  type: 'HOMEWORK',
};

/** "Add to routine": a new recurring block in the study routine. */
export function ManageForm({
  subjects = [],
  variant = 'default',
}: {
  subjects?: { id: string; name: string }[];
  /** `outline` when a second trigger sits on the same page as the header's. */
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const archived = useIsArchived();
  const [values, setValues] = useState<TemplateFormValues>(EMPTY);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.subject) {
      toast.error('Choose a subject for this block.');
      return;
    }
    startTransition(async () => {
      try {
        await createTemplate({ ...values, dayOfWeek: parseInt(values.dayOfWeek, 10) });
        setOpen(false);
        setValues(EMPTY);
        toast.success('Added to your study routine.');
      } catch {
        toast.error('That block could not be saved. Try again.');
      }
    });
  };

  // Routine blocks belong to the active year; a finished year's weekly
  // schedule is history.
  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant={variant}>
          <Plus /> Add to routine
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add to your study routine</DialogTitle>
            <DialogDescription>A block that repeats on the same day every week.</DialogDescription>
          </DialogHeader>
          <TemplateFields idPrefix={fieldId} values={values} onChange={setValues} subjects={subjects} />
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Add block'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
