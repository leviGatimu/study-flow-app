'use client';

import { useTransition } from 'react';
import { resumeStreak } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Pause, Flame, Play } from 'lucide-react';

/**
 * Shown when the streak is frozen because the user's marked last day of school
 * has passed. Lets them resume so the streak continues from its frozen value.
 */
export function StreakBreakBanner({ paused, currentStreak = 0 }: { paused?: boolean; currentStreak?: number }) {
  const [isPending, startTransition] = useTransition();

  if (!paused) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-amber-500/10 border border-amber-500/25 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
            <Pause className="w-6 h-6 text-amber-600" />
          </div>
        </div>
        <div>
          <p className="font-heading font-black text-foreground uppercase tracking-tight flex items-center gap-2">
            Streak Paused — School Break
          </p>
          <p className="text-sm font-semibold text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            Your {currentStreak}-day streak is safe and frozen. Resume when you&apos;re back to studying.
          </p>
        </div>
      </div>
      <Button
        onClick={() => startTransition(() => resumeStreak())}
        disabled={isPending}
        className="h-11 px-6 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-bold text-sm gap-2 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
      >
        <Play className="w-4 h-4 fill-current" /> {isPending ? 'Resuming…' : 'Resume Streak'}
      </Button>
    </div>
  );
}
