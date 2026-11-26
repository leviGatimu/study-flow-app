'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Popover } from 'radix-ui';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, RotateCw, Settings } from 'lucide-react';

import { updatesBridge, useIsDesktopApp, type UpdateState } from '@/components/DesktopUpdater';
import { cn } from '@/lib/utils';

/**
 * Desktop only: updates from the top bar, so there is no trip to Settings.
 * A dot shows when a new version is waiting, a ring while it downloads, and
 * the panel checks, shows progress and restarts into the new version. The
 * same state as Settings > Updates (pushed by desktop-app/main.js), which
 * keeps its own controls.
 */
export function UpdateButton() {
  const isDesktop = useIsDesktopApp();
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const api = updatesBridge();
    if (!api) return;
    let alive = true;
    api.status().then((s) => alive && setState(s)).catch(() => {});
    const off = api.subscribe((s) => alive && setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!isDesktop || !state || state.phase === 'unsupported') return null;

  const { phase, percent, version, currentVersion, message } = state;
  const waiting = phase === 'available' || phase === 'downloading' || phase === 'downloaded';
  const busy = phase === 'checking' || phase === 'available' || phase === 'downloading';
  const check = () => updatesBridge()?.check().then(setState).catch(() => {});
  const install = () => updatesBridge()?.install().catch(() => {});

  const R = 9;
  const C = 2 * Math.PI * R;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={phase === 'downloaded' ? `Update ready: version ${version}` : waiting ? 'Update downloading' : 'Updates'}
          title={phase === 'downloaded' ? 'Update ready, click to restart' : 'Updates'}
          className="titlebar-no-drag relative grid size-10 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted"
        >
          {phase === 'downloading' && (
            <svg viewBox="0 0 24 24" className="absolute size-8 -rotate-90" aria-hidden>
              <circle cx="12" cy="12" r={R} fill="none" className="stroke-muted" strokeWidth="2" />
              <circle
                cx="12"
                cy="12"
                r={R}
                fill="none"
                className="stroke-primary transition-[stroke-dashoffset] duration-500"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - Math.min(100, percent) / 100)}
              />
            </svg>
          )}
          <Download className={cn('size-[18px]', phase === 'downloaded' && 'text-primary motion-safe:animate-bounce')} />
          {(phase === 'downloaded' || phase === 'available') && (
            <span className="absolute right-1.5 top-1.5 grid size-2.5 place-items-center">
              <span className="absolute inset-0 rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2.5 rounded-full bg-primary ring-2 ring-sidebar" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="notif-panel z-[120] w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-4 text-card-foreground shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-2xl',
                phase === 'downloaded' ? 'bg-primary text-primary-foreground' : phase === 'error' ? 'bg-destructive/10 text-destructive' : phase === 'up-to-date' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
              )}
            >
              {phase === 'error' ? (
                <AlertTriangle className="size-5" />
              ) : phase === 'up-to-date' ? (
                <CheckCircle2 className="size-5" />
              ) : busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Download className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-bold">
                {phase === 'downloaded'
                  ? `Version ${version} is ready`
                  : phase === 'downloading'
                    ? `Downloading ${version ?? 'the update'}`
                    : phase === 'available'
                      ? `Version ${version} found`
                      : phase === 'checking'
                        ? 'Checking for updates…'
                        : phase === 'error'
                          ? 'Could not check'
                          : phase === 'up-to-date'
                            ? 'You are up to date'
                            : 'Updates'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {phase === 'downloaded'
                  ? 'Restart to finish. The app reopens by itself and your work is saved.'
                  : phase === 'error'
                    ? message ?? 'The update server did not answer.'
                    : `You have version ${currentVersion}.`}
              </p>
            </div>
          </div>

          {phase === 'downloading' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Downloading</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {phase === 'downloaded' ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <RotateCw className="size-4" /> Restart and update
              </button>
            ) : (
              <button
                type="button"
                onClick={check}
                disabled={busy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-border text-sm font-bold transition-colors hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={cn('size-4', phase === 'checking' && 'animate-spin')} />
                {busy ? 'Working…' : 'Check for updates'}
              </button>
            )}
            <Link
              href="/settings"
              aria-label="Update settings"
              title="Update settings"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-4" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
