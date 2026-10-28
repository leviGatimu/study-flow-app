'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, BookOpenCheck, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export type SaveStatus = 'saved' | 'saving' | 'error';

export function PracticeWorkspace({ title, subject, mode, saveStatus, busy, onLeave, onRetry, children }: {
  title: string; subject: string; mode: string; saveStatus?: SaveStatus; busy?: boolean;
  onLeave?: () => void; onRetry?: () => void; children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
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
        className="practice-workspace left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 sm:max-w-none">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-8">
          {onLeave && <Button variant="outline" disabled={busy} onClick={onLeave}><ArrowLeft /><span className="hidden sm:inline">Save & exit</span><span className="sm:hidden">Exit</span></Button>}
          <BookOpenCheck className="hidden size-5 text-primary md:block" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="mt-1 truncate text-xs">{subject} · {mode}</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
          {saveStatus && <div role="status" className="flex basis-full items-center justify-end gap-2 text-xs text-muted-foreground sm:basis-auto">
            {saveStatus === 'saving' ? <><Loader2 className="size-4 animate-spin" />Saving…</> : saveStatus === 'error' ? <><CloudOff className="size-4 text-destructive" />Not saved <button className="font-semibold text-primary underline" onClick={onRetry}>Retry</button></> : <><CloudCheck className="size-4" />Progress saved</>}
          </div>}
        </header>
        {fullscreenError && <p role="status" className="border-b bg-muted px-6 py-2 text-sm">{fullscreenError}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
