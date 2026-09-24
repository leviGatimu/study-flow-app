import Link from 'next/link';
import { Target } from 'lucide-react';

import { Panel, PanelTitle } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Today's completion as a ring. With nothing scheduled there is nothing to
 * measure, so it says that instead of showing a hollow 100%.
 */
export function ProgressWidget({ percentage, completed, total }: { percentage: number; completed: number; total: number }) {
  const isComplete = total > 0 && completed === total;
  const pct = total === 0 ? 0 : percentage;

  return (
    <Panel interactive>
      <PanelTitle
        icon={<Target />}
        action={
          <Link href="/history" className="text-sm font-medium text-primary hover:underline">
            History
          </Link>
        }
      >
        Today&apos;s progress
      </PanelTitle>

      <div className="flex items-center gap-6">
        <div className="relative size-28 shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle className="text-muted stroke-current" strokeWidth="8" cx="50" cy="50" r={RADIUS} fill="transparent" />
            <circle
              className={cn('stroke-current transition-[stroke-dashoffset] duration-700 ease-out', isComplete ? 'text-success' : 'text-primary')}
              strokeWidth="8"
              strokeLinecap="round"
              cx="50"
              cy="50"
              r={RADIUS}
              fill="transparent"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
            />
          </svg>
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center font-heading text-2xl font-black tabular-nums',
              isComplete ? 'text-success' : 'text-foreground'
            )}
          >
            {total === 0 ? '–' : `${pct}%`}
          </span>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="font-heading text-lg font-bold">
            {total === 0 ? 'A free day' : isComplete ? 'All done for today' : `${total - completed} left to do`}
          </p>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'Nothing is scheduled today.'
              : `${completed} of ${total} ${total === 1 ? 'block' : 'blocks'} finished.`}
          </p>
        </div>
      </div>
    </Panel>
  );
}
