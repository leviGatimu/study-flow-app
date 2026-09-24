'use client';

import { useId, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { updateTemplate } from '@/lib/actions';
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

type TemplateType = {
  id: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

const valuesOf = (t: TemplateType): TemplateFormValues => ({
  dayOfWeek: t.dayOfWeek.toString(),
  subject: t.subject,
  startTime: t.startTime,
  endTime: t.endTime,
  deadlineDay: t.deadlineDay,
  type: t.type,
});

export function EditTemplateForm({
  template,
  subjects = [],
}: {
  template: TemplateType;
  subjects?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const archived = useIsArchived();
  const fieldId = useId();
  const [values, setValues] = useState<TemplateFormValues>(() => valuesOf(template));

  const onOpenChange = (next: boolean) => {
    // Reopening starts from what is saved, not from an abandoned edit.
    if (next) setValues(valuesOf(template));
    setOpen(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateTemplate(template.id, { ...values, dayOfWeek: parseInt(values.dayOfWeek, 10) });
        setOpen(false);
        toast.success('Routine block updated.');
      } catch {
        toast.error('That block could not be saved. Try again.');
      }
    });
  };

  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${template.subject}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Edit routine block</DialogTitle>
            <DialogDescription>
              Changes apply to blocks not yet planned. Blocks already on your week keep their time.
            </DialogDescription>
          </DialogHeader>
          <TemplateFields idPrefix={fieldId} values={values} onChange={setValues} subjects={subjects} />
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
