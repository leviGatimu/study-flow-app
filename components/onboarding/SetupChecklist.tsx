'use client';

/**
 * What is still missing, said out loud, on the page the user actually looks at.
 *
 * The wizard can be skipped - deliberately - so something has to remember what
 * was skipped and keep offering it without becoming nagging. This is that
 * something, and it obeys three rules:
 *
 *   It only claims what it can prove. Every item is derived from real data (is
 *   there a subject? is a key saved?), never from "did they click past this
 *   step", so it cannot go on congratulating you for a subject you deleted.
 *
 *   Optional is visibly optional. Term dates and the school timetable are
 *   listed as nice-to-haves and never count against you.
 *
 *   It can be sent away for good, in one click, and it never comes back
 *   uninvited. Settings keeps a way back in for anyone who changes their mind.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Rocket, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/lib/setup';
import { completeSetup } from '@/lib/setup-actions';

export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();

  const outstanding = items.filter((item) => !item.done);
  const doneCount = items.length - outstanding.length;

  if (hidden || outstanding.length === 0) return null;

  const dismiss = () => {
    // Optimistic: the card goes now, and the write that makes it permanent
    // follows. A failed write costs one more sighting, not a broken page.
    setHidden(true);
    startTransition(async () => {
      await completeSetup();
      router.refresh();
    });
  };

  return (
    <section
      aria-labelledby="setup-checklist-heading"
      className="rounded-3xl border border-primary/30 bg-primary/5 p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="setup-checklist-heading"
            className="flex items-center gap-2 font-heading text-xl font-black tracking-tight"
          >
            <Rocket className="h-5 w-5 text-primary" />
            Finish setting up
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {doneCount} of {items.length} done. The app works without these, but it cannot do much
            for you until they are there.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/setup">
              Continue setup
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={dismiss}
            disabled={isPending}
            aria-label="Hide this checklist for good"
            title="Hide this for good"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.done ? item.href : `/setup?step=${item.step}`}
              className={cn(
                'flex h-full items-start gap-3 rounded-2xl border p-4 transition-colors',
                item.done
                  ? 'border-border/60 bg-card/60'
                  : 'border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  item.done
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500'
                    : 'border-border'
                )}
              >
                {item.done && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-bold',
                      item.done && 'text-muted-foreground line-through'
                    )}
                  >
                    {item.title}
                  </span>
                  {!item.required && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Optional
                    </span>
                  )}
                </span>
                {!item.done && (
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {item.why}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
