/**
 * Keeping `syncedAt` honest, on both sides, without touching a call site.
 *
 * The column means two things and the extension is what maintains each:
 *
 *   ON THE SERVER (Postgres) every write stamps it with the server clock. That
 *   is what makes a pull cursor possible at all - a device asks "everything
 *   since X" and the server can answer from one indexed column, however wrong
 *   the device's own clock is.
 *
 *   ON A DEVICE (SQLite) every write clears it to NULL, which means "this row
 *   has local changes the server has not seen". A dirty bit rather than a
 *   timestamp, so a device never has to compare its clock with the server's -
 *   the one comparison that clock skew could silently get wrong.
 *
 * The merge engine sets syncedAt explicitly on everything it writes, and an
 * explicit value always wins here, which is how a pulled row lands already
 * clean instead of immediately looking like a local edit and bouncing back.
 *
 * There are about 200 write sites across ten action files. Doing this centrally
 * is not a convenience: a single forgotten stamp on the server is a row no
 * device ever pulls, and a single forgotten clear on a device is an edit that
 * silently never leaves the machine.
 */

import { SYNC_RULES } from './identity.ts';

/** Model names as Prisma exposes them, for the models that sync. */
const SYNCED = new Set(
  Object.entries(SYNC_RULES)
    .filter(([, rule]) => rule.match === 'ID' || rule.match === 'NATURAL_KEY')
    .map(([model]) => model.charAt(0).toUpperCase() + model.slice(1))
);

/** Writes that carry a `data` payload we can add a column to. */
const WRITES = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);

/**
 * @param isServer true on the Postgres build, false on a desktop install.
 */
export function syncStampExtension(isServer: boolean) {
  return {
    name: 'syncStamp',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (!model || !SYNCED.has(model) || !WRITES.has(operation)) return query(args);

          const value = isServer ? new Date() : null;
          const stamp = (payload: unknown): unknown => {
            if (Array.isArray(payload)) return payload.map(stamp);
            if (!payload || typeof payload !== 'object') return payload;
            const row = payload as Record<string, unknown>;
            // An explicit value is the merge engine saying where this row
            // stands; never overwrite it.
            if ('syncedAt' in row) return row;
            return { ...row, syncedAt: value };
          };

          if (operation === 'upsert') {
            return query({
              ...args,
              create: stamp(args.create),
              update: stamp(args.update),
            });
          }
          return query({ ...args, data: stamp(args.data) });
        },
      },
    },
  };
}
