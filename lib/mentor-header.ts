/**
 * Set by proxy.ts on every request made with a mentor's session, and read by
 * lib/mentor-guard.ts. In its own module so proxy.ts imports nothing else.
 */
export const MENTOR_HEADER = 'x-study-flow-mentor';

/** Where a mentor's own pages live. */
export const MENTOR_HOME = '/mentor';

/**
 * A mentor has a section of their own (app/mentor) and sees none of the
 * student's pages. Anything outside it sends them to their overview.
 */
export function isMentorPath(pathname: string): boolean {
  return pathname === MENTOR_HOME || pathname.startsWith(`${MENTOR_HOME}/`);
}
