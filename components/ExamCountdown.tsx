'use client';

import { useState, useTransition } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Trophy, Calendar as CalendarIcon, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEvent, deleteEvent } from '@/lib/actions';
import { ConfirmModal } from '@/components/ConfirmModal';
import Link from 'next/link';

type ExamEvent = {
  id: string;
  title: string;
  date: Date;
  priority: string;
};

export function ExamCountdown({ events }: { events: ExamEvent[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({ title: '', date: '', priority: 'NORMAL' });
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nearestEvent = upcomingEvents[0];
  const daysLeft = nearestEvent ? differenceInDays(new Date(nearestEvent.date), new Date(new Date().setHours(0,0,0,0))) : null;

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

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEventToDelete(id);
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-shadow duration-200">
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <Link href="/exams" className="hover:text-primary transition-colors">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            Upcoming Exams <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2" />
          </h3>
        </Link>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Add exam event" title="Add exam event" className="h-8 w-8 rounded-full hover:bg-primary/10">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading font-bold">Add major event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label htmlFor="event-title" className="text-xs font-medium text-muted-foreground">Event title</Label>
                <Input id="event-title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Finals: Physics Paper 1" className="rounded-xl h-12" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-date" className="text-xs font-medium text-muted-foreground">Date</Label>
                  <Input id="event-date" type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-priority" className="text-xs font-medium text-muted-foreground">Priority</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})}>
                    <SelectTrigger id="event-priority" className="rounded-xl h-12 font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button disabled={isPending} type="submit" className="w-full h-12 rounded-xl font-bold text-sm shadow-sm">Save event</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4 relative z-10">
        {nearestEvent ? (
          <Link href="/exams">
            <div className="flex flex-col items-center text-center p-4 bg-primary/5 rounded-2xl border border-primary/10 hover:bg-primary/10 transition-colors">
              <Trophy className="w-10 h-10 text-primary mb-3" />
              <p className="text-xs font-medium text-primary mb-1">{nearestEvent.title}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-heading font-black text-foreground">{daysLeft}</span>
                <span className="text-xl font-bold text-muted-foreground">Days</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3" /> {format(new Date(nearestEvent.date), 'MMMM do, yyyy')}
              </p>
            </div>
          </Link>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No upcoming exams set.
          </div>
        )}

        {upcomingEvents.length > 1 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground px-1">Other milestones</p>
            {upcomingEvents.slice(1, 4).map(event => (
              <Link key={event.id} href="/exams">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors group/item mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${event.priority === 'HIGH' ? 'bg-destructive' : 'bg-primary'}`} />
                    <div>
                      <p className="text-sm font-bold text-foreground line-clamp-1">{event.title}</p>
                      <p className="text-xs font-medium text-muted-foreground">{format(new Date(event.date), 'MMM d')}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete event"
                    className="h-7 w-7 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDelete(e, event.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={eventToDelete !== null}
        onClose={() => setEventToDelete(null)}
        isPending={isPending}
        onConfirm={() => {
          const id = eventToDelete;
          if (id) {
            startTransition(async () => {
              await deleteEvent(id);
            });
          }
          setEventToDelete(null);
        }}
        title="Delete this event?"
        description="This event will be permanently removed from your countdown. You cannot undo this action."
      />
    </div>
  );
}
