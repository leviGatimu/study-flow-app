'use client';

import { useState, useTransition } from 'react';
import { Plus, BookOpen, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createQuickTask } from '@/lib/actions';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export function QuickAddForm({ initialDate, trigger, subjects = [] }: { initialDate?: Date, trigger?: React.ReactNode, subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-full gap-2 font-bold hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm border-border/60">
            <Plus className="w-4 h-4" /> Quick Add Assignment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-[32px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading font-black">Quick Add Task</DialogTitle>
          <p className="text-sm text-muted-foreground">Add a one-off task for {initialDate ? format(initialDate, 'MMMM do') : 'today'}.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Subject</Label>
            <Select 
              value={formData.subject} 
              onValueChange={v => setFormData({...formData, subject: v})}
              required
            >
              <SelectTrigger className="rounded-xl h-12 font-bold text-left">
                <SelectValue placeholder="Select subject..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold">
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
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Date</Label>
              <Input 
                type="date"
                required 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
                className="rounded-xl h-12 font-bold"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Start Time</Label>
              <Input 
                type="time" 
                required 
                value={formData.startTime} 
                onChange={e => setFormData({...formData, startTime: e.target.value})} 
                className="rounded-xl h-12 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">End Time</Label>
              <Input 
                type="time" 
                required 
                value={formData.endTime} 
                onChange={e => setFormData({...formData, endTime: e.target.value})} 
                className="rounded-xl h-12 font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-1">Type</Label>
            <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
              <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl font-bold">
                <SelectItem value="HOMEWORK">HOMEWORK</SelectItem>
                <SelectItem value="REVISION">REVISION</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button disabled={isPending} type="submit" className="w-full h-12 rounded-xl font-black text-lg shadow-lg">Add Task</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
