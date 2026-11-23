'use client';

/**
 * The birthday celebration. Mounted once in AppShell. On the student's
 * birthday (in their own timezone) it:
 *   - switches the whole app to a party theme for the day (html[data-birthday],
 *     colours in app/globals.css);
 *   - bursts confetti the first time the app is opened that day, and again
 *     whenever something calls celebrate() (the Today card's button);
 *   - sends a few balloons up the screen.
 * The rest of the year it renders nothing. Reduced motion keeps the theme and
 * skips the confetti and balloons.
 */

import { useEffect, useState } from 'react';

import { ageOn, isBirthdayOn, parseBirthday } from '@/lib/birthday';

const CELEBRATE = 'study-flow:celebrate';
const COLORS = ['#f472b6', '#a78bfa', '#facc15', '#34d399', '#60a5fa', '#fb7185', '#f97316'];

/** Replay the confetti from anywhere (the Today birthday card). */
export function celebrate() {
  window.dispatchEvent(new Event(CELEBRATE));
}

function todayKey(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Whether today is the birthday, and which one, kept current across midnight. */
export function useBirthdayToday(birthday: string | null | undefined, timezone: string) {
  const [state, setState] = useState<{ isToday: boolean; age: number | null }>({ isToday: false, age: null });
  useEffect(() => {
    const b = parseBirthday(birthday);
    const check = () => {
      const key = todayKey(timezone);
      setState({ isToday: isBirthdayOn(b, key), age: ageOn(b, key) });
    };
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [birthday, timezone]);
  return state;
}

type Piece = { id: number; left: number; color: string; size: number; delay: number; duration: number; drift: number; spin: number; round: boolean };
type Balloon = { id: number; left: number; color: string; delay: number; duration: number; scale: number };

export function BirthdayMode({ birthday, timezone }: { birthday: string | null | undefined; timezone: string }) {
  const { isToday } = useBirthdayToday(birthday, timezone);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [balloons, setBalloons] = useState<Balloon[]>([]);

  // The party theme for the whole app, only for the day.
  useEffect(() => {
    const root = document.documentElement;
    if (isToday) root.dataset.birthday = 'true';
    else delete root.dataset.birthday;
    return () => {
      delete root.dataset.birthday;
    };
  }, [isToday]);

  useEffect(() => {
    if (!isToday) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let clear: ReturnType<typeof setTimeout> | undefined;

    const burst = () => {
      if (reduce) return;
      const now = Date.now();
      setPieces(
        Array.from({ length: 140 }, (_, i) => ({
          id: now + i,
          left: Math.random() * 100,
          color: COLORS[i % COLORS.length],
          size: 6 + Math.random() * 7,
          delay: Math.random() * 0.6,
          duration: 2.6 + Math.random() * 1.8,
          drift: (Math.random() - 0.5) * 160,
          spin: (Math.random() - 0.5) * 1080,
          round: Math.random() < 0.3,
        }))
      );
      setBalloons(
        Array.from({ length: 6 }, (_, i) => ({
          id: now + 1000 + i,
          left: 6 + i * 16 + Math.random() * 6,
          color: COLORS[(i * 2) % COLORS.length],
          delay: 0.3 + Math.random() * 1.2,
          duration: 7 + Math.random() * 3,
          scale: 0.8 + Math.random() * 0.5,
        }))
      );
      if (clear) clearTimeout(clear);
      clear = setTimeout(() => {
        setPieces([]);
        setBalloons([]);
      }, 11_000);
    };

    // Once per day on its own; the Today card can ask for more.
    const seenKey = `study-flow-birthday-${todayKey(timezone)}`;
    let first: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, '1');
        first = setTimeout(burst, 700);
      }
    } catch {
      first = setTimeout(burst, 700);
    }
    window.addEventListener(CELEBRATE, burst);
    return () => {
      window.removeEventListener(CELEBRATE, burst);
      if (first) clearTimeout(first);
      if (clear) clearTimeout(clear);
    };
  }, [isToday, timezone]);

  if (!isToday || (pieces.length === 0 && balloons.length === 0)) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {balloons.map((b) => (
        <span
          key={b.id}
          className="birthday-balloon absolute bottom-0"
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, ['--s' as string]: b.scale }}
        >
          <svg width="44" height="96" viewBox="0 0 44 96">
            <ellipse cx="22" cy="24" rx="20" ry="24" fill={b.color} />
            <ellipse cx="15" cy="15" rx="5" ry="7" fill="white" opacity="0.35" />
            <path d="M19 47 L25 47 L22 52 Z" fill={b.color} />
            <path d="M22 52 C 16 62, 28 72, 22 82 S 18 92, 22 96" stroke="currentColor" strokeOpacity="0.35" fill="none" strokeWidth="1.2" />
          </svg>
        </span>
      ))}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="birthday-confetti absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? '9999px' : '2px',
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
