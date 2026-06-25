'use server';

import { getUserId } from '@/lib/auth';

// Audius is a free, legal, CORS-friendly music network with a public API
// (no key required). We use it as the "online" source; uploaded files remain
// the offline source. Discovery hosts are fetched from the registry and cached.

const APP_NAME = 'StudyTracker';

const FALLBACK_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://discoveryprovider3.audius.co',
];

let cachedHosts: string[] | null = null;
let cachedAt = 0;

export type OnlineTrack = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  artworkUrl: string;
  streamUrl: string;
  online: true;
};

async function fetchWithTimeout(url: string, options: any = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getHosts(): Promise<string[]> {
  const now = Date.now();
  if (cachedHosts && now - cachedAt < 30 * 60 * 1000) return cachedHosts;
  try {
    const res = await fetchWithTimeout('https://api.audius.co', { cache: 'no-store' }, 6000);
    const data = await res.json();
    if (Array.isArray(data?.data) && data.data.length) {
      cachedHosts = data.data;
      cachedAt = now;
      return cachedHosts!;
    }
  } catch {
    // Registry unreachable — fall back to known nodes.
  }
  return FALLBACK_HOSTS;
}

function streamUrlFor(host: string, id: string) {
  return `${host}/v1/tracks/${id}/stream?app_name=${APP_NAME}`;
}

function mapTrack(t: any, host: string): OnlineTrack {
  const art = t.artwork || {};
  return {
    id: String(t.id),
    title: t.title || 'Untitled',
    artist: t.user?.name || 'Unknown Artist',
    duration: Number(t.duration) || 0,
    artworkUrl: art['480x480'] || art['150x150'] || art['1000x1000'] || '',
    streamUrl: streamUrlFor(host, String(t.id)),
    online: true,
  };
}

export async function searchOnlineSongs(query: string): Promise<OnlineTrack[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const q = (query || '').trim();
  if (!q) return [];

  const hosts = await getHosts();
  for (const host of hosts.slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP_NAME}`,
        { cache: 'no-store' },
        8000,
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        return data.data
          .filter((t: any) => t && t.is_streamable !== false)
          .slice(0, 30)
          .map((t: any) => mapTrack(t, host));
      }
    } catch {
      // Try the next host.
    }
  }
  return [];
}

export async function getTrendingOnlineSongs(): Promise<OnlineTrack[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const hosts = await getHosts();
  for (const host of hosts.slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/v1/tracks/trending?app_name=${APP_NAME}`,
        { cache: 'no-store' },
        8000,
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        return data.data.slice(0, 30).map((t: any) => mapTrack(t, host));
      }
    } catch {
      // Try the next host.
    }
  }
  return [];
}

/** Resolve a fresh, playable stream URL for an online track (avoids stale hosts). */
export async function resolveOnlineStream(externalId: string): Promise<string> {
  const hosts = await getHosts();
  return streamUrlFor(hosts[0] || FALLBACK_HOSTS[0], externalId);
}
