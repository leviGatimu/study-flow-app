/**
 * "Something was written locally" - the one line between the client extension
 * and the scheduler.
 *
 * It exists to break a cycle rather than to be clever. lib/prisma.ts imports the
 * stamp extension, so the extension cannot import the scheduler, which imports
 * lib/prisma.ts. A one-field registry has no imports at all and therefore
 * cannot be part of any cycle.
 *
 * Deliberately not an EventEmitter: there is exactly one listener, registered
 * once by the scheduler, and a list of them would only invite something else to
 * start doing work on every database write.
 */

let listener: (() => void) | null = null;

/** Register the scheduler. Replaces any previous listener, which hot reload creates. */
export function onLocalWrite(fn: () => void): void {
  listener = fn;
}

/**
 * Fired by the sync stamp extension after a genuine local write.
 *
 * Never throws into the caller: this sits in the path of every write in the
 * app, and a scheduler problem must not be able to fail somebody's save.
 */
export function localWrite(): void {
  try {
    listener?.();
  } catch {
    // Nothing to do and nowhere useful to report it from inside a query.
  }
}
