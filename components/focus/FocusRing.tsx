'use client';

import { cn } from '@/lib/utils';

/**
 * The focus clock: the time inside a ring that fills as the session goes.
 * Each digit sits in a fixed-width box so the numbers never shift sideways as
 * they tick, whatever font is chosen.
 */
export function FocusRing({
  time,
  fraction,
  paused,
  accent,
  fontClass,
  subject,
  status,
  detail,
}: {
  time: { h: number; m: number; s: number };
  /** 0..1, how far through the session. */
  fraction: number;
  paused: boolean;
  accent: string;
  fontClass: string;
  subject: string;
  status: string;
  detail: string;
}) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const shown = Math.min(1, Math.max(0, fraction));
  const parts = [
    ...(time.h > 0 ? [String(time.h).padStart(2, '0')] : []),
    String(time.m).padStart(2, '0'),
    String(time.s).padStart(2, '0'),
  ];

  return (
    <div
      className="relative aspect-square w-[min(58vh,80vw,440px)]"
      style={{ containerType: 'inline-size' }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.4" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          className={cn('transition-[stroke-dashoffset,opacity] duration-1000 ease-linear', paused && 'opacity-40')}
          style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
        />
      </svg>

      <div className="absolute inset-[12%] flex flex-col items-center justify-center text-center">
        <p className="max-w-full truncate text-[clamp(0.85rem,4.2cqw,1.15rem)] font-medium text-white/75">{subject}</p>
        <div
          role="timer"
          aria-label={`${time.h > 0 ? `${time.h} hours ` : ''}${time.m} minutes ${time.s} seconds`}
          className={cn(
            'my-[2cqw] flex items-center leading-none text-white transition-opacity duration-500',
            fontClass,
            paused && 'opacity-50'
          )}
          style={{ fontSize: time.h > 0 ? '15cqw' : '21cqw' }}
        >
          {parts.map((part, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <span className="-mt-[0.1em] px-[0.02em] text-[0.8em] text-white/35">:</span>}
              {part.split('').map((d, j) => (
                <span key={j} className="inline-block w-[0.64em] text-center">{d}</span>
              ))}
            </span>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[clamp(0.8rem,3.6cqw,1rem)] text-white/60">
          <span
            className={cn('size-1.5 rounded-full', !paused && 'motion-safe:animate-pulse')}
            style={{ backgroundColor: paused ? '#fbbf24' : accent }}
          />
          <span className="font-medium text-white/85">{status}</span>
          <span aria-hidden>·</span>
          <span>{detail}</span>
        </p>
      </div>
    </div>
  );
}
