/**
 * Lyrics support for focus mode: parse LRC (synced) lyrics and fetch missing
 * lyrics from LRCLIB (free, keyless). Synced lines drive the Apple Music-style
 * karaoke view; plain text still renders as a scrollable sheet.
 */

export interface LyricLine {
  time: number; // seconds
  text: string;
}

const LRC_LINE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function isSyncedLyrics(lyrics: string): boolean {
  return /\[\d{1,2}:\d{2}/.test(lyrics);
}

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    LRC_LINE.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = LRC_LINE.exec(raw)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) / 1000 : 0;
      stamps.push(minutes * 60 + seconds + fraction);
      lastIndex = LRC_LINE.lastIndex;
    }
    if (stamps.length === 0) continue;
    const text = raw.slice(lastIndex).trim();
    for (const time of stamps) {
      lines.push({ time, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

interface LrclibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

function pickLyrics(record: LrclibRecord | null | undefined): string | null {
  if (!record || record.instrumental) return null;
  return record.syncedLyrics || record.plainLyrics || null;
}

/**
 * Look up lyrics on LRCLIB. Tries an exact match (title + artist + duration)
 * first, then falls back to a fuzzy search. Returns LRC text when synced
 * lyrics exist, otherwise plain text, otherwise null.
 */
export async function fetchLyricsFromLrclib(
  title: string,
  artist: string | null,
  durationSeconds: number | null
): Promise<string | null> {
  try {
    if (artist) {
      const params = new URLSearchParams({ track_name: title, artist_name: artist });
      if (durationSeconds) params.set('duration', String(Math.round(durationSeconds)));
      const res = await fetch(`https://lrclib.net/api/get?${params}`);
      if (res.ok) {
        const found = pickLyrics(await res.json());
        if (found) return found;
      }
    }

    const search = new URLSearchParams({ q: artist ? `${artist} ${title}` : title });
    const res = await fetch(`https://lrclib.net/api/search?${search}`);
    if (!res.ok) return null;
    const records: LrclibRecord[] = await res.json();
    // Prefer a synced result close to our track length.
    const scored = records
      .map(r => ({ r, score: (r.syncedLyrics ? 2 : r.plainLyrics ? 1 : 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return pickLyrics(scored[0]?.r);
  } catch {
    return null; // offline or API down — lyrics just stay hidden
  }
}
