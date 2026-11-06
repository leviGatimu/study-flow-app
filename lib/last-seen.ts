/** Saying when someone was last in the app. Pure, so tests need no clock or database. */

/** How long after the last check-in someone still counts as here. A check-in comes every few minutes. */
export const ONLINE_WINDOW_MS = 10 * 60_000;

export function isOnline(lastSeen: Date | string | null | undefined, now: number): boolean {
  return Boolean(lastSeen) && now - new Date(lastSeen as Date | string).getTime() < ONLINE_WINDOW_MS;
}

export function lastSeenLabel(lastSeen: Date | string | null | undefined, now: number): string {
  if (!lastSeen) return 'Not seen yet';
  const minutes = Math.floor((now - new Date(lastSeen).getTime()) / 60_000);
  if (minutes < 10) return 'Online now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? 'Yesterday' : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}
