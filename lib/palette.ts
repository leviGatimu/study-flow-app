/**
 * Album-art color extraction for the focus-mode fluid gradient.
 * Downsamples the cover into a tiny canvas, buckets pixels by hue/lightness,
 * and returns the most dominant vibrant colors — the same trick Apple Music
 * uses to tint its full-screen player per song.
 */

export type Palette = string[]; // hex colors, strongest first

// Hand-tuned fallbacks for songs without artwork, keyed off the title hash so
// every track keeps a stable identity. Inspired by Apple Music's moodier tints.
const FALLBACK_PALETTES: Palette[] = [
  ['#8e1f2f', '#1f3a8e', '#d94a5e', '#101935'], // crimson / indigo (the classic)
  ['#0f4c5c', '#5f0f40', '#1b9aaa', '#2d1b4e'], // teal / plum
  ['#7a3803', '#2a1a47', '#e88d2a', '#522b80'], // amber / violet
  ['#14532d', '#0c4a6e', '#34d399', '#075985'], // emerald / ocean
  ['#581c87', '#9d174d', '#a855f7', '#e11d48'], // grape / rose
  ['#7c2d12', '#134e4a', '#fb923c', '#2dd4bf'], // ember / lagoon
];

export function fallbackPalette(seed: string): Palette {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTES[Math.abs(hash) % FALLBACK_PALETTES.length];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export async function extractPalette(imageUrl: string, seed = ''): Promise<Palette> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });

    const SIZE = 48;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallbackPalette(seed || imageUrl);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    // Bucket pixels into a coarse RGB grid, scoring saturated mid-tones higher
    // so the gradient picks up the artwork's character, not its black borders.
    const buckets = new Map<string, { r: number; g: number; b: number; count: number; score: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lightness = (max + min) / 510;
      const saturation = max === 0 ? 0 : (max - min) / max;

      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0, score: 0 };
      entry.r += r; entry.g += g; entry.b += b; entry.count++;
      // Vibrancy weighting: punish near-black / near-white, reward saturation.
      entry.score += 0.2 + saturation * 1.6 * (1 - Math.abs(lightness - 0.5) * 1.4);
      buckets.set(key, entry);
    }

    const ranked = [...buckets.values()]
      .map(e => ({ r: e.r / e.count, g: e.g / e.count, b: e.b / e.count, score: e.score }))
      .sort((a, b) => b.score - a.score);

    const picked: { r: number; g: number; b: number }[] = [];
    for (const c of ranked) {
      // Require some distance from already-picked colors so we get 4 distinct tones.
      const tooClose = picked.some(p =>
        Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 110
      );
      if (!tooClose) picked.push(c);
      if (picked.length >= 4) break;
    }

    if (picked.length < 2) return fallbackPalette(seed || imageUrl);
    while (picked.length < 4) {
      const base = picked[picked.length % 2];
      picked.push({ r: base.r * 0.55, g: base.g * 0.55, b: base.b * 0.55 });
    }

    return picked.map(c => rgbToHex(c.r, c.g, c.b));
  } catch {
    return fallbackPalette(seed || imageUrl);
  }
}
