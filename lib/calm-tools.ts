/**
 * Pure helpers for the calm toolbar (components/calm/*). Everything here is
 * per device: scratch notes, the Talk it out chat and the Calm room's music link
 * live in localStorage, never in the database, and never sync.
 */

// ---------------------------------------------------------------------------
// YouTube links

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

/**
 * The 11-character video id from any usual YouTube link (watch, youtu.be,
 * shorts, embed, live, music.youtube), or null for anything else. Only the id
 * ever reaches the iframe URL, so a pasted link cannot inject anything.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (YOUTUBE_ID.test(text)) return text;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else {
    const [, kind, value] = url.pathname.split('/');
    if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v') id = value ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** A looping, privacy-enhanced embed URL with the JS API on (for pause/volume). */
export function youTubeEmbedUrl(id: string, origin: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    playlist: id, // loop only works on a single video when it is also the playlist
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    origin,
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Breathing

export type BreathStep = { label: 'Breathe in' | 'Hold' | 'Breathe out'; seconds: number; scale: 'grow' | 'hold' | 'shrink' };
export type BreathPattern = { id: string; name: string; steps: BreathStep[] };

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'calm',
    name: '4 · 4 · 6',
    steps: [
      { label: 'Breathe in', seconds: 4, scale: 'grow' },
      { label: 'Hold', seconds: 4, scale: 'hold' },
      { label: 'Breathe out', seconds: 6, scale: 'shrink' },
    ],
  },
  {
    id: 'box',
    name: 'Box 4 · 4 · 4 · 4',
    steps: [
      { label: 'Breathe in', seconds: 4, scale: 'grow' },
      { label: 'Hold', seconds: 4, scale: 'hold' },
      { label: 'Breathe out', seconds: 4, scale: 'shrink' },
      { label: 'Hold', seconds: 4, scale: 'hold' },
    ],
  },
];

export type BreathState = {
  step: BreathStep;
  stepIndex: number;
  /** Whole seconds left in this step, counting down to 1. */
  secondsLeft: number;
  /** 0..1 through this step. */
  progress: number;
  /** Full rounds finished so far. */
  rounds: number;
  /** Circle size, 0 (smallest) .. 1 (largest), for this moment. */
  size: number;
};

export function breathPhase(pattern: BreathPattern, elapsedMs: number): BreathState {
  const cycleMs = pattern.steps.reduce((sum, s) => sum + s.seconds * 1000, 0);
  const safe = Math.max(0, elapsedMs);
  const rounds = Math.floor(safe / cycleMs);
  let t = safe - rounds * cycleMs;

  let stepIndex = 0;
  while (t >= pattern.steps[stepIndex].seconds * 1000) {
    t -= pattern.steps[stepIndex].seconds * 1000;
    stepIndex += 1;
  }
  const step = pattern.steps[stepIndex];
  const stepMs = step.seconds * 1000;
  const progress = t / stepMs;

  // The size a hold keeps is whatever the step before it ended on.
  const before = pattern.steps[(stepIndex - 1 + pattern.steps.length) % pattern.steps.length];
  const size =
    step.scale === 'grow' ? progress
    : step.scale === 'shrink' ? 1 - progress
    : before.scale === 'grow' ? 1 : 0;

  return { step, stepIndex, secondsLeft: Math.ceil((stepMs - t) / 1000), progress, rounds, size };
}

// ---------------------------------------------------------------------------
// Scratch notes

export type ScratchNote = {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  pinned: boolean;
  /** Pathname the note was pulled out on; unpinned notes only show there. */
  page: string;
};

export const MAX_SCRATCH_NOTES = 12;
export const SCRATCH_NOTE_SIZE = { width: 224, height: 200 };

/** Fixed paper colours, same family as the Notes page, readable in both themes. */
export const NOTE_COLORS = ['#fef08a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#e9d5ff', '#fed7aa'];

/** Keeps a note fully inside the window, so it can never be lost off an edge. */
export function clampNote(
  pos: { x: number; y: number },
  viewport: { width: number; height: number },
  size = SCRATCH_NOTE_SIZE,
  margin = 8,
): { x: number; y: number } {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.round(Math.min(Math.max(pos.x, margin), maxX)),
    y: Math.round(Math.min(Math.max(pos.y, margin), maxY)),
  };
}

/** Accepts only well-formed notes from storage; anything else is dropped. */
export function readScratchNotes(value: unknown): ScratchNote[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (n): n is ScratchNote =>
        !!n &&
        typeof n.id === 'string' &&
        typeof n.text === 'string' &&
        typeof n.color === 'string' &&
        Number.isFinite(n.x) &&
        Number.isFinite(n.y) &&
        typeof n.pinned === 'boolean' &&
        typeof n.page === 'string',
    )
    .map((n) => ({ ...n, color: NOTE_COLORS.includes(n.color) ? n.color : NOTE_COLORS[0] }))
    .slice(0, MAX_SCRATCH_NOTES);
}

// ---------------------------------------------------------------------------
// Calm words and body reset

export const CALM_WORDS: { text: string; source?: string }[] = [
  { text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds.', source: 'Philippians 4:6–7' },
  { text: 'Come to me, all you who are weary and burdened, and I will give you rest.', source: 'Matthew 11:28' },
  { text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.', source: 'Isaiah 41:10' },
  { text: 'Be still, and know that I am God.', source: 'Psalm 46:10' },
  { text: 'Cast all your anxiety on him because he cares for you.', source: '1 Peter 5:7' },
  { text: 'Therefore do not worry about tomorrow, for tomorrow will worry about itself.', source: 'Matthew 6:34' },
  { text: 'You do not have to finish everything tonight. Just do the next small step.' },
  { text: 'A tired brain is not a broken brain. Rest for five minutes, then start again.' },
  { text: 'One bad study session does not undo all the work you have already done.' },
  { text: 'You are allowed to go slowly. Slow still gets there.' },
];

export const BODY_RESET_STEPS: { text: string; seconds: number }[] = [
  { text: 'Sit back. Drop your shoulders away from your ears.', seconds: 20 },
  { text: 'Unclench your jaw. Let your tongue rest. Loosen your hands.', seconds: 20 },
  { text: 'Look at something far away, at least 6 metres, and let your eyes relax.', seconds: 20 },
  { text: 'Drink some water. Fill your glass if it is empty.', seconds: 20 },
  { text: 'Stand up and stretch both arms above your head. Roll your neck slowly.', seconds: 20 },
  { text: 'One slow breath in through your nose, and a long one out through your mouth.', seconds: 20 },
];

// ---------------------------------------------------------------------------
// Storage

export const CALM_STORAGE = {
  notes: 'study-flow-scratch-notes',
  talk: 'study-flow-talk',
  music: 'study-flow-calm-music',
  pattern: 'study-flow-calm-pattern',
} as const;

/** localStorage can throw (private mode, quota, blocked), so reads fall back. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the tool still works for this visit.
  }
}
