/**
 * The fonts the focus clock can use (Focus settings > Clock). next/font
 * downloads them at build time and serves them from the app itself, so they
 * work offline in the desktop app too.
 */
import { Fraunces, JetBrains_Mono, Nunito, Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], weight: ['700'], display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], display: 'swap' });
const rounded = Nunito({ subsets: ['latin'], weight: ['800'], display: 'swap' });
const classic = Fraunces({ subsets: ['latin'], weight: ['600'], display: 'swap' });

export type ClockFontId = 'BOLD' | 'MONO' | 'ROUNDED' | 'CLASSIC';

export const CLOCK_FONTS: { id: ClockFontId; label: string; className: string }[] = [
  { id: 'BOLD', label: 'Bold', className: outfit.className },
  { id: 'MONO', label: 'Mono', className: mono.className },
  { id: 'ROUNDED', label: 'Rounded', className: rounded.className },
  { id: 'CLASSIC', label: 'Classic', className: classic.className },
];

export const CLOCK_FONT_KEY = 'study-flow-clock-font';

export function clockFontClass(id: ClockFontId): string {
  return (CLOCK_FONTS.find((f) => f.id === id) ?? CLOCK_FONTS[0]).className;
}

export function isClockFontId(value: unknown): value is ClockFontId {
  return CLOCK_FONTS.some((f) => f.id === value);
}
