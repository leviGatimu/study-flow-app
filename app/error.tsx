'use client';

import { useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

/**
 * What the user sees when a page throws.
 *
 * The app had 35 loading.tsx files and no error boundary at all, so any
 * unhandled server error dropped the user on Next's default crash screen with
 * no explanation and no way back. That is not hypothetical here: this app has
 * genuinely hit connection-pool exhaustion and slow round trips to a database
 * in Frankfurt, both of which surface exactly this way.
 *
 * Nothing the user typed is lost by retrying - every page reads its data on
 * the server - so "Try again" is safe to offer first.
 *
 * Note this does NOT catch errors thrown by the root layout; global-error.tsx
 * handles those.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  // reset() alone only re-renders on the client; a server error needs the
  // route's data fetched again, so refresh first and reset in the same step.
  const retry = () =>
    startRetry(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    // The digest is what correlates this screen with the server log line.
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Panel className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            This page did not load
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong while fetching your data, usually a dropped
            connection. Nothing has been lost, and trying again normally works.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={retry} disabled={retrying} size="lg" className="gap-2">
            <RefreshCw className="size-4" />
            {retrying ? 'Trying again…' : 'Try again'}
          </Button>
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              Go to Today
            </Link>
          </Button>
        </div>

        {/* Enough to find the matching server log, without putting a stack
            trace in front of the user. */}
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </Panel>
    </div>
  );
}
