'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reveal a reply a few words at a time, the way a chat app streams it.
 *
 * The answer arrives whole from the server, so this is presentation only: the
 * full text is already saved, copying copies all of it, and `finish()` (or a
 * reduced-motion setting) shows everything at once. Short replies type in
 * well under a second; long ones are capped at a few seconds so nobody waits
 * on the animation. Cuts land on whitespace so half a word never shows.
 */
export function useTypewriter(text: string, enabled: boolean) {
  const [count, setCount] = useState(() => (enabled ? 0 : text.length));
  const frame = useRef<number | null>(null);

  const finish = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setCount(text.length);
  }, [text.length]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      frame.current = requestAnimationFrame(() => setCount(text.length));
      return () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
      };
    }

    // ~70 characters a second, between 0.6 s and 4 s in total.
    const duration = Math.min(4000, Math.max(600, text.length * 14));
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const target = Math.min(text.length, Math.ceil(((now - start) / duration) * text.length));
      setCount((prev) => (target > prev ? target : prev));
      if (target < text.length) frame.current = requestAnimationFrame(tick);
      else frame.current = null;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [enabled, text.length]);

  const done = count >= text.length;
  let shown = text;
  if (!done) {
    const space = text.slice(count).search(/\s/);
    shown = space === -1 ? text : text.slice(0, count + space);
  }
  return { shown, done: done || shown.length >= text.length, finish };
}
