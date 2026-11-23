/**
 * Where the Study Flow website lives, for desktop sync.
 *
 * Moved to Render (render.yaml) on 2026-11-23 while the Vercel account was
 * paused. Same database, but a NEW JWT_SECRET (the old one could not be
 * recovered), so a desktop paired with the old address is moved here once and
 * then asked to sign in again. Pure and free of `@/` imports so `node --test`
 * can load it.
 */

export const SYNC_SERVER_URL = 'https://study-flow-lm0j.onrender.com';

/** Addresses the website used to answer on; a pairing saved with one of these moves to SYNC_SERVER_URL. */
const RETIRED_HOSTS = new Set<string>(['studyingflow.vercel.app']);

/** The address to sync with: the saved one, unless it is a retired address of this same website. */
export function currentServerUrl(saved: string): string {
  try {
    return RETIRED_HOSTS.has(new URL(saved).hostname) ? SYNC_SERVER_URL : saved;
  } catch {
    return saved;
  }
}
