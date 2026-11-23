'use client';

import Image from 'next/image';
import { useSyncExternalStore } from 'react';

import { WindowControls } from '@/components/WindowControls';

const subscribe = () => () => {};
const isDesktop = () => 'electron' in window;

/**
 * Desktop only: the title bar for pages without the app header (sign in,
 * welcome, setup). The window has no Windows title bar, so without this
 * there would be nothing to drag the window by. Same height as the app
 * header, which the window buttons are sized to.
 */
export function DesktopTitleStrip() {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false);
  if (!desktop) return null;
  return (
    <header className="titlebar-drag flex h-16 shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4">
      <Image src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-lg object-cover" />
      <span className="flex-1 text-sm font-semibold text-foreground">Study Flow</span>
      <WindowControls />
    </header>
  );
}
