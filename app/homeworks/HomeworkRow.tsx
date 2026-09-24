'use client';

import Link from 'next/link';
import { CalendarClock, Check, ExternalLink, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { daysUntil, formatDay, relativeDue, type HomeworkItem } from './homework-model';

interface HomeworkRowProps {
  homework: HomeworkItem;
  today: string;
  /** Tailwind background class for the subject's dot. */
  dotClass: string;
  /** False in an archived year: the row becomes read-only. */
  canEdit: boolean;
  onComplete: (hw: HomeworkItem) => void;
  onPlan: (hw: HomeworkItem) => void;
  onDelete: (hw: HomeworkItem) => void;
}

export function HomeworkRow({ homework: hw, today, dotClass, canEdit, onComplete, onPlan, onDelete }: HomeworkRowProps) {
  const done = hw.isCompleted;
  const late = !done && daysUntil(hw.dueDay, today) < 0;
  const dueToday = !done && hw.dueDay === today;

  return (
    <li className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
      {done ? (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" aria-hidden />
          <span className="sr-only">Completed</span>
        </span>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => onComplete(hw)}
          aria-label={`Complete "${hw.title}"`}
          title="Mark complete (upload proof)"
          className={cn(
            'group/check mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            late ? 'border-destructive/60 hover:bg-destructive/10' : 'border-muted-foreground/40 hover:border-success hover:bg-success/10'
          )}
        >
          <Check className="size-3.5 text-success opacity-0 transition-opacity group-hover/check:opacity-100 group-focus-visible/check:opacity-100" aria-hidden />
        </button>
      ) : (
        <span className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-muted-foreground/25" aria-hidden />
      )}

      {/* On phones the due date drops under the title instead of taking a column. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium text-foreground', done && 'text-muted-foreground')}>{hw.title}</p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Link
              href={`/subjects?subject=${encodeURIComponent(hw.subject)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium text-foreground/80 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn('size-2 rounded-full', dotClass)} aria-hidden />
              {hw.subject}
            </Link>
            {hw.description && (
              <>
                <span aria-hidden className="text-muted-foreground/50">·</span>
                <span className="min-w-0 truncate">{hw.description}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 sm:shrink-0 sm:flex-col sm:items-end sm:gap-0.5 sm:pt-0.5 sm:text-right">
          {done ? (
            <>
              <span className="text-xs text-muted-foreground sm:text-sm">
                {hw.completedDay ? `Done ${formatDay(hw.completedDay, today)}` : 'Done'}
              </span>
              {hw.proofUrl && (
                <a
                  href={hw.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  View proof <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </>
          ) : (
            <>
              <span
                className={cn(
                  'text-xs tabular-nums sm:text-sm',
                  late ? 'font-medium text-destructive' : dueToday ? 'font-medium text-primary' : 'text-foreground'
                )}
              >
                {relativeDue(hw.dueDay, today)}
              </span>
              {hw.plannedDay && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" aria-hidden />
                  Planned {hw.plannedDay === today ? 'today' : formatDay(hw.plannedDay, today)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {canEdit && (
        // Hidden until hover or focus only where hovering exists; on touch
        // screens they stay visible, and keyboard focus always reveals them.
        <div className="-my-0.5 flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
          {!done && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPlan(hw)}
              aria-label={`Plan a study day for "${hw.title}"`}
              title="Plan a study day"
              className="text-muted-foreground hover:text-foreground"
            >
              <CalendarClock />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(hw)}
            aria-label={`Delete "${hw.title}"`}
            title="Delete"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
}
