/**
 * Where the Study Flow website lives, for desktop sync.
 *
 * A move to Render (render.yaml) was prepared in Nov 2026 while the Vercel
 * account was paused, but no Render service exists yet, and a desktop that
 * moves saves the new address for good. So sync stays on Vercel until the new
 * service answers. To move: set SYNC_SERVER_URL to the real Render address and
 * add 'studyingflow.vercel.app' to RETIRED_HOSTS (same database and JWT_SECRET,
 * so a paired desktop's token keeps working). Pure and free of `@/` imports so
 * `node --test` can load it.
 */

export const SYNC_SERVER_URL = 'https://studyingflow.vercel.app';

/** Addresses the website used to answer on; a pairing saved with one of these moves to SYNC_SERVER_URL. */
const RETIRED_HOSTS = new Set<string>([]);

/** The address to sync with: the saved one, unless it is a retired address of this same website. */
export function currentServerUrl(saved: string): string {
  try {
    return RETIRED_HOSTS.has(new URL(saved).hostname) ? SYNC_SERVER_URL : saved;
  } catch {
    return saved;
  }
}
