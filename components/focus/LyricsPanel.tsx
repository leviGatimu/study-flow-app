'use client';

import { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { parseLrc, isSyncedLyrics } from '@/lib/lyrics';

interface LyricsPanelProps {
  lyrics: string;
  currentTime: number;
  onSeek: (time: number) => void;
  className?: string;
  /** Big, borderless, edge-faded karaoke layout that fills its container. */
  immersive?: boolean;
  /** Accent colour for the active-line glow (e.g. the current album palette). */
  accent?: string;
}

/**
 * Apple Music-style karaoke pane: the active line is bright and bold, past and
 * future lines fall away with distance-based blur. In `immersive` mode the type
 * is large, the chrome disappears and the lines melt into the scene at the edges.
 */
export function LyricsPanel({ lyrics, currentTime, onSeek, className, immersive = false, accent = '#ffffff' }: LyricsPanelProps) {
  const synced = useMemo(() => isSyncedLyrics(lyrics), [lyrics]);
  const lines = useMemo(() => (synced ? parseLrc(lyrics) : []), [lyrics, synced]);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLButtonElement>(null);

  // Slight lookahead so the highlight lands as the word is sung.
  const activeIndex = useMemo(() => {
    if (!synced) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.3) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTime, synced]);

  useEffect(() => {
    const el = activeLineRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const target = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [activeIndex]);

  // Lines melt into the scene at the top & bottom edges.
  const fadeMask = immersive
    ? {
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
      }
    : undefined;

  if (!synced) {
    return (
      <div className={cn('overflow-y-auto custom-scrollbar', className)} style={fadeMask}>
        <p
          className={cn(
            'whitespace-pre-line font-bold',
            immersive ? 'text-[1.9rem] md:text-[2.4rem] leading-[1.6] text-white/80 py-[22%] tracking-tight' : 'text-sm leading-7 text-white/70 pb-8'
          )}
        >
          {lyrics}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('overflow-y-auto custom-scrollbar scroll-smooth', className)} style={fadeMask}>
      <div className={cn(immersive ? 'space-y-2 py-[45%]' : 'space-y-1 py-[40%]')}>
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const dist = activeIndex < 0 ? 99 : Math.abs(i - activeIndex);
          // Distance-based depth: nearby lines stay legible, far ones blur away.
          const blur = immersive ? (isActive ? 0 : Math.min(3.5, dist * 1.2)) : isActive ? 0 : 0.4;
          const opacity = isActive ? 1 : Math.max(0.18, 0.62 - dist * 0.13);

          return (
            <button
              key={`${line.time}-${i}`}
              ref={isActive ? activeLineRef : undefined}
              onClick={() => onSeek(line.time)}
              style={{
                filter: blur ? `blur(${blur}px)` : undefined,
                opacity,
                ...(isActive && immersive
                  ? { textShadow: `0 0 30px ${accent}66, 0 2px 12px rgba(0,0,0,0.55)` }
                  : {}),
              }}
              className={cn(
                'block w-full text-left transition-all duration-500 ease-out origin-left hover:opacity-100',
                immersive ? 'px-1 py-1.5 rounded-xl' : 'px-3 py-2 rounded-2xl hover:bg-white/10',
                isActive
                  ? immersive
                    ? 'text-white font-black text-[2.5rem] md:text-[3.4rem] xl:text-[4.2rem] leading-[1.04] tracking-tight scale-[1.015]'
                    : 'text-white font-black text-xl md:text-2xl leading-snug drop-shadow-lg'
                  : immersive
                    ? 'text-white/75 font-black text-[1.9rem] md:text-[2.6rem] xl:text-[3.1rem] leading-[1.1] tracking-tight'
                    : 'text-white/35 font-bold text-lg md:text-xl leading-snug blur-[0.4px]'
              )}
            >
              {line.text || '♪'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
