'use client';

import { useState, useRef } from 'react';
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
            <DialogDescription>Add an assignment and when it is due.</DialogDescription>
          </DialogHeader>
          <CreateHomeworkForm onSuccess={() => setOpen(false)} subjects={subjects} defaultSubject={defaultSubject} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CreateHomeworkForm({ onSuccess, subjects, defaultSubject }: CreateHomeworkFormProps) {
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      const result = await createHomework(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Homework added');
        formRef.current?.reset();
        onSuccess?.();
      }
    } catch {
      toast.error('Failed to add homework');
    } finally {
      setIsPending(false);
    }
  }

  const fieldClass = 'h-10 rounded-lg';

  return (
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
  );
}
