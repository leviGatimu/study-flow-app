'use client';

/**
 * The right-hand side of /setup: the workspace the person is building, drawn
 * live from what they have saved plus what they are typing right now. The part
 * the current step fills in is lit; the rest waits, dimmed.
 */

import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, CalendarDays, Library, School } from 'lucide-react';

import type { SetupBlock } from '@/lib/setup';
import { cn } from '@/lib/utils';

export type PreviewFocus = 'all' | 'greeting' | 'year' | 'ai' | 'subjects' | 'school' | 'week';

export type PreviewData = {
  name: string;
  timezone: string;
  classLabel: string;
  termName: string;
  termEndDate: string;
  aiOn: boolean;
  subjects: string[];
  schoolLessonCount: number;
  blocks: SetupBlock[];
  /** How many of `blocks` are an unsaved AI proposal. */
  proposedCount?: number;
};

const subscribeClock = (onTick: () => void) => { const t = setInterval(onTick, 30_000); return () => clearInterval(t); };
const clockSnapshot = () => Math.floor(Date.now() / 30_000);

function zoneParts(zone: string) {
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(now);
    const day = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(now));
    return { time, day, hour };
  } catch {
    return null;
  }
}

function daysUntil(isoDate: string) {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

function Section({ id, focus, icon: Icon, title, children }: { id: PreviewFocus; focus: PreviewFocus; icon: typeof Library; title: string; children: React.ReactNode }) {
  const lit = focus === 'all' || focus === id;
  return <motion.section
    animate={{ opacity: lit ? 1 : 0.38, scale: lit && focus !== 'all' ? 1.01 : 1 }}
    transition={{ duration: 0.4 }}
    className={cn('rounded-xl border bg-background/50 p-4 transition-[border-color,box-shadow] duration-300',
      lit && focus !== 'all' ? 'border-primary/60 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]' : 'border-border')}>
    <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{title}</p>
    {children}
  </motion.section>;
}

export function WorkspacePreview({ data, focus }: { data: PreviewData; focus: PreviewFocus }) {
  const tick = useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
  const parts = tick === null ? null : zoneParts(data.timezone);
  const greeting = !parts ? 'Hello' : parts.hour < 12 ? 'Good morning' : parts.hour < 18 ? 'Good afternoon' : 'Good evening';
  const left = daysUntil(data.termEndDate);
  const firstName = data.name.trim().split(/\s+/)[0] || 'there';

  const byDay = new Map<number, SetupBlock[]>();
  for (const b of data.blocks) byDay.set(b.dayOfWeek, [...(byDay.get(b.dayOfWeek) ?? []), b]);
  const totalMinutes = data.blocks.reduce((sum, b) => sum + Math.max(0, minutes(b.endTime) - minutes(b.startTime)), 0);

  return <div className="w-full max-w-[520px]" aria-hidden="true">
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-xs font-medium text-muted-foreground">Your workspace</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />Updates as you go</span>
      </div>
      <div className="grid gap-3 p-5">
        <motion.div animate={{ opacity: focus === 'all' || focus === 'greeting' || focus === 'year' ? 1 : 0.38 }} transition={{ duration: 0.4 }}>
          <p className="text-xs text-muted-foreground">{parts ? `${parts.day} · ${parts.time}` : ' '}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting},{' '}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={firstName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="inline-block text-primary">{firstName}</motion.span>
            </AnimatePresence>
          </p>
          <div className={cn('mt-3 flex flex-wrap items-center gap-2 rounded-lg transition-shadow', focus === 'year' && 'shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]')}>
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium">{data.classLabel || 'Your year'}</span>
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium">{data.termName || 'Your term'}</span>
            {left !== null && left >= 0 && <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{left} days left in term</motion.span>}
            <span className="ml-auto text-[11px] text-muted-foreground">{data.timezone.replaceAll('_', ' ')}</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <Section id="ai" focus={focus} icon={BrainCircuit} title="Study assistant">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className={cn('size-2 rounded-full', data.aiOn ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
              {data.aiOn ? 'Connected' : 'Not connected'}
            </p>
          </Section>
          <Section id="school" focus={focus} icon={School} title="School lessons">
            <p className="text-sm font-medium">{data.schoolLessonCount ? `${data.schoolLessonCount} lessons` : 'None yet'}</p>
          </Section>
        </div>

        <Section id="subjects" focus={focus} icon={Library} title={`Subjects${data.subjects.length ? ` · ${data.subjects.length}` : ''}`}>
          {data.subjects.length === 0
            ? <p className="text-sm text-muted-foreground">Your subjects will appear here.</p>
            : <motion.ul layout className="flex max-h-[76px] flex-wrap gap-1.5 overflow-hidden">
              <AnimatePresence initial={false}>
                {data.subjects.map((s) => <motion.li layout key={s} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">{s}</motion.li>)}
              </AnimatePresence>
            </motion.ul>}
        </Section>

        <Section id="week" focus={focus} icon={CalendarDays} title={`Study week${data.blocks.length ? ` · ${data.blocks.length} blocks · ${Math.round(totalMinutes / 6) / 10}h` : ''}${data.proposedCount ? ` (${data.proposedCount} proposed)` : ''}`}>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => <div key={d} className="flex min-h-[92px] flex-col gap-1">
              <span className="text-center text-[10px] font-semibold text-muted-foreground">{DAY_SHORT[d]}</span>
              <AnimatePresence initial={false}>
                {(byDay.get(d) ?? []).slice(0, 4).map((b, i) => {
                  const h = Math.max(10, Math.min(48, (minutes(b.endTime) - minutes(b.startTime)) / 4));
                  return <motion.span key={`${b.subject}-${b.startTime}-${i}`} title={`${b.subject} ${b.startTime}–${b.endTime}`}
                    initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.35 }}
                    className={cn('origin-top rounded-[5px] border-2', b.type === 'REVISION' ? 'border-dashed border-orange-500/70 bg-orange-500/10' : 'border-blue-500/70 bg-blue-500/15')}
                    style={{ height: h }} />;
                })}
              </AnimatePresence>
              {!(byDay.get(d)?.length) && <span className="flex-1 rounded-[5px] border border-dashed border-border/70" />}
            </div>)}
          </div>
        </Section>
      </div>
    </div>
  </div>;
}
