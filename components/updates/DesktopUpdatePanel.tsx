'use client';

import { useEffect, useState } from 'react';

import { DesktopUpdater, useIsDesktopApp } from '@/components/DesktopUpdater';
import { Pill } from '@/components/ui/list-row';

/** The update controls, on the desktop app only. The website is always on the latest version. */
export function DesktopUpdatePanel() {
  const isDesktop = useIsDesktopApp();
  if (!isDesktop) return null;
  return (
    <div className="max-w-xl rounded-xl border border-border/60 bg-card p-4">
      <DesktopUpdater />
    </div>
  );
}

/** Marks the version this desktop app is running. */
export function InstalledPill({ version }: { version: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const updates = (window as { electron?: { updates?: { status: () => Promise<{ currentVersion: string }> } } }).electron?.updates;
    updates?.status().then((state) => setCurrent(state.currentVersion)).catch(() => undefined);
  }, []);
  return current === version ? <Pill>Your version</Pill> : null;
}
