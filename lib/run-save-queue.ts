/** Single-flight autosave: exit/hand-in must wait for the latest snapshot. */
export function createRunSaveQueue<T>(save: (snapshot: T) => Promise<void>, status: (value: 'saved' | 'saving' | 'error') => void) {
  let pending: T | null = null;
  let running: Promise<boolean> | null = null;
  let failed = false;
  async function drain(): Promise<boolean> {
    while (pending !== null) {
      const snapshot = pending;
      pending = null;
      try {
        await save(snapshot);
        failed = false;
      } catch {
        // A newer edit wins; otherwise keep this snapshot available for Retry.
        pending ??= snapshot;
        failed = true;
        status('error');
        return false;
      }
    }
    status(failed ? 'error' : 'saved');
    return !failed;
  }
  return {
    clear() { pending = null; failed = false; status('saved'); },
    queue(snapshot: T) { pending = snapshot; status('saving'); },
    flush(): Promise<boolean> {
      if (running) return running;
      running = drain().finally(() => { running = null; });
      return running;
    },
  };
}
