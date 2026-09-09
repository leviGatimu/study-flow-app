'use client';

/**
 * The sync controls, in Settings, on the desktop app only.
 *
 * What this screen has to answer, in order of how often it is asked:
 *   1. Is anything of mine still only on this machine?
 *   2. When did it last work?
 *   3. If it is broken, what do I do about it?
 *
 * So the pending count leads, the timestamp follows it, and an error is shown
 * as a sentence with the action attached rather than as a red icon. "Synced"
 * with a silent backlog of forty rows would be the worst thing this panel could
 * display, which is why the count is read from the database rather than
 * inferred from whether the last run threw.
 */

import { useEffect, useState, useTransition } from 'react';
import { RefreshCw, Link2, Link2Off, AlertCircle, Check, CloudUpload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  connectSync,
  disconnectSync,
  getSyncStatus,
  syncNow,
  type SyncStatus,
} from '@/lib/sync/actions';

export function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [serverUrl, setServerUrl] = useState('https://study-flow-app.vercel.app');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const refresh = () => getSyncStatus().then(setStatus);
  useEffect(() => {
    refresh();
  }, []);

  // Nothing to show on the web build: there, the database is the server.
  if (!status?.available) return null;

  const connect = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await connectSync(serverUrl, username, password);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      setPassword('');
      setMessage(
        `Connected. Brought down ${'pulled' in result ? result.pulled : 0} items. ` +
          'From now on this happens by itself whenever anything changes.'
      );

      // Asked HERE and nowhere else. Connecting a device is the one moment the
      // user has just said they want the two sides kept together, which makes
      // "may I tell you when work arrives" a question rather than an ambush.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      await refresh();
    });
  };

  const sync = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await syncNow();
      if ('error' in result && result.error) {
        setError(result.error);
      } else if (result.errors?.length) {
        setError(result.errors[0]);
      } else if ('pushed' in result) {
        setMessage(
          result.pushed === 0 && result.pulled === 0
            ? 'Already up to date.'
            : `Sent ${result.pushed}, received ${result.pulled}.`
        );
      }
      await refresh();
    });
  };

  const disconnect = () => {
    startTransition(async () => {
      await disconnectSync();
      setMessage('This device no longer syncs. Nothing on it was deleted.');
      await refresh();
    });
  };

  if (!status.paired) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign in with your website account once. After that this app keeps itself in step
          automatically — every assignment, timetable edit and tick sends itself across within
          seconds, and anything you change while offline goes up the moment you reconnect. Your
          work stays on this machine either way.
        </p>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="sync-url">Website address</Label>
            <Input
              id="sync-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sync-user">Username</Label>
              <Input
                id="sync-user"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-pass">Password</Label>
              <Input
                id="sync-pass"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
            </div>
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="ok">{message}</Notice>}

        <Button onClick={connect} disabled={pending || !username || !password} className="gap-2">
          <Link2 className="w-4 h-4" />
          {pending ? 'Connecting…' : 'Connect this device'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            {status.pending > 0 ? (
              <>
                <CloudUpload className="w-4 h-4 text-primary" />
                {status.pending} change{status.pending === 1 ? '' : 's'} on the way
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-primary" />
                Everything here has reached the website
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            Syncing automatically · {status.serverUrl}
            {status.lastSyncAt && ` · last ${formatDistanceToNow(new Date(status.lastSyncAt))} ago`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Automatic sync covers every real change; this is for the moment
              somebody wants to watch it happen rather than trust it. */}
          <Button variant="outline" onClick={sync} disabled={pending} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', pending && 'animate-spin')} />
            {pending ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button variant="ghost" onClick={disconnect} disabled={pending} className="gap-2">
            <Link2Off className="w-4 h-4" /> Disconnect
          </Button>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!error && status.lastError && <Notice tone="error">{status.lastError}</Notice>}
      {message && <Notice tone="ok">{message}</Notice>}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-sm',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-primary/20 bg-primary/5 text-foreground'
      )}
    >
      {tone === 'error' ? (
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      ) : (
        <Check className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
      )}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
