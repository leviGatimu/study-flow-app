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
import { useIsArchived } from '@/components/ArchiveContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface HomeworkCardProps {
  homework: Homework;
}

export function HomeworkCard({ homework }: HomeworkCardProps) {
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const archived = useIsArchived();

  const isOverdue = !homework.isCompleted && isPast(new Date(homework.dueDate)) && !isToday(new Date(homework.dueDate));

  // Single source of truth for the card's accent so bar and chips stay in sync.
  const accent = homework.isCompleted
    ? { bar: 'bg-success', chip: 'bg-success/10 text-success border-success/20' }
    : isOverdue
    ? { bar: 'bg-destructive', chip: 'bg-destructive/10 text-destructive border-destructive/20' }
    : { bar: 'bg-primary', chip: 'bg-primary/10 text-primary border-primary/20' };

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
      <div className={cn(
        "group relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex flex-col rounded-2xl",
        homework.isCompleted
          ? "bg-card border-success/20"
          : "bg-card border-border/60"
      )}>
        {/* Status bar */}
        <div className={cn("absolute top-0 left-0 w-1.5 h-full", accent.bar, homework.isCompleted && "opacity-60")} />

        <div className="p-6 flex-1 flex flex-col relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={cn("px-3 py-1 rounded-lg text-xs font-medium border", accent.chip)}>
                {homework.subject}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" /> Overdue
                </span>
              )}
              {homework.isCompleted && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </span>
              )}
            </div>

            {!archived && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete homework"
                onClick={handleDelete}
                disabled={isDeleting}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 -mr-1 -mt-1"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            )}
          </div>

          {/* Title + description */}
          <h3 className={cn(
            "text-lg font-bold font-heading tracking-tight text-foreground mt-4 leading-snug",
            homework.isCompleted && "text-muted-foreground line-through opacity-60"
          )}>
            {homework.title}
          </h3>
          {homework.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {homework.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-5 mt-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">Due</span>
                <span className={cn("text-sm font-semibold mt-0.5", isOverdue ? "text-destructive" : "text-foreground")}>
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
                <span className="text-xs font-medium text-muted-foreground">Planned</span>
                <span className="text-sm font-semibold text-foreground mt-0.5">
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
                  {!archived && (
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 h-11 rounded-xl font-bold text-xs gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors duration-200">
                        <Clock className="w-4 h-4" /> Plan
                      </Button>
                    </DialogTrigger>
                  )}
                  <DialogContent className="sm:max-w-md rounded-2xl p-8 border shadow-2xl bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-heading font-bold text-foreground">Plan session</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePlan} className="space-y-6 pt-4">
                      <div className="space-y-2.5">
                        <Label htmlFor={`plannedDate-${homework.id}`} className="text-xs font-medium text-muted-foreground ml-1">Select date</Label>
                        <Input
                          id={`plannedDate-${homework.id}`}
                          type="date"
                          name="plannedDate"
                          defaultValue={homework.plannedDate ? format(new Date(homework.plannedDate), 'yyyy-MM-dd') : ''}
                          required
                          className="h-12 rounded-xl bg-muted/50 text-base font-medium focus:ring-4 focus:ring-primary/5"
                        />
                      </div>
                      <Button type="submit" disabled={isPlanning} className="w-full h-12 rounded-xl font-bold text-sm shadow-sm">
                        {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save plan'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  {!archived && (
                    <DialogTrigger asChild>
                      <Button className="flex-1 h-11 rounded-xl font-bold text-xs gap-2 shadow-sm transition-all">
                        <CheckCircle2 className="w-4 h-4" /> Complete
                      </Button>
                    </DialogTrigger>
                  )}
                  <DialogContent className="sm:max-w-md rounded-2xl p-8 border shadow-2xl bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-heading font-bold text-foreground">Finish homework</DialogTitle>
                    </DialogHeader>
                    <form action={handleComplete} className="space-y-6 pt-4">
                      <input type="hidden" name="homeworkId" value={homework.id} />
                      <div className="space-y-4 text-center">
                        <div className="p-10 border-2 border-dashed border-border/40 rounded-2xl bg-muted/5">
                           <FileUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                           <p className="text-sm font-semibold text-muted-foreground">Upload proof (PDF or image)</p>
                           <p className="text-xs text-muted-foreground/60 mt-1">Select a screenshot or document of completed work</p>
                        </div>
                        <Input
                          type="file"
                          name="file"
                          aria-label="Upload proof of completed homework"
                          accept="image/*,application/pdf"
                          required
                          className="cursor-pointer h-12 rounded-xl text-sm font-medium bg-muted/50"
                        />
                      </div>
                      <Button type="submit" disabled={isCompleting} className="w-full h-12 rounded-xl font-bold text-sm shadow-sm">
                        {isCompleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Submit & finish'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-success">Completed</span>
                  <span className="text-xs text-muted-foreground/70 mt-0.5">
                    {homework.completedAt ? format(new Date(homework.completedAt), 'MMM dd, yyyy') : ''}
                  </span>
                </div>
                {homework.proofUrl && (
                  <Button variant="outline" size="sm" asChild className="rounded-xl font-bold text-xs gap-2 h-11 px-4 hover:bg-primary/5 hover:text-primary transition-all">
                    <a href={homework.proofUrl} target="_blank" rel="noopener noreferrer">
                      View proof <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
