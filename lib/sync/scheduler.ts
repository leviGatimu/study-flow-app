/**
 * Syncing without anybody pressing anything.
 *
 * A button is honest but useless: the whole point of this feature is that you
 * write an assignment on the laptop and it is simply there on the website, and
 * nobody presses "sync now" before closing the lid.
 *
 * Four moments, chosen because they are the four times data is actually at risk
 * of being stranded:
 *
 *   ON LAUNCH, once, a few seconds in - the machine has probably been off or
 *   asleep, so this is when the gap is widest. Delayed rather than immediate
 *   because the first thing a user wants is the window, not the network.
 *
 *   AFTER A LOCAL EDIT, debounced. Typing a task name produces a write per
 *   keystroke on some screens, so the trigger waits for the writing to stop.
 *   This is what makes it feel instant rather than eventual.
 *
 *   ON A TIMER, as the safety net for everything the other three miss: an edit
 *   made while offline, a server that was down, a push that half failed.
 *
 *   WHEN THE APP COMES BACK, driven from the window (see SyncOnActivity) -
 *   waking a laptop is the single most likely moment for the two sides to be
 *   far apart.
 *
 * THE THREE RULES THAT KEEP THIS FROM BECOMING A PROBLEM:
 *
 *   1. ONE AT A TIME. Every entry point funnels through the same promise, so a
 *      timer firing during a launch sync joins it instead of starting a second
 *      one against the same database.
 *   2. BACK OFF ON FAILURE. A laptop with no signal must not retry every five
 *      minutes forever - the interval doubles up to an hour and resets the
 *      moment a sync succeeds.
 *   3. NEVER THROW. This runs with no user watching and nothing to catch it; a
 *      rejection here would be an unhandled promise in the desktop's server
 *      process. Failures are recorded on SyncState, which is what the Settings
 *      panel reads.
 */

import { prisma, IS_SQLITE } from '@/lib/prisma';
import { runSync } from './client.ts';
import { onLocalWrite } from './notify.ts';

/**
 * The quiet period after a local edit before its push goes out.
 *
 * Short, because "I added an assignment and it is on my phone" is the feature.
 * Not zero, because a single edit is rarely a single write - saving a task
 * touches the task, its XP ledger row and the streak on its class - and three
 * pushes for one action is three round trips to Frankfurt for no benefit.
 */
const DEBOUNCE_MS = 1_500;

/**
 * The safety net, and only that.
 *
 * Every real change already pushes itself within DEBOUNCE_MS. This exists for
 * what that cannot catch: edits made while the network was down, a server that
 * was restarting, a push that half succeeded. Five minutes is frequent enough
 * that a recovered connection catches up on its own.
 */
const BASE_INTERVAL_MS = 5 * 60_000;

/** Where backing off stops. An hour is long enough to be free, short enough to recover. */
const MAX_INTERVAL_MS = 60 * 60_000;

/** How long after boot the first sync runs. Long enough for the window to be up. */
const LAUNCH_DELAY_MS = 8_000;

type Scheduler = {
  timer: NodeJS.Timeout | null;
  debounce: NodeJS.Timeout | null;
  running: Promise<void> | null;
  interval: number;
  started: boolean;
};

/**
 * Cached on globalThis for the same reason the Prisma client is: Next hot-reloads
 * this module in development, and a second copy would mean a second timer
 * syncing the same database on its own schedule.
 */
const globalForSync = globalThis as unknown as { syncScheduler?: Scheduler };

const scheduler: Scheduler = (globalForSync.syncScheduler ??= {
  timer: null,
  debounce: null,
  running: null,
  interval: BASE_INTERVAL_MS,
  started: false,
});

/** Everyone signed into this install who has actually paired it. */
async function pairedUsers(): Promise<string[]> {
  const states = await prisma.syncState.findMany({
    where: { NOT: [{ serverUrl: null }, { token: null }] },
    select: { userId: true },
  });
  return states.map((s) => s.userId);
}

/**
 * Run one sync for every paired profile, unless one is already running.
 *
 * Returns the in-flight promise when there is one, so callers queue behind it
 * rather than racing it. Several profiles can share a machine - the desktop
 * keeps its own login for exactly that - so this is a loop, not a single user.
 */
export function syncAllPaired(): Promise<void> {
  if (!IS_SQLITE) return Promise.resolve();
  if (scheduler.running) return scheduler.running;

  scheduler.running = (async () => {
    try {
      const users = await pairedUsers();
      if (users.length === 0) return;

      let anyFailed = false;
      for (const userId of users) {
        const result = await runSync(userId);
        if (result.errors.length > 0) {
          anyFailed = true;
          console.warn(`[sync] ${userId}: ${result.errors[0]}`);
        } else if (result.pushed || result.pulled || result.files) {
          console.log(
            `[sync] ${userId}: sent ${result.pushed}, received ${result.pulled}` +
              (result.files ? `, ${result.files} file(s)` : '')
          );
        }
      }

      // Back off while it is failing, and snap straight back when it works.
      scheduler.interval = anyFailed
        ? Math.min(scheduler.interval * 2, MAX_INTERVAL_MS)
        : BASE_INTERVAL_MS;
    } catch (error) {
      // runSync already records its own failures; this is for the unexpected.
      console.error('[sync] scheduler:', error);
      scheduler.interval = Math.min(scheduler.interval * 2, MAX_INTERVAL_MS);
    } finally {
      scheduler.running = null;
      rearm();
    }
  })();

  return scheduler.running;
}

/** Re-arm the safety-net timer at whatever the current backoff says. */
function rearm(): void {
  if (!scheduler.started) return;
  if (scheduler.timer) clearTimeout(scheduler.timer);
  scheduler.timer = setTimeout(() => void syncAllPaired(), scheduler.interval);
  // A pending sync must never hold the process open on its own.
  scheduler.timer.unref?.();
}

/**
 * "Something changed locally." Coalesces a burst of writes into one push.
 *
 * Called from the sync stamp extension, so it fires on every genuine local
 * write and on none of the engine's own - the engine always sets syncedAt
 * explicitly, and the extension leaves those alone.
 */
export function requestSync(): void {
  if (!IS_SQLITE || !scheduler.started) return;
  if (scheduler.debounce) clearTimeout(scheduler.debounce);
  scheduler.debounce = setTimeout(() => {
    scheduler.debounce = null;
    void syncAllPaired();
  }, DEBOUNCE_MS);
  scheduler.debounce.unref?.();
}

/** Start the scheduler. Idempotent, and a no-op on the web build. */
export function startSyncScheduler(): void {
  if (!IS_SQLITE || scheduler.started) return;
  scheduler.started = true;

  onLocalWrite(requestSync);

  const first = setTimeout(() => void syncAllPaired(), LAUNCH_DELAY_MS);
  first.unref?.();
  rearm();
}
