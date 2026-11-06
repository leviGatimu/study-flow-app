'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ClashInfo, ClashResolution } from '@/lib/schedule-clash';

/** Shown instead of saving when a new or moved block lands on another one. */
export function ClashDialog({
  clash,
  subject,
  routine = false,
  busy = false,
  onChoose,
  onCancel,
}: {
  clash: ClashInfo | null;
  subject: string;
  /** Replacing removes a repeating block, not just one day's. */
  routine?: boolean;
  busy?: boolean;
  onChoose: (resolution: ClashResolution) => void;
  onCancel: () => void;
}) {
  const names = [...new Set(clash?.blocks.map((block) => block.subject) ?? [])].join(' and ');
  return (
    <Dialog open={clash !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{names} {(clash?.blocks.length ?? 0) > 1 ? 'are' : 'is'} already at this time</DialogTitle>
          <DialogDescription>{subject} can&apos;t run at the same time. Choose what to do.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
          {clash?.blocks.map((block) => (
            <li key={`${block.subject}-${block.startTime}`} className="flex justify-between gap-4 px-3 py-2">
              <span className="min-w-0 truncate font-medium">{block.subject}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{block.startTime} – {block.endTime}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {clash?.suggestion ? (
            <Button disabled={busy} onClick={() => onChoose('next-free')}>
              Move {subject} to {clash.suggestion.startTime} – {clash.suggestion.endTime}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">There is no free time left that day for a block this long.</p>
          )}
          <Button variant="outline" disabled={busy} onClick={() => onChoose('replace')}>
            {routine ? `Remove ${names} from your routine` : `Replace ${names} for that day`}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
