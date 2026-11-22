/**
 * What file sync has already learned about each file, so a sync run does not
 * ask the same question every time.
 *
 * Without this, every run (1.5 s after any change, and every five minutes)
 * asked the server about every uploaded file, re-sent each one the server did
 * not keep, and re-requested every file the server had lost - forever, since
 * nothing remembered a failure. On a hosted server that bills by transfer that
 * is the whole budget.
 *
 * Kept in memory: an app restart forgets it and costs one round of checks,
 * which is cheap. Pure and free of `@/` imports so `node --test` can load it.
 */

export const FIRST_RETRY_MS = 5 * 60_000;
export const MAX_RETRY_MS = 24 * 60 * 60_000;

type Entry = { done: true } | { done: false; retryAt: number; wait: number };

export class FileBackoff {
  private entries = new Map<string, Entry>();

  /** False while the file is settled, or failed recently and waiting to retry. */
  shouldTry(name: string, now = Date.now()): boolean {
    const entry = this.entries.get(name);
    if (!entry) return true;
    if (entry.done) return false;
    return now >= entry.retryAt;
  }

  /** Settled: the server has it (up) or this device has it (down). Never asked again this launch. */
  succeeded(name: string): void {
    this.entries.set(name, { done: true });
  }

  /** Failed: wait 5 minutes, then twice as long after each further failure, up to a day. */
  failed(name: string, now = Date.now()): void {
    const entry = this.entries.get(name);
    const wait = entry && !entry.done ? Math.min(entry.wait * 2, MAX_RETRY_MS) : FIRST_RETRY_MS;
    this.entries.set(name, { done: false, retryAt: now + wait, wait });
  }

  /** Forget everything, e.g. after pairing with a different server. */
  clear(): void {
    this.entries.clear();
  }
}
