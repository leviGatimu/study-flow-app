'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createQuickTask } from '@/lib/actions';
import { useIsArchived } from '@/components/ArchiveContext';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export function QuickAddForm({ initialDate, trigger, subjects = [] }: { initialDate?: Date, trigger?: React.ReactNode, subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const archived = useIsArchived();

  const [formData, setFormData] = useState({
    subject: '',
    startTime: '',
    endTime: '',
    type: 'HOMEWORK',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createQuickTask({
        ...formData,
        date: formData.date // Send as string
      });
      setFormData({ 
        subject: '', 
        startTime: '', 
        endTime: '', 
        type: 'HOMEWORK',
        date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      });
      setOpen(false);
      router.refresh();
    });
  };

  // New tasks always belong to the ACTIVE year, so there is nothing sensible
  // for this to do while a finished one is open. The Sidebar renders its own
  // explained, disabled button in place of this.
  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="lg">
            <Plus /> Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Add a task</DialogTitle>
          <p className="text-sm text-muted-foreground">A one-off block for {initialDate ? format(initialDate, 'MMMM do') : 'the day you pick'}. It does not change your weekly routine.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="quick-add-subject" className="text-xs font-medium text-muted-foreground">Subject</Label>
            <Select 
              value={formData.subject} 
              onValueChange={v => setFormData({...formData, subject: v})}
              required
            >
              <SelectTrigger id="quick-add-subject" className="rounded-xl h-11 text-left">
                <SelectValue placeholder="Select subject..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {subjects.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs font-semibold text-muted-foreground">
                    No subjects yet. Add them on the Subjects page first.
                  </div>
                ) : (
                  subjects.map(s => (
                    <SelectItem key={s.id} value={s.name} className="cursor-pointer">
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {!initialDate && (
            <div className="space-y-2">
              <Label htmlFor="quick-add-date" className="text-xs font-medium text-muted-foreground">Date</Label>
              <Input
                id="quick-add-date" 
                type="date"
                required 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
                className="rounded-xl h-11"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-add-start" className="text-xs font-medium text-muted-foreground">Start time</Label>
              <Input
                id="quick-add-start" 
                type="time" 
                required 
                value={formData.startTime} 
                onChange={e => setFormData({...formData, startTime: e.target.value})} 
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-end" className="text-xs font-medium text-muted-foreground">End time</Label>
              <Input
                id="quick-add-end" 
                type="time" 
                required 
                value={formData.endTime} 
                onChange={e => setFormData({...formData, endTime: e.target.value})} 
                className="rounded-xl h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-add-type" className="text-xs font-medium text-muted-foreground">Type</Label>
            <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
              <SelectTrigger id="quick-add-type" className="rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="HOMEWORK">Homework</SelectItem>
                <SelectItem value="REVISION">Revision</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button disabled={isPending} type="submit" size="lg" className="w-full h-11">{isPending ? 'Adding...' : 'Add task'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
