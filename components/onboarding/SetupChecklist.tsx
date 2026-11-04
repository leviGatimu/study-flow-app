'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ChecklistItem } from '@/lib/setup';
import { completeSetup } from '@/lib/setup-actions';

/** Setup stays available without competing with today's schedule. */
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();
  if (hidden || items.every(item => item.done)) return null;

  const dismiss = () => {
    setHidden(true);
    startTransition(async () => {
      try {
        const result = await completeSetup();
        if (result?.error) throw new Error(result.error);
        router.refresh();
      } catch {
        setHidden(false);
        toast.error('This reminder could not be dismissed. Please try again.');
      }
    });
  };

  return <section aria-label="Workspace setup" className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:px-4">
    <p className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-sm">Workspace setup<span className="hidden text-muted-foreground/70 sm:inline"> · Continue whenever you like</span></p>
    <Button asChild variant="ghost" className="min-h-11 shrink-0 gap-1 rounded-lg px-2 text-xs font-medium sm:text-sm"><Link href="/setup">Continue setup<ChevronRight className="size-3.5" /></Link></Button>
    <Button variant="ghost" onClick={dismiss} disabled={isPending} aria-label="Dismiss setup reminder" title="Dismiss setup reminder" className="size-11 shrink-0 rounded-lg text-muted-foreground"><X className="size-3.5" /></Button>
  </section>;
}
