'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createHomework } from '@/lib/homework-actions';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface CreateHomeworkFormProps {
  onSuccess?: () => void;
  subjects: { id: string; name: string }[];
}

export function CreateHomeworkForm({ onSuccess, subjects }: CreateHomeworkFormProps) {
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
    } catch (error) {
      toast.error('Failed to add homework');
    } finally {
      setIsPending(false);
    }
  }

  const fieldClass = "h-12 rounded-2xl bg-muted/40 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/5 text-base font-bold transition-all px-4";

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="subject" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Subject</Label>
          <Select name="subject" required>
            <SelectTrigger className={cn(fieldClass, "text-left")}>
              <SelectValue placeholder="Select subject..." />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border p-2">
              {subjects.map((sub) => (
                <SelectItem key={sub.id} value={sub.name} className="font-bold py-2.5 rounded-xl focus:bg-primary/10 cursor-pointer">
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Due Date</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. Calculus Problem Set #4"
          required
          className={fieldClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description <span className="text-muted-foreground/40 normal-case font-bold">(optional)</span></Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Add any extra details, page numbers, or instructions..."
          className="min-h-[110px] rounded-2xl bg-muted/40 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/5 text-base font-medium p-4 transition-all resize-none"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/95 text-primary-foreground font-black text-base shadow-lg shadow-primary/10 hover:scale-[1.01] transition-all active:scale-[0.99] cursor-pointer gap-2">
        {isPending ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> ADDING...</>
        ) : (
          'ADD HOMEWORK'
        )}
      </Button>
    </form>
  );
}
