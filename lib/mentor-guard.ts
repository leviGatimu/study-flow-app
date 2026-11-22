/**
 * The database half of "a mentor can look but not touch".
 *
 * A mentor's session reads the student's account (lib/auth.ts), so every page
 * works unchanged - and so would every write, unless something refuses it.
 * Checking in each of the ~200 server actions would be a promise that the
 * next action added keeps; this is checked once, here, for all of them.
 *
 * proxy.ts marks every request made with a mentor session by setting
 * MENTOR_HEADER (and strips it from everyone else's). A server action request
 * carries `next-action`. Any create, update, upsert or delete made while BOTH
 * are present is refused. Page loads are deliberately not blocked: they
 * generate this week's blocks and mark missed ones exactly as the student's own
 * visit would, and blocking them would break the very pages the mentor opened.
 *
 * Routes under /api never pass through proxy.ts; the ones that write with a
 * cookie refuse a mentor session themselves (getMentorSession in lib/auth.ts),
 * and a mentor's token is never accepted as a device bearer token.
 */

import { MENTOR_HEADER } from './mentor-header';

export { MENTOR_HEADER };
export const MENTOR_READ_ONLY_ERROR = 'Mentor access is read-only.';

const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']);

/** True inside a server action that a mentor's session made. False anywhere outside a request. */
export async function isMentorAction(): Promise<boolean> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return h.get(MENTOR_HEADER) === '1' && h.has('next-action');
  } catch {
    // Not inside a request (scripts, the desktop's sync timer): no mentor there.
    return false;
  }
}

export function mentorGuardExtension(enabled: boolean) {
  return {
    name: 'mentorReadOnly',
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (enabled && WRITES.has(operation) && (await isMentorAction())) {
            throw new Error(MENTOR_READ_ONLY_ERROR);
          }
          return query(args);
        },
      },
    },
  };
}
