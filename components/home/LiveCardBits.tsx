'use client';

/**
 * Small animated pieces for the home page's live card (LiveFocusCard). They
 * only add motion and icons around the card's own type: every font class the
 * card used is passed through unchanged.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { SubjectIcon } from '@/components/subjects/SubjectIcon';
import { cn } from '@/lib/utils';

/** Soft light drifting across the card, and the state's icon floating large in the corner. */
export function CardDecor({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="live-card-glow absolute -right-24 -top-32 size-96 rounded-full bg-white/15 blur-[90px]" />
      <div className="live-card-glow live-card-glow-slow absolute -bottom-40 left-1/4 size-80 rounded-full bg-white/10 blur-[90px]" />
      <Icon strokeWidth={1.25} className="live-card-float absolute -bottom-10 right-[22%] size-56 text-white/[0.07] max-lg:hidden" />
    </div>
  );
}

/** The status pill, with its icon and a live dot. Text classes are the card's own. */
export function StatusChip({ icon: Icon, children, live = true }: { icon: LucideIcon; children: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/20 py-1.5 pl-2.5 pr-4 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
      <span className="relative grid size-4 place-items-center">
        {live && <span className="absolute inset-0 rounded-full bg-white/40 motion-safe:animate-ping" />}
        <Icon className="relative size-3.5" />
      </span>
      {children}
    </div>
  );
}

/** The subject's own icon, popping in next to the headline. */
export function SubjectBadge({ name }: { name: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.15 }}
      className="shrink-0"
    >
      <SubjectIcon name={name} className="size-12 rounded-2xl shadow-lg ring-2 ring-white/30 md:size-14" iconClassName="!size-6 md:!size-7" />
    </motion.span>
  );
}

/** One character that rolls (slides and blurs) when it changes. */
function Roll({ text }: { text: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="inline-flex">
      {text.split('').map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden">
          {reduce ? (
            ch
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                initial={{ y: '-70%', opacity: 0, filter: 'blur(4px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: '70%', opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * The countdown in the card's exact type (font-heading font-black, 5xl/6xl
 * minutes, smaller faded seconds), with each digit rolling as it ticks.
 */
export function RollingTime({ time, className }: { time: { h: number; m: number; s: number }; className?: string }) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <div className={cn('flex items-baseline font-heading font-black tracking-tighter tabular-nums text-white', className)}>
      <span className="text-5xl md:text-6xl">
        <Roll text={`${time.h > 0 ? `${pad(time.h)}:` : ''}${pad(time.m)}`} />
      </span>
      <span className="text-2xl md:text-3xl opacity-40 mx-1">:</span>
      <span className="text-2xl md:text-3xl opacity-60">
        <Roll text={pad(time.s)} />
      </span>
    </div>
  );
}

/** The "then ..." pill: the next subject's icon in place of a generic one. */
export function NextChip({ subject, icon: Icon, children }: { subject?: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl w-fit max-w-xl backdrop-blur-md transition-colors hover:bg-white/15">
      {subject ? (
        <SubjectIcon name={subject} className="size-6 shrink-0 rounded-lg" iconClassName="!size-3.5" />
      ) : (
        <Icon className="w-4 h-4 shrink-0 text-white" />
      )}
      {children}
    </div>
  );
}
