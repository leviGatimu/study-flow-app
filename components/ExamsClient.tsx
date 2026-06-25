'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEvent, deleteEvent } from '@/lib/actions';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export function ExamsClient({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({ title: '', date: '', priority: 'NORMAL' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createEvent({
        title: formData.title,
        date: new Date(formData.date),
        priority: formData.priority
      });
      setFormData({ title: '', date: '', priority: 'NORMAL' });
      setOpen(false);
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-sm gap-2 shadow-sm hover:scale-[1.01] active:scale-95 transition-all cursor-pointer">
            <Plus className="w-4 h-4" /> Add Exam
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-2xl border border-border bg-card p-0 overflow-hidden max-w-md shadow-2xl">
          <div className="p-8 space-y-6 relative">
             <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10" />
             
             <DialogHeader className="relative z-10">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 mb-4">
                   <CalendarIcon className="w-6 h-6 text-primary" />
                </div>
                <DialogTitle className="text-2xl font-heading font-black text-foreground uppercase tracking-tight">Add Upcoming Exam</DialogTitle>
                <p className="text-muted-foreground font-semibold text-xs mt-1">Schedule a new course exam or major assessment.</p>
             </DialogHeader>

             <form onSubmit={handleCreate} className="space-y-5 relative z-10">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Exam Title / Subject</Label>
                   <Input 
                     required 
                     value={formData.title} 
                     onChange={e => setFormData({...formData, title: e.target.value})} 
                     placeholder="e.g. Physics Midterm Paper 1" 
                     className="h-11 rounded-xl bg-muted/30 border-border/50 text-foreground font-bold text-sm px-4 focus-visible:ring-1 focus-visible:ring-primary/25" 
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Exam Date</Label>
                      <div className="relative">
                         <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                         <Input 
                           type="date" 
                           required 
                           value={formData.date} 
                           onChange={e => setFormData({...formData, date: e.target.value})} 
                           className="h-11 rounded-xl bg-muted/30 border-border/50 text-foreground font-bold pl-11 text-sm focus-visible:ring-1 focus-visible:ring-primary/25" 
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Priority Level</Label>
                      <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})}>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/50 text-foreground font-bold px-4 text-sm focus-visible:ring-1 focus-visible:ring-primary/25">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-card border-border text-foreground font-bold">
                          <SelectItem value="LOW" className="cursor-pointer">Low</SelectItem>
                          <SelectItem value="NORMAL" className="cursor-pointer">Normal</SelectItem>
                          <SelectItem value="HIGH" className="cursor-pointer text-red-500">High</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>

                <Button 
                  disabled={isPending} 
                  type="submit" 
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isPending ? 'Saving...' : 'Add Exam'}
                </Button>
             </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DeleteExamButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      disabled={isPending}
      className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to delete this exam?')) {
          startTransition(async () => {
            await deleteEvent(id);
          });
        }
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
