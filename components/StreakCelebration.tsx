'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, Flame, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface StreakStats {
  tasksCompleted: number;
  totalTasks: number;
  focusMinutes: number;
  xpEarned: number;
}

interface StreakCelebrationProps {
  currentStreak: number;
  stats: StreakStats | null;
  onClose: () => void;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Shown once, on the first dashboard load after the streak grew: the new
 * streak and what yesterday's work added up to.
 *
 * It is a plain dialog in the Home page's language (a card, a font-black hero
 * number, the muted tiles the dashboard uses) - no full-screen takeover, no
 * animation to sit through or skip. Orange stays because it reports the
 * streak, the same colour the header's flame uses.
 */
export function StreakCelebration({ currentStreak, stats, onClose }: StreakCelebrationProps) {
  const tiles = stats
    ? [
        {
          icon: <CheckCircle2 className="size-4 text-success" />,
          label: 'Tasks done',
          value: (
            <>
              {stats.tasksCompleted}
              <span className="text-lg font-bold text-muted-foreground">/{stats.totalTasks}</span>
            </>
          ),
        },
        {
          icon: <Clock className="size-4 text-primary" />,
          label: 'Focused',
          value: formatMinutes(stats.focusMinutes),
        },
        {
          icon: <Sparkles className="size-4 text-primary" />,
          label: 'XP earned',
          value: `+${stats.xpEarned.toLocaleString()}`,
        },
      ]
    : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="px-6 pt-8 pb-6 text-center border-b border-border/40">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <Flame className="size-8 text-orange-500 fill-orange-500/30" />
          </span>
          <p className="mt-4 flex items-baseline justify-center gap-2">
            <span className="font-heading text-6xl font-black tracking-tight tabular-nums">{currentStreak}</span>
            <span className="text-xl font-bold text-muted-foreground">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </p>
          <DialogTitle className="mt-1 font-heading text-2xl font-bold">
            Your streak grew
          </DialogTitle>
          <DialogDescription className="mt-1 text-base font-medium text-muted-foreground">
            Yesterday counted. Keep it going today.
          </DialogDescription>
        </div>

        <div className="px-6 py-6 space-y-6">
          {tiles.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold text-muted-foreground">Yesterday</p>
              <div className="grid grid-cols-3 gap-3">
                {tiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-2xl border border-border/40 bg-muted/40 px-2 py-4 text-center sm:px-3"
                  >
                    <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {tile.icon}
                      {tile.label}
                    </p>
                    <p className="mt-1.5 font-heading text-xl sm:text-2xl font-black tabular-nums">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button asChild variant="outline" size="lg" className="h-11 sm:flex-1">
              <Link href="/streak" onClick={onClose}>
                See your streak
              </Link>
            </Button>
            <Button size="lg" className="h-11 sm:flex-1" onClick={onClose} autoFocus>
              Start today
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
