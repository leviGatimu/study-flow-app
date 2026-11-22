/**
 * Set by proxy.ts on every request made with a mentor's session, and read by
 * lib/mentor-guard.ts. In its own module so proxy.ts imports nothing else.
 */
export const MENTOR_HEADER = 'x-study-flow-mentor';

/**
 * Pages a mentor is sent away from: the student's settings, AI chat, focus
 * room and private side areas. Everything about progress stays open.
 */
const MENTOR_BLOCKED = ['/settings', '/setup', '/admin', '/ai', '/ask', '/focus', '/profile', '/projects', '/notes'];

export function isMentorBlockedPath(pathname: string): boolean {
  return MENTOR_BLOCKED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
