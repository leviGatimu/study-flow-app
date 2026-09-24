import * as React from 'react';
import { BookOpen, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/list-row';

/**
 * The Schedule section's one convention for a study block, shared by Week,
 * Month and Study routine so a block reads the same on all three:
 * HOMEWORK is a solid primary border, REVISION a dashed orange one. Done and
 * missed override the type colour, because on a past day the outcome is what
 * matters.
 */
export type BlockStatus = 'open' | 'done' | 'missed';

export function statusOf(task: { isDone: boolean; isMissed: boolean }): BlockStatus {
  if (task.isDone) return 'done';
  if (task.isMissed) return 'missed';
  return 'open';
}

export function studyBlockClass(type: string, status: BlockStatus = 'open') {
  const isRevision = type === 'REVISION';
  return cn(
    'rounded-xl border-2 bg-card',
    isRevision ? 'border-dashed' : 'border-solid',
    status === 'done'
      ? 'border-success/50 bg-success/5'
      : status === 'missed'
        ? 'border-destructive/40 bg-destructive/5'
        : isRevision
          ? 'border-orange-500/60'
          : 'border-primary/60'
  );
}

export function StudyTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type === 'REVISION' ? Repeat : BookOpen;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        'size-4 shrink-0',
        type === 'REVISION' ? 'text-orange-600 dark:text-orange-400' : 'text-primary',
        className
      )}
    />
  );
}

/** "Homework" / "Revision", or the outcome once there is one. */
export function StudyTypePill({ type, status = 'open' }: { type: string; status?: BlockStatus }) {
  if (status === 'done') return <Pill tone="success">Done</Pill>;
  if (status === 'missed') return <Pill tone="danger">Missed</Pill>;
  return type === 'REVISION' ? (
    <Pill tone="warning">Revision</Pill>
  ) : (
    <Pill tone="primary">Homework</Pill>
  );
}

/** The key under a grid, so the border styles are never a guessing game. */
export function StudyLegend({ extra }: { extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 rounded border-2 border-primary/60" />
        Homework
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 rounded border-2 border-dashed border-orange-500/60" />
        Revision
      </span>
      {extra}
    </div>
  );
}
