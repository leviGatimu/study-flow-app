'use client';

import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

/**
 * The app's pop-up notifications. Every toast (toast.success, toast.error...)
 * renders through this. Sonner keeps its own layout and motion; the look is
 * restyled in app/globals.css under "Notifications" (a card that fits its
 * slot, a coloured icon tile, a coloured left edge, actions on their own line
 * under the text, the close at top right). Follows light/dark.
 */
const tile = (tone: string, icon: React.ReactNode) => (
  <span className={`toast-icon grid size-9 place-items-center rounded-xl ${tone}`}>{icon}</span>
);

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      className="app-toaster"
      gap={10}
      offset={{ top: 76, right: 20 }}
      visibleToasts={4}
      closeButton
      icons={{
        success: tile('bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', <CheckCircle2 className="size-5" />),
        error: tile('bg-red-500/15 text-red-600 dark:text-red-400', <XCircle className="size-5" />),
        warning: tile('bg-amber-500/15 text-amber-600 dark:text-amber-400', <TriangleAlert className="size-5" />),
        info: tile('bg-primary/15 text-primary', <Info className="size-5" />),
        loading: tile('bg-muted text-muted-foreground', <Loader2 className="size-5 animate-spin" />),
      }}
    />
  );
}
