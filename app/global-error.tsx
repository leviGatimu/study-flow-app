'use client';

import { useEffect } from 'react';

/**
 * The last line of defence: an error thrown by the root layout itself.
 *
 * app/error.tsx cannot catch these, because it renders *inside* the layout
 * that failed. This one replaces the whole document, so it must supply its own
 * <html> and <body> and cannot rely on the app's providers, fonts, or
 * components - anything imported from the app could be the thing that broke.
 * That is why the styles here are inline rather than Tailwind classes.
 *
 * This matters for this app specifically: the root layout resolves the session
 * and loads the user's subjects, so a database failure there takes out the
 * entire page rather than one route - which is precisely what happened during
 * the connection-pool incident.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#fafaf9',
          color: '#1c1917',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Study Flow couldn&apos;t start
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#57534e', margin: '0 0 1.5rem' }}>
            The app failed to load before it could render anything. This is
            almost always the database being unreachable. Your data is fine -
            nothing is written when a page fails to load.
          </p>

          <button
            onClick={reset}
            style={{
              cursor: 'pointer',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#1c1917',
              color: '#fafaf9',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '1.5rem' }}>
              Reference: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</span>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
