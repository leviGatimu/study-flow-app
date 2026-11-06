'use client';

import { useId, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createTemplate } from '@/lib/actions';
import { ClashDialog } from '@/components/schedule/ClashDialog';
import type { ClashInfo, ClashResolution } from '@/lib/schedule-clash';
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

  const [clash, setClash] = useState<ClashInfo | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.subject) {
      toast.error('Choose a subject for this block.');
      return;
    }
    save();
  };

  const save = (onClash?: ClashResolution) => {
    startTransition(async () => {
      try {
        const result = await createTemplate({ ...values, dayOfWeek: parseInt(values.dayOfWeek, 10) }, onClash);
        setClash(null);
        if ('clash' in result) {
          setClash(result.clash);
          return;
        }
        if ('error' in result) {
          toast.error(result.error);
          return;
        }
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
          <ClashDialog clash={clash} subject={values.subject} routine busy={isPending} onChoose={save} onCancel={() => setClash(null)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
