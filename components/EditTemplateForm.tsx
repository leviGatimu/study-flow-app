'use client';

import { useState, useTransition } from 'react';
import { updateTemplate } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, BookOpen, Clock, Calendar, CheckCircle2 } from 'lucide-react';

type TemplateType = {
  id: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

export function EditTemplateForm({ template, subjects = [] }: { template: TemplateType; subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    dayOfWeek: template.dayOfWeek.toString(),
    subject: template.subject,
    startTime: template.startTime,
    endTime: template.endTime,
    deadlineDay: template.deadlineDay,
    type: template.type
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      updateTemplate(template.id, {
        ...formData,
        dayOfWeek: parseInt(formData.dayOfWeek, 10)
      });
      open && setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl rounded-[32px] p-0 overflow-hidden border shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-card">
          <DialogHeader className="p-8 border-b bg-muted/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <DialogTitle className="text-3xl font-heading font-black text-foreground relative z-10">Edit Study Block</DialogTitle>
            <p className="text-muted-foreground font-medium relative z-10">Update your recurring class or revision session.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-3">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                <BookOpen className="w-3 h-3 text-primary" /> Subject Name
              </Label>
              <Select value={formData.subject} onValueChange={v => setFormData({...formData, subject: v})} required>
                <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-base">
                  <SelectValue placeholder="Select subject..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/60 shadow-xl font-bold">
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                  <Calendar className="w-3 h-3 text-primary" /> Day of Week
                </Label>
                <Select value={formData.dayOfWeek} onValueChange={v => setFormData({...formData, dayOfWeek: v})}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/60 shadow-xl font-bold">
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                  <CheckCircle2 className="w-3 h-3 text-primary" /> Activity Type
                </Label>
                <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/60 shadow-xl font-bold">
                    <SelectItem value="HOMEWORK">HOMEWORK</SelectItem>
                    <SelectItem value="REVISION">REVISION</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                  <Clock className="w-3 h-3 text-primary" /> Start Time
                </Label>
                <Input 
                  type="time" 
                  required 
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-lg" 
                  value={formData.startTime} 
                  onChange={e => setFormData({...formData, startTime: e.target.value})} 
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                  <Clock className="w-3 h-3 text-primary" /> End Time
                </Label>
                <Input 
                  type="time" 
                  required 
                  className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-lg" 
                  value={formData.endTime} 
                  onChange={e => setFormData({...formData, endTime: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-3 pb-2">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                <Calendar className="w-3 h-3 text-primary" /> Target Deadline Day
              </Label>
              <Input 
                required 
                className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-5 text-base" 
                value={formData.deadlineDay} 
                onChange={e => setFormData({...formData, deadlineDay: e.target.value})} 
                placeholder="e.g. Wednesday" 
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="ghost" 
                type="button" 
                onClick={() => setOpen(false)} 
                className="flex-1 h-14 rounded-2xl font-bold text-muted-foreground"
              >
                Cancel
              </Button>
              <Button 
                disabled={isPending} 
                type="submit" 
                className="flex-[2] h-14 rounded-2xl font-heading font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
              >
                {isPending ? 'Updating...' : 'Update Study Block'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
