'use client';

import { useState } from 'react';
import { Homework } from '@/lib/types';
import { format, isPast, isToday } from 'date-fns';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileUp,
  Trash2,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { planHomework, completeHomework, deleteHomework } from '@/lib/homework-actions';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface HomeworkCardProps {
  homework: Homework;
}

export function HomeworkCard({ homework }: HomeworkCardProps) {
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOverdue = !homework.isCompleted && isPast(new Date(homework.dueDate)) && !isToday(new Date(homework.dueDate));

  // Single source of truth for the card's accent so bar, glow and chips stay in sync.
  const accent = homework.isCompleted
    ? { bar: 'bg-emerald-500', glow: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', text: 'text-emerald-500' }
    : isOverdue
    ? { bar: 'bg-destructive', glow: 'bg-destructive', chip: 'bg-destructive/10 text-destructive border-destructive/20', text: 'text-destructive' }
    : { bar: 'bg-primary', glow: 'bg-primary', chip: 'bg-primary/10 text-primary border-primary/20', text: 'text-primary' };

  async function handlePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get('plannedDate') as string;
    const date = new Date(dateStr);

    setIsPlanning(true);
    try {
      await planHomework(homework.id, date);
      toast.success('Study session planned');
    } catch {
      toast.error('Failed to plan');
    } finally {
      setIsPlanning(false);
    }
  }

  async function handleComplete(formData: FormData) {
    setIsCompleting(true);
    try {
      const result = await completeHomework(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Homework completed! +200 XP');
      }
    } catch {
      toast.error('Failed to complete');
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this homework?')) return;
    setIsDeleting(true);
    try {
      await deleteHomework(homework.id);
      toast.success('Homework deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="h-full"
    >
      <Card className={cn(
        "relative overflow-hidden border transition-all duration-300 group h-full flex flex-col rounded-[28px] shadow-sm",
        homework.isCompleted
          ? "bg-card border-emerald-500/20"
          : "bg-card hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30"
      )}>
        {/* Accent glow + status bar */}
        <div className={cn("absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-[0.07] -z-0 translate-x-1/3 -translate-y-1/3", accent.glow)} />
        <div className={cn("absolute top-0 left-0 w-1.5 h-full", accent.bar, homework.isCompleted && "opacity-60")} />

        <div className="p-6 flex-1 flex flex-col relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={cn("px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border", accent.chip)}>
                {homework.subject}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1.5 text-[11px] font-black text-destructive uppercase tracking-wider">
                  <AlertCircle className="w-3.5 h-3.5" /> Overdue
                </span>
              )}
              {homework.isCompleted && (
                <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-500 uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 -mr-1 -mt-1"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Title + description */}
          <h3 className={cn(
            "text-xl font-black font-heading tracking-tight text-foreground mt-4 leading-snug",
            homework.isCompleted && "text-muted-foreground line-through opacity-60"
          )}>
            {homework.title}
          </h3>
          {homework.description && (
            <p className="text-sm text-muted-foreground/80 font-medium line-clamp-2 mt-2">
              {homework.description}
            </p>
          )}

          {/* Meta row — light icon chips instead of heavy grey boxes */}
          <div className="flex items-center gap-5 mt-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Due</span>
                <span className={cn("text-sm font-black mt-0.5", isOverdue ? "text-destructive" : "text-foreground")}>
                  {format(new Date(homework.dueDate), 'MMM dd')}
                </span>
              </div>
            </div>

            <div className="h-9 w-px bg-border/60" />

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Planned</span>
                <span className="text-sm font-black text-foreground mt-0.5">
                  {homework.plannedDate ? format(new Date(homework.plannedDate), 'MMM dd') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer / actions pinned to bottom */}
          <div className="mt-auto pt-5 border-t border-border/40">
            {!homework.isCompleted ? (
              <div className="flex items-center gap-3 pt-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 h-12 rounded-2xl font-black text-xs gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200">
                      <Clock className="w-4 h-4" /> PLAN
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl p-8 border shadow-2xl bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-heading font-black text-foreground uppercase tracking-tight">Plan Session</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePlan} className="space-y-6 pt-4">
                      <div className="space-y-2.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Select Date</Label>
                        <Input
                          type="date"
                          name="plannedDate"
                          defaultValue={homework.plannedDate ? format(new Date(homework.plannedDate), 'yyyy-MM-dd') : ''}
                          required
                          className="h-14 rounded-2xl bg-muted/50 text-base font-bold focus:ring-4 focus:ring-primary/5"
                        />
                      </div>
                      <Button type="submit" disabled={isPlanning} className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/10">
                        {isPlanning ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SAVE PLAN'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="flex-1 h-12 rounded-2xl font-black text-xs gap-2 shadow-md shadow-primary/5 hover:scale-[1.01] transition-all">
                      <CheckCircle2 className="w-4 h-4" /> COMPLETE
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl p-8 border shadow-2xl bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-heading font-black text-foreground uppercase tracking-tight">Finish Homework</DialogTitle>
                    </DialogHeader>
                    <form action={handleComplete} className="space-y-6 pt-4">
                      <input type="hidden" name="homeworkId" value={homework.id} />
                      <div className="space-y-4 text-center">
                        <div className="p-10 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                           <FileUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                           <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">Upload Proof (PDF/Image)</p>
                           <p className="text-xs text-muted-foreground/60 mt-1">Select a screenshot or document of completed work</p>
                        </div>
                        <Input
                          type="file"
                          name="file"
                          accept="image/*,application/pdf"
                          required
                          className="cursor-pointer h-14 rounded-2xl text-base font-bold bg-muted/50"
                        />
                      </div>
                      <Button type="submit" disabled={isCompleting} className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/10">
                        {isCompleting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'SUBMIT & FINISH'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase text-emerald-500 tracking-widest">Completed</span>
                  <span className="text-xs font-semibold text-muted-foreground/70 mt-0.5">
                    {homework.completedAt ? format(new Date(homework.completedAt), 'MMM dd, yyyy') : ''}
                  </span>
                </div>
                {homework.proofUrl && (
                  <Button variant="outline" size="sm" asChild className="rounded-xl font-black text-xs gap-2 h-11 px-4 hover:bg-primary/5 hover:text-primary transition-all">
                    <a href={homework.proofUrl} target="_blank" rel="noopener noreferrer">
                      VIEW PROOF <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
