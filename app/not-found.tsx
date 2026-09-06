import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * A URL that does not exist, or a record that no longer does.
 *
 * Detail routes (/exams/[examId], /projects/[projectId], /tutor/[moduleId])
 * land here when their row has been deleted, which is a normal thing to reach
 * from a stale tab or an old link - so this offers a way onward rather than
 * Next's bare default.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Compass className="size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Nothing here
          </h1>
          <p className="text-sm text-muted-foreground">
            This page doesn&apos;t exist, or whatever was here has since been
            deleted. Press Ctrl+K to search, or head back to today.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="size-4" />
            Back to today
          </Link>
        </Button>
      </div>
    </div>
  );
}
