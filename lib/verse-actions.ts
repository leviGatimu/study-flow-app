'use server';

import { isVerseRef, tidyVerseText, VERSE_TRANSLATION, type Verse } from '@/lib/verses';

/**
 * The text of one of the home card's verses, from bible-api.com.
 *
 * Only references from VERSE_REFS are fetched, so this cannot be used to make
 * the server call anything else. Each verse is fetched once per server and kept
 * in memory: bible-api.com allows 15 requests per 30 seconds per address, and
 * the website's users all share one address. Returns null when the API cannot
 * be reached; the card then shows a built-in verse.
 */
const cache = new Map<string, Verse>();

export async function getVerseText(ref: string): Promise<Verse | null> {
  if (!isVerseRef(ref)) return null;
  const kept = cache.get(ref);
  if (kept) return kept;

  try {
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${VERSE_TRANSLATION}`, {
      signal: AbortSignal.timeout(6000),
      // Kept in `cache` above instead: Next's data cache could keep a failed answer.
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[verse] bible-api.com answered ${res.status} for ${ref}`);
      return null;
    }
    const data = (await res.json()) as { text?: unknown };
    if (typeof data.text !== 'string' || !data.text.trim()) return null;
    const verse = { ref, text: tidyVerseText(data.text) };
    cache.set(ref, verse);
    return verse;
  } catch (err) {
    console.warn(`[verse] could not reach bible-api.com for ${ref}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
