'use client';

import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, Monitor, Globe, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  cancelMirrorAction,
  disconnectSync,
  getMirrorUndo,
  previewMirrorAction,
  runMirrorAction,
  undoMirrorAction,
  type MirrorPreview,
} from '@/lib/sync/actions';
import type { MirrorDirection } from '@/lib/sync/mirror-client';

const COPY: Record<MirrorDirection, { title: string; action: string; other: string; source: string }> = {
  'web-matches-desktop': {
    title: 'Make the website match this app',
    action: 'Make the website match',
    other: 'the website',
    source: 'this app',
  },
  'desktop-matches-web': {
    title: 'Make this app match the website',
    action: 'Make this app match',
    other: 'this app',
    source: 'the website',
  },
};

/** The two buttons in Settings, and undo once one has been used. */
export function SyncMirrorControls({ onChanged }: { onChanged: () => void }) {
  const [direction, setDirection] = useState<MirrorDirection | null>(null);
  const [undo, setUndo] = useState<Awaited<ReturnType<typeof getMirrorUndo>>>(null);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [pending, startTransition] = useTransition();

  const refreshUndo = () => getMirrorUndo().then(setUndo).catch(() => setUndo(null));
  useEffect(() => {
    void refreshUndo();
  }, []);

  const runUndo = () =>
    startTransition(async () => {
      const result = await undoMirrorAction().catch(() => ({ error: 'Could not reach the website. Nothing was changed; try again.' }));
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      setConfirmingUndo(false);
      toast.success('Both sides are back as they were.');
      await refreshUndo();
      onChanged();
    });

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">Make both sides the same</p>
        <p className="text-sm text-muted-foreground">
          Automatic sync combines changes from both sides. Use one of these when you know which side is right: the other
          side becomes an exact copy, including removing what the right side does not have. You see what will change first.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="justify-start gap-2" onClick={() => setDirection('web-matches-desktop')}>
          <Globe className="size-4" /> {COPY['web-matches-desktop'].title}
        </Button>
        <Button variant="outline" className="justify-start gap-2" onClick={() => setDirection('desktop-matches-web')}>
          <Monitor className="size-4" /> {COPY['desktop-matches-web'].title}
        </Button>
      </div>

      {undo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm">
          <span className="text-muted-foreground">
            Last used {format(new Date(undo.at), 'd MMM, HH:mm')}: {COPY[undo.direction].title.toLowerCase()}.
          </span>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setConfirmingUndo(true)}>
            <Undo2 className="size-4" /> Undo
          </Button>
        </div>
      )}

      <MirrorDialog
        direction={direction}
        onClose={() => setDirection(null)}
        onDone={() => {
          void refreshUndo();
          onChanged();
        }}
      />

      <Dialog open={confirmingUndo} onOpenChange={(open) => !open && !pending && setConfirmingUndo(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Undo and put both sides back?</DialogTitle>
            <DialogDescription>
              The website and this app go back to how they were before that copy. Anything you changed on either side since
              then is lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirmingUndo(false)}>Keep things as they are</Button>
            <Button disabled={pending} className="gap-2" onClick={runUndo}>
              {pending && <Loader2 className="size-4 animate-spin" />} Put both sides back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Shows what will change, then does it. `justConnected` means the device was
 * connected only to run this, so backing out disconnects it again: otherwise
 * automatic sync would start combining right after the student said no.
 */
export function MirrorDialog({
  direction,
  justConnected = false,
  onClose,
  onDone,
}: {
  direction: MirrorDirection | null;
  justConnected?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<MirrorPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadedFor, setLoadedFor] = useState<MirrorDirection | null>(null);

  // Reset when a different direction is opened, as React recommends over an effect.
  if (direction !== loadedFor) {
    setLoadedFor(direction);
    setPreview(null);
    setError(null);
    setConfirmEmpty(false);
  }

  useEffect(() => {
    if (!direction) return;
    let cancelled = false;
    previewMirrorAction(direction)
      .then((result) => {
        if (cancelled) return;
        if ('error' in result) setError(result.error);
        else setPreview(result);
      })
      .catch(() => !cancelled && setError('Could not reach the website. Check your connection and try again.'));
    return () => {
      cancelled = true;
    };
  }, [direction]);

  const copy = direction ? COPY[direction] : null;
  const nothingToDo = preview?.groups.length === 0;

  const backOut = () =>
    startTransition(async () => {
      await (justConnected ? disconnectSync() : Promise.resolve()).catch(() => null);
      await cancelMirrorAction().catch(() => null);
      onClose();
    });

  const run = () =>
    startTransition(async () => {
      if (!direction) return;
      const result = await runMirrorAction(direction).catch(() => ({ error: 'The connection dropped. Nothing is lost; run it again to continue.' }));
      if ('error' in result) {
        setError(result.error);
        return;
      }
      toast.success(`${copy?.other === 'this app' ? 'This app' : 'The website'} now matches ${copy?.source}.`);
      onClose();
      onDone();
    });

  return (
    <Dialog open={direction !== null} onOpenChange={(open) => !open && !pending && backOut()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>
            {copy && `${copy.other === 'this app' ? 'This app' : 'The website'} will end up with exactly what ${copy.source} has.`}
          </DialogDescription>
        </DialogHeader>

        {!preview && !error && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Comparing both sides. This can take a minute.
          </p>
        )}

        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {preview && nothingToDo && <p className="py-4 text-sm text-muted-foreground">Both sides already match. Nothing needs to change.</p>}

        {preview && !nothingToDo && (
          <>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <caption className="sr-only">What will change on {copy?.other}</caption>
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">On {copy?.other}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Added</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Changed</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Removed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 tabular-nums">
                  {preview.groups.map((group) => (
                    <tr key={group.label}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">{group.label}</th>
                      <td className="px-3 py-2 text-right">{group.add || '–'}</td>
                      <td className="px-3 py-2 text-right">{group.change || '–'}</td>
                      <td className={group.remove ? 'px-3 py-2 text-right font-semibold text-destructive' : 'px-3 py-2 text-right'}>{group.remove || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.sourceLooksEmpty && (
              <label className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">{copy?.source === 'this app' ? 'This app' : 'The website'} has far less than {copy?.other}, so this removes most of what is there. Are you sure it is the right side?</span>
                <input type="checkbox" className="mt-0.5 size-4" checked={confirmEmpty} onChange={(e) => setConfirmEmpty(e.target.checked)} aria-label="Yes, this is the right side" />
              </label>
            )}

            <p className="text-xs text-muted-foreground">
              A copy of both sides is saved on this computer first, so you can undo this afterwards. Songs, sticky notes, projects and AI notes stay on each side as they are, because they do not sync.
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={backOut}>{nothingToDo ? 'Close' : 'Cancel'}</Button>
          {preview && !nothingToDo && (
            <Button disabled={pending || (preview.sourceLooksEmpty && !confirmEmpty)} className="gap-2" onClick={run}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Copying…' : error ? 'Run it again' : copy?.action}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
