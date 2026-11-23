'use client';

import { subjectStyle } from '@/components/subjects/SubjectIcon';
import { cn } from '@/lib/utils';

/**
 * The focus timer's "album cover": a square card in the room's colours with
 * the time in the middle and the subject's icon faded in the corner. It is
 * the same size and shape as the cover in the music view, so the timer and
 * the music read as two sides of one player. Used before (setup), during and
 * after a session. Digits sit in fixed-width boxes so they never shift.
 */
export function FocusCard({
  subject,
  time,
  chip,
  chipTone = 'live',
  note,
  palette,
  accent,
  fontClass,
  dim = false,
  children,
}: {
  subject: string;
  time: { h: number; m: number; s: number };
  chip: string;
  chipTone?: 'live' | 'paused' | 'ember' | 'done' | 'idle';
  note?: string;
  palette: string[];
  accent: string;
  fontClass: string;
  dim?: boolean;
  children?: React.ReactNode;
}) {
  const { Icon } = subjectStyle(subject);
  const dot = {
    live: accent,
    paused: '#fbbf24',
    ember: '#fb923c',
    done: '#34d399',
    idle: 'rgba(255,255,255,0.6)',
  }[chipTone];

  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-3xl ring-1 ring-white/10"
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, ${palette[2] ?? '#ffffff'}55, transparent 60%), linear-gradient(145deg, ${palette[1] ?? '#1f2937'}, ${palette[0] ?? '#111827'} 55%, ${palette[3] ?? '#030712'})`,
        boxShadow: `0 30px 80px -20px ${accent.startsWith('#') ? `${accent}66` : 'rgba(255,255,255,0.25)'}, 0 20px 50px -20px rgba(0,0,0,0.8)`,
        containerType: 'inline-size',
      }}
    >
      <Icon aria-hidden strokeWidth={1.25} className="absolute -bottom-[6%] -right-[6%] size-[40%] text-white/[0.07]" />

      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
        <span
          className={cn('size-1.5 rounded-full', chipTone === 'live' && 'motion-safe:animate-pulse')}
          style={{ backgroundColor: dot }}
        />
        {chip}
      </span>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div
          role="timer"
          aria-label={`${time.h > 0 ? `${time.h} hours ` : ''}${time.m} minutes ${time.s} seconds`}
          className={cn('flex items-center leading-none text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.35)] transition-opacity duration-500', fontClass, dim && 'opacity-55')}
          style={{ fontSize: time.h > 0 ? '15cqw' : '21cqw' }}
        >
          <ClockDigits time={time} />
        </div>
        {note && <p className="mt-[3cqw] text-[clamp(0.8rem,4cqw,1rem)] text-white/70">{note}</p>}
      </div>

      {children}
    </div>
  );
}

/** h:mm:ss with each digit in a fixed-width box, so nothing shifts as it ticks. */
export function ClockDigits({ time }: { time: { h: number; m: number; s: number } }) {
  const parts = [
    ...(time.h > 0 ? [String(time.h).padStart(2, '0')] : []),
    String(time.m).padStart(2, '0'),
    String(time.s).padStart(2, '0'),
  ];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <span className="-mt-[0.1em] px-[0.03em] text-[0.7em] text-white/35">:</span>}
          {part.split('').map((d, j) => (
            <span key={j} className="inline-block w-[0.64em] text-center">{d}</span>
          ))}
        </span>
      ))}
    </>
  );
}
