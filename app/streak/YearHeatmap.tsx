'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { formatMinutes } from '@/lib/schedule-layout';
import type { HeatWeek } from '@/lib/streak-heatmap';
import { cn } from '@/lib/utils';

const SHADES = ['bg-muted', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'] as const;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

const label = (key: string) => format(new Date(`${key}T12:00:00`), 'EEE d MMM yyyy');

/**
 * A year of study days, one square per day, darker for longer days. The
 * squares stretch to fill the panel; on a phone the grid keeps a readable
 * minimum size, scrolls sideways and starts at the newest week.
 */
export function YearHeatmap({ weeks }: { weeks: HeatWeek[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollLeft = box.scrollWidth;
  }, []);

  return (
    <div>
      <div ref={scroller} className="scrollbar-none overflow-x-auto pb-1">
        <div
          role="grid"
          aria-label="Study days over the last year"
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, minmax(11px, 1fr))`,
            gridTemplateRows: 'auto repeat(7, auto)',
            gridAutoFlow: 'column',
            minWidth: `${weeks.length * 14 + 32}px`,
          }}
        >
          <span />
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="flex items-center pr-2 text-[10px] leading-none text-muted-foreground">
              {d}
            </span>
          ))}
          {weeks.map((week, w) => [
            <span key={`m${w}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] leading-4 text-muted-foreground">
              {week.month ?? ''}
            </span>,
            ...week.cells.map((cell) => {
              const text = cell.future
                ? undefined
                : `${label(cell.key)}: ${cell.minutes ? formatMinutes(cell.minutes) : cell.level ? 'studied' : 'no study'}`;
              return (
                <span
                  key={cell.key}
                  role="gridcell"
                  title={text}
                  aria-label={text}
                  className={cn(
                    'aspect-square w-full rounded-[3px]',
                    cell.future ? 'bg-transparent' : SHADES[cell.level],
                    !cell.future && cell.level === 0 && 'border border-border/50'
                  )}
                />
              );
            }),
          ])}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        Less
        {SHADES.map((shade, i) => (
          <span key={shade} className={cn('size-3 rounded-[3px]', shade, i === 0 && 'border border-border/50')} />
        ))}
        More
      </div>
    </div>
  );
}
