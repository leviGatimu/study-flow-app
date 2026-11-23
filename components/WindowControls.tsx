'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type Bridge = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximized: (cb: (v: boolean) => void) => () => void;
};

const bridge = (): Bridge | undefined =>
  (window as unknown as { electron?: { windowControls?: Bridge } }).electron?.windowControls;
const subscribe = () => () => {};

/**
 * Desktop only: the window's minimise / maximise / close, drawn by the app in
 * its own style (the window has no Windows title bar; the header is the title
 * bar). Round like the header's other buttons; close turns red on hover.
 * Renders nothing in a browser.
 */
export function WindowControls({ className }: { className?: string }) {
  const available = useSyncExternalStore(subscribe, () => Boolean(bridge()), () => false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const b = bridge();
    if (!b) return;
    let live = true;
    b.isMaximized().then((v) => live && setMaximized(v)).catch(() => {});
    const off = b.onMaximized(setMaximized);
    return () => {
      live = false;
      off();
    };
  }, []);

  if (!available) return null;
  const b = bridge()!;
  const base =
    'titlebar-no-drag grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-[15px]';

  return (
    <div className={cn('titlebar-no-drag flex shrink-0 items-center gap-0.5', className)}>
      <span aria-hidden className="mx-1.5 h-6 w-px bg-border" />
      <button type="button" aria-label="Minimise" title="Minimise" onClick={b.minimize} className={cn(base, 'hover:bg-muted hover:text-foreground')}>
        <Minus strokeWidth={2.2} />
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximise'}
        title={maximized ? 'Restore' : 'Maximise'}
        onClick={b.toggleMaximize}
        className={cn(base, 'hover:bg-muted hover:text-foreground')}
      >
        {maximized ? <Copy className="!size-[13px] -scale-x-100" strokeWidth={2.2} /> : <Square className="!size-[13px]" strokeWidth={2.2} />}
      </button>
      <button type="button" aria-label="Close" title="Close" onClick={b.close} className={cn(base, 'hover:bg-red-500 hover:text-white')}>
        <X strokeWidth={2.2} />
      </button>
    </div>
  );
}
