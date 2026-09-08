'use client';

import { useId, useState, useTransition } from 'react';
import { createTemplate } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookOpen, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { useIsArchived } from '@/components/ArchiveContext';

export function ManageForm({ subjects = [] }: { subjects?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const archived = useIsArchived();

  const [formData, setFormData] = useState({
    dayOfWeek: "1",
    subject: "",
    startTime: "",
    endTime: "",
    deadlineDay: "Monday",
    type: "HOMEWORK"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      createTemplate({
        ...formData,
        dayOfWeek: parseInt(formData.dayOfWeek, 10)
      });
      setOpen(false);
      // Reset form
      setFormData({
        dayOfWeek: "1",
        subject: "",
        startTime: "",
        endTime: "",
        deadlineDay: "Monday",
        type: "HOMEWORK"
      });
    });
  };

  // Timetable blocks belong to the active year; a finished year's weekly
  // schedule is history.
  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl h-12 px-6 font-heading font-semibold text-base gap-2">
          <Plus className="w-5 h-5" /> Add New Study Block
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border shadow-xl rounded-2xl">
        <div className="bg-card">
          <DialogHeader className="p-8 border-b bg-muted/20">
            <DialogTitle className="text-2xl font-heading font-bold tracking-tight text-foreground">Create Study Block</DialogTitle>
            <p className="text-sm text-muted-foreground">Define a new recurring class or revision session.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-3">
              <Label htmlFor={`${fieldId}-subject`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                <BookOpen className="w-3 h-3 text-primary" /> Subject name
              </Label>
              <Select value={formData.subject} onValueChange={v => setFormData({...formData, subject: v})} required>
                <SelectTrigger id={`${fieldId}-subject`} className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-base">
                  <SelectValue placeholder="Select subject..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-xl font-semibold">
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor={`${fieldId}-day`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                  <Calendar className="w-3 h-3 text-primary" /> Day of week
                </Label>
                <Select value={formData.dayOfWeek} onValueChange={v => setFormData({...formData, dayOfWeek: v})}>
                  <SelectTrigger id={`${fieldId}-day`} className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-xl font-semibold">
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
                <Label htmlFor={`${fieldId}-type`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                  <CheckCircle2 className="w-3 h-3 text-primary" /> Activity type
                </Label>
                <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                  <SelectTrigger id={`${fieldId}-type`} className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-xl font-semibold">
                    <SelectItem value="HOMEWORK">Homework</SelectItem>
                    <SelectItem value="REVISION">Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor={`${fieldId}-start`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                  <Clock className="w-3 h-3 text-primary" /> Start time
                </Label>
                <Input
                  id={`${fieldId}-start`}
                  type="time"
                  required
                  className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-lg"
                  value={formData.startTime}
                  onChange={e => setFormData({...formData, startTime: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor={`${fieldId}-end`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                  <Clock className="w-3 h-3 text-primary" /> End time
                </Label>
                <Input
                  id={`${fieldId}-end`}
                  type="time"
                  required
                  className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-lg"
                  value={formData.endTime}
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3 pb-2">
              <Label htmlFor={`${fieldId}-deadline`} className="text-xs font-medium text-muted-foreground flex items-center gap-2 ml-1">
                <Calendar className="w-3 h-3 text-primary" /> Target deadline day
              </Label>
              <Input
                id={`${fieldId}-deadline`}
                required
                className="h-14 rounded-xl bg-muted/30 border-border/60 font-semibold px-5 text-base"
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
                className="flex-1 h-14 rounded-xl font-medium text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending}
                type="submit"
                className="flex-[2] h-14 rounded-xl font-heading font-semibold text-lg"
              >
                {isPending ? 'Saving...' : 'Save Study Block'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
