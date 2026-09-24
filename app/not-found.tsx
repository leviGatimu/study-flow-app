import Link from 'next/link';
import { Compass, Home, Library } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

/**
 * A URL that does not exist, or a record that no longer does.
 *
 * Detail routes (/exams/[examId], /projects/[projectId]) land here when their
 * row has been deleted, which is a normal thing to reach from a stale tab or an
 * old link - so this offers a way onward rather than Next's bare default.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Panel className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Compass className="size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This page does not exist, or what was here has since been deleted. Go back to
            Today, or press Ctrl+K to search for what you wanted.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              Go to Today
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link href="/subjects">
              <Library className="size-4" />
              Browse subjects
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
