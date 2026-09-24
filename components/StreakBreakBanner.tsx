'use client';

import { useTransition } from 'react';
import { resumeStreak } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';

/**
 * Shown when the streak is frozen because the user's marked last day of school
 * has passed. Lets them resume so the streak continues from its frozen value.
 * Amber reports the paused state; it is status, not decoration.
 */
export function StreakBreakBanner({ paused, currentStreak = 0 }: { paused?: boolean; currentStreak?: number }) {
  const [isPending, startTransition] = useTransition();

  if (!paused) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/15">
          <Pause className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="font-heading font-bold text-foreground">Streak paused for the school break</p>
          <p className="text-sm text-muted-foreground">
            Your {currentStreak}-day streak is frozen and safe. Resume it when you are back to studying.
          </p>
        </div>
      </div>
      <Button onClick={() => startTransition(() => resumeStreak())} disabled={isPending} className="shrink-0">
        <Play />
        {isPending ? 'Resuming…' : 'Resume streak'}
      </Button>
    </div>
  );
}
