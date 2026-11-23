'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SubjectIcon, subjectStyle } from '@/components/subjects/SubjectIcon';
import { cn } from '@/lib/utils';

export type SaveStatus = 'saved' | 'saving' | 'error';

/**
 * The full-screen room a practice run (or flashcards) happens in: a soft,
 * slowly drifting wash in the subject's colour behind frosted glass, a slim
 * header with the way out, and the run itself.
 */
export function PracticeWorkspace({ title, subject, mode, saveStatus, busy, onLeave, onRetry, children }: {
  title: string; subject: string; mode: string; saveStatus?: SaveStatus; busy?: boolean;
  onLeave?: () => void; onRetry?: () => void; children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const look = subjectStyle(subject);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFullscreen = async () => {
    try {
      setFullscreenError('');
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setFullscreenError('Your browser does not support fullscreen. The workspace still fills this window.');
    } catch { setFullscreenError('Fullscreen was unavailable. You can keep practising in this window.'); }
  };
  return (
    <Dialog open>
      <DialogContent ref={root} showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}
        // Focus starts on the paper, not on Save & exit: Enter must never leave by accident.
        onOpenAutoFocus={(e) => { e.preventDefault(); root.current?.focus(); }}
        className="practice-workspace left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 sm:max-w-none">
        {/* Ambient wash in the subject's colour, drifting slowly behind everything. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={cn('practice-blob absolute -left-32 -top-40 size-[34rem] rounded-full opacity-60 blur-[110px] dark:opacity-40', look.classes.tile)} />
          <div className="practice-blob practice-blob-slow absolute -bottom-48 -right-24 size-[38rem] rounded-full bg-primary/20 opacity-70 blur-[120px] dark:bg-primary/25" />
          <div className={cn('practice-blob absolute left-1/2 top-1/3 size-[22rem] -translate-x-1/2 rounded-full opacity-30 blur-[100px] dark:opacity-25', look.classes.tile)} />
        </div>

        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border/50 bg-background/60 px-3 py-2.5 backdrop-blur-xl sm:px-6">
          {onLeave && (
            <Button variant="outline" disabled={busy} onClick={onLeave} className="rounded-full bg-background/60">
              <ArrowLeft /><span className="hidden sm:inline">Save & exit</span><span className="sm:hidden">Exit</span>
            </Button>
          )}
          <SubjectIcon name={subject} className="hidden size-9 rounded-xl sm:grid" iconClassName="!size-4.5" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="truncate text-xs">{subject} · {mode}</DialogDescription>
          </div>
          {saveStatus && (
            <div role="status" className="hidden shrink-0 items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
              {saveStatus === 'saving'
                ? <><Loader2 className="size-3.5 animate-spin" />Saving…</>
                : saveStatus === 'error'
                  ? <><CloudOff className="size-3.5 text-destructive" />Not saved <button className="font-semibold text-primary underline" onClick={onRetry}>Retry</button></>
                  : <><CloudCheck className="size-3.5" />Saved</>}
            </div>
          )}
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </header>
        {fullscreenError && <p role="status" className="relative z-10 border-b bg-muted px-6 py-2 text-sm">{fullscreenError}</p>}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 sm:px-6 sm:py-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
