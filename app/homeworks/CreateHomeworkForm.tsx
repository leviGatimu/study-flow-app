'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsArchived } from '@/components/ArchiveContext';
import { createHomework } from '@/lib/homework-actions';
import { ClashDialog } from '@/components/schedule/ClashDialog';
import type { ClashInfo, ClashResolution } from '@/lib/schedule-clash';
import { HomeworkSlotFields } from './HomeworkSlotFields';

type SubjectOption = { id: string; name: string };

interface CreateHomeworkFormProps {
  onSuccess?: () => void;
  subjects: SubjectOption[];
  /** Pre-picks the subject, when the list is already narrowed to one. */
  defaultSubject?: string | null;
}

/** The page's "Add homework" action; hidden while viewing an archived year. */
export function AddHomeworkButton({
  subjects,
  defaultSubject,
  label = 'Add homework',
  variant = 'default',
}: {
  subjects: SubjectOption[];
  defaultSubject?: string | null;
  label?: string;
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const archived = useIsArchived();
  if (archived) return null;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className="h-9 gap-1.5 px-3.5">
        <Plus className="size-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold">New homework</DialogTitle>
            <DialogDescription>Add an assignment, when it is due and when you will do it.</DialogDescription>
          </DialogHeader>
          <CreateHomeworkForm
            onSuccess={() => {
              setOpen(false);
              // The action revalidates /homeworks; this button is also used on
              // subject pages, which need their own refresh.
              router.refresh();
            }}
            subjects={subjects}
            defaultSubject={defaultSubject}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CreateHomeworkForm({ onSuccess, subjects, defaultSubject }: CreateHomeworkFormProps) {
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [clash, setClash] = useState<{ info: ClashInfo; form: FormData } | null>(null);
  const [clashSubject, setClashSubject] = useState('');

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createHomework(formData);
      setClash(null);
      if ('clash' in result && result.clash) {
        setClashSubject(String(formData.get('subject') ?? 'This homework'));
        setClash({ info: result.clash, form: formData });
      } else if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success('slot' in result && result.slot ? `Homework added and on your schedule at ${result.slot.startTime}` : 'Homework added');
        formRef.current?.reset();
        onSuccess?.();
      }
    } catch {
      toast.error('Failed to add homework');
    } finally {
      setIsPending(false);
    }
  }

  const chooseClash = (resolution: ClashResolution) => {
    if (!clash) return;
    clash.form.set('onClash', resolution);
    void handleSubmit(clash.form);
  };

  const fieldClass = 'h-10 rounded-lg';

  return (
    <>
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hw-subject">Subject</Label>
          <Select name="subject" required defaultValue={subjects.find((s) => s.name === defaultSubject)?.name}>
            <SelectTrigger id="hw-subject" className={`${fieldClass} w-full text-left`}>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((sub) => (
                <SelectItem key={sub.id} value={sub.name}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hw-dueDate">Due date</Label>
          <Input id="hw-dueDate" name="dueDate" type="date" required className={fieldClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hw-title">Title</Label>
        <Input id="hw-title" name="title" placeholder="e.g. Calculus problem set 4" required className={fieldClass} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hw-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="hw-description"
          name="description"
          placeholder="Page numbers, questions, instructions"
          className="min-h-24 resize-none rounded-lg"
        />
      </div>

      <HomeworkSlotFields idPrefix="hw" />

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending} className="h-10 w-full gap-2 px-4 sm:w-auto">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Adding
            </>
          ) : (
            'Add homework'
          )}
        </Button>
      </div>
    </form>
    <ClashDialog clash={clash?.info ?? null} subject={clashSubject} busy={isPending} onChoose={chooseClash} onCancel={() => setClash(null)} />
    </>
  );
}
