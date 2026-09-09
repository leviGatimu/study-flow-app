'use client';

/**
 * Tells you when your other device's work has arrived, and refreshes the page
 * so you can see it.
 *
 * Sync itself is server-side and automatic (lib/sync/scheduler.ts): every local
 * change pushes itself within a second or two, with a five-minute timer as the
 * safety net. But a push happening in the Node process is invisible to the
 * window - the page you are looking at was rendered before those rows arrived,
 * and it will keep showing yesterday's timetable until something navigates.
 *
 * So this component does the three things the server cannot:
 *
 *   NOTICES. Polls a deliberately cheap endpoint, and only acts when the last
 *   sync actually MOVED and actually brought rows down.
 *   REFRESHES. router.refresh() re-renders the current page with the new data,
 *   in place, without losing what you were typing.
 *   SAYS SO. A toast, plus a real desktop notification when the window is not
 *   the one you are looking at - which is exactly when this matters, because
 *   the change came from somewhere else.
 *
 * It also nudges a sync when the app comes back: focus and `online` are the two
 * moments a laptop has most likely been away, and they are the two moments no
 * timer has fired yet.
 *
 * Renders nothing. On the web build every call short-circuits server-side and
 * this quietly does nothing at all.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { getSyncPulse, syncFromActivity } from '@/lib/sync/actions';

/** How often to ask whether anything landed. Cheap query, invisible cost. */
const POLL_MS = 20_000;

/** Do not fire an activity sync more often than this, however jumpy the focus. */
const ACTIVITY_THROTTLE_MS = 60_000;

export function SyncWatcher() {
  const router = useRouter();
  const lastSeen = useRef<number | null>(null);
  const lastActivity = useRef(0);
  const notifiedError = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    /**
     * Stop entirely on anything that will never have news: the web build, and a
     * desktop nobody has paired. Polling forever to be told "not applicable" is
     * a round trip every twenty seconds for the life of the tab.
     */
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const announce = (pulled: number) => {
      const what = `${pulled} update${pulled === 1 ? '' : 's'} from your other device`;
      toast.success('Synced', { description: what });

      // A system notification only when the window is not in front. If you are
      // looking at the app, the toast and the refreshed page have already told
      // you, and a second alert for the same event is just noise.
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible'
      ) {
        new Notification('Study Flow synced', { body: what, icon: '/favicon.ico' });
      }
    };

    const check = async () => {
      try {
        const pulse = await getSyncPulse();
        if (cancelled) return;
        if (!pulse.paired) {
          stopPolling();
          return;
        }

        const at = pulse.lastSyncAt ? new Date(pulse.lastSyncAt).getTime() : null;

        // The first poll only establishes where we are. Announcing on it would
        // greet every page load with "synced", for a sync that happened before
        // the window existed.
        if (lastSeen.current === null) {
          lastSeen.current = at;
          notifiedError.current = pulse.lastError;
          return;
        }

        if (at && at !== lastSeen.current) {
          lastSeen.current = at;
          if (pulse.lastPulled > 0) {
            announce(pulse.lastPulled);
            router.refresh();
          }
        }

        // Tell them once per distinct problem, not once per poll. Sitting on a
        // train with no signal should cost one message, not one hundred and
        // eighty.
        if (pulse.lastError && pulse.lastError !== notifiedError.current) {
          notifiedError.current = pulse.lastError;
          toast.error('Sync problem', { description: pulse.lastError });
        } else if (!pulse.lastError) {
          notifiedError.current = null;
        }
      } catch {
        // The poll failing is not itself news; the next one will say so.
      }
    };

    const nudge = async () => {
      const now = Date.now();
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      try {
        const { changed } = await syncFromActivity();
        if (changed && !cancelled) router.refresh();
      } catch {
        // Same as above: the poll reports the state, this only prompts it.
      }
      void check();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void nudge();
    };

    void check();
    timer = setInterval(check, POLL_MS);
    window.addEventListener('online', nudge);
    window.addEventListener('focus', nudge);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      stopPolling();
      window.removeEventListener('online', nudge);
      window.removeEventListener('focus', nudge);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
