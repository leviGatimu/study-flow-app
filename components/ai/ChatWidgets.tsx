'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  GraduationCap,
  Info,
  Lightbulb,
  ListChecks,
  ListOrdered,
  OctagonAlert,
  Play,
  Table2,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { SubjectIcon } from '@/components/subjects/SubjectIcon';
import { CountUp } from '@/components/ui/count-up';
import type { Tone, Widget } from '@/lib/chat-ui';
import { cn } from '@/lib/utils';

/**
 * The visual cards the Study AI puts in its replies (lib/chat-ui.ts says what
 * each holds). Data cards (schedule, exams, homework, marks) show the rows
 * the server saved from the student's records.
 */

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.2, 0, 0, 1] } },
};

const TONE: Record<Tone, { tile: string; text: string; bar: string; soft: string }> = {
  primary: { tile: 'bg-primary/10 text-primary', text: 'text-primary', bar: 'bg-primary', soft: 'border-primary/25 bg-primary/5' },
  success: { tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', soft: 'border-emerald-500/25 bg-emerald-500/5' },
  warning: { tile: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', soft: 'border-amber-500/25 bg-amber-500/5' },
  danger: { tile: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500', soft: 'border-rose-500/25 bg-rose-500/5' },
  info: { tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', text: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500', soft: 'border-sky-500/25 bg-sky-500/5' },
};

function Card({ icon: Icon, title, aside, children, className }: { icon: LucideIcon; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className={cn('not-prose my-4 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm', className)}
    >
      <header className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{title}</h3>
        {aside}
      </header>
      {children}
    </motion.section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted-foreground">{children}</p>;
}

const due = (d: number, word = 'Due') =>
  d < 0 ? { text: `${-d} day${d === -1 ? '' : 's'} late`, tone: 'danger' as Tone } : d === 0 ? { text: `${word} today`, tone: 'danger' as Tone } : d === 1 ? { text: 'Tomorrow', tone: 'warning' as Tone } : { text: `In ${d} days`, tone: (d <= 7 ? 'warning' : 'primary') as Tone };

function Chip({ tone, children, icon: Icon }: { tone: Tone; children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', TONE[tone].tile)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ data cards */

/** Long lists show this many rows, then a link to the page with the rest. */
const SHOWN = 6;

function More({ href, count, what }: { href: string; count: number; what: string }) {
  return (
    <Link href={href} className="block border-t border-border/50 px-4 py-2.5 text-center text-xs font-bold text-primary hover:bg-primary/5">
      +{count} more {what}
    </Link>
  );
}

function ScheduleCard({ w }: { w: Extract<Widget, { type: 'schedule' }> }) {
  const rows = w.rows ?? [];
  const done = rows.filter((r) => r.status === 'done').length;
  const next = rows.find((r) => r.status === 'pending');
  return (
    <Card
      icon={CalendarDays}
      title={w.title ?? w.label ?? 'Schedule'}
      aside={rows.length > 0 && <span className="text-xs font-bold tabular-nums text-muted-foreground">{done}/{rows.length} done</span>}
    >
      {rows.length === 0 ? (
        <Empty>Nothing planned that day.</Empty>
      ) : (
        <motion.ol initial="hidden" animate="show" variants={list} className="relative p-2">
          {rows.map((r, i) => (
            <motion.li key={i} variants={item} className="relative flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50">
              <span className="w-[5.5rem] shrink-0 text-right font-heading text-xs font-bold tabular-nums text-muted-foreground">
                {r.start}–{r.end}
              </span>
              <span
                className={cn(
                  'relative z-10 grid size-5 shrink-0 place-items-center rounded-full border-2 bg-card',
                  r.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : r.status === 'missed' ? 'border-rose-400' : r === next ? 'border-primary' : 'border-border'
                )}
              >
                {r.status === 'done' && <Check className="size-3" strokeWidth={3} />}
                {r === next && <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />}
              </span>
              <SubjectIcon name={r.subject} className="size-9 rounded-xl" iconClassName="!size-4" />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-bold', r.status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{r.subject}</span>
                <span className={cn('block text-xs font-semibold', r.type === 'REVISION' ? 'text-orange-600 dark:text-orange-400' : 'text-primary')}>
                  {r.type === 'REVISION' ? 'Revision' : r.type === 'EXAM' ? 'Exam prep' : 'Homework'}
                </span>
              </span>
              {r.status === 'done' ? (
                <Chip tone="success" icon={CheckCircle2}>Done</Chip>
              ) : r.status === 'missed' ? (
                <Chip tone="danger">Missed</Chip>
              ) : r === next ? (
                <Link href="/focus" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90">
                  <Play className="size-3 fill-current" /> Focus
                </Link>
              ) : (
                <Chip tone="primary">To do</Chip>
              )}
            </motion.li>
          ))}
        </motion.ol>
      )}
    </Card>
  );
}

function ExamsCard({ w }: { w: Extract<Widget, { type: 'exams' }> }) {
  const all = w.rows ?? [];
  const rows = all.slice(0, SHOWN);
  return (
    <Card icon={GraduationCap} title={w.title ?? 'Upcoming exams'} aside={<Link href="/exams" className="text-xs font-bold text-primary hover:underline">All exams</Link>}>
      {rows.length === 0 ? (
        <Empty>No upcoming exams.</Empty>
      ) : (
        <motion.ul initial="hidden" animate="show" variants={list} className="p-2">
          {rows.map((e, i) => {
            const d = due(e.daysLeft, 'Exam');
            return (
              <motion.li key={i} variants={item} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/50">
                <SubjectIcon name={e.subject ?? e.title} className="size-9 rounded-xl" iconClassName="!size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{e.title}</span>
                  <span className="block text-xs font-semibold text-muted-foreground">{e.date}{e.time ? ` · ${e.time}` : ''}</span>
                </span>
                <Chip tone={d.tone} icon={CalendarClock}>{d.text}</Chip>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
      {all.length > SHOWN && <More href="/exams" count={all.length - SHOWN} what="exams" />}
    </Card>
  );
}

function HomeworkCard({ w }: { w: Extract<Widget, { type: 'homework' }> }) {
  const all = w.rows ?? [];
  const rows = all.slice(0, SHOWN);
  return (
    <Card icon={BookOpen} title={w.title ?? 'Homework'} aside={<Link href="/homeworks" className="text-xs font-bold text-primary hover:underline">Open</Link>}>
      {rows.length === 0 ? (
        <Empty>No unfinished homework. Nice.</Empty>
      ) : (
        <motion.ul initial="hidden" animate="show" variants={list} className="p-2">
          {rows.map((h, i) => {
            const d = due(h.daysLeft);
            return (
              <motion.li key={i} variants={item} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/50">
                <SubjectIcon name={h.subject} className="size-9 rounded-xl" iconClassName="!size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{h.title}</span>
                  <span className="block text-xs font-semibold text-muted-foreground">{h.subject} · {h.due}</span>
                </span>
                <Chip tone={d.tone}>{d.text}</Chip>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
      {all.length > SHOWN && <More href="/homeworks" count={all.length - SHOWN} what="homework" />}
    </Card>
  );
}

function MarksCard({ w }: { w: Extract<Widget, { type: 'marks' }> }) {
  const rows = w.rows ?? [];
  return (
    <Card icon={TrendingUp} title={w.title ?? 'Your marks'} aside={<Link href="/marks" className="text-xs font-bold text-primary hover:underline">Marks</Link>}>
      {rows.length === 0 ? (
        <Empty>No marks yet.</Empty>
      ) : (
        <ul className="space-y-3 p-4">
          {rows.map((m, i) => (
            <li key={i} className="flex items-center gap-3">
              <SubjectIcon name={m.subject} className="size-8 rounded-lg" iconClassName="!size-4" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">{m.subject}</span>
                  <span className="shrink-0 font-heading text-sm font-black tabular-nums">
                    {m.percent}%{m.goal !== null && <span className="ml-1 text-xs font-semibold text-muted-foreground">/ goal {m.goal}%</span>}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, m.percent)}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.2, 0, 0, 1] }}
                    className={cn('h-full rounded-full', m.goal !== null ? (m.percent >= m.goal ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-primary')}
                  />
                  {m.goal !== null && <span className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: `${Math.min(100, m.goal)}%` }} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------- drawn cards */

function StatsCard({ w }: { w: Extract<Widget, { type: 'stats' }> }) {
  const icons = [Target, TrendingUp, CalendarClock, CheckCircle2, ListChecks, BarChart3];
  return (
    <motion.div initial="hidden" animate="show" variants={list} className={cn('not-prose my-4 grid gap-3', w.items.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {w.items.map((s, i) => {
        const Icon = icons[i % icons.length];
        const t = TONE[s.tone ?? 'primary'];
        return (
          <motion.div key={i} variants={item} className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
            <span className={cn('grid size-9 place-items-center rounded-xl', t.tile)}>
              <Icon className="size-4" />
            </span>
            <p className="mt-3 font-heading text-2xl font-black tabular-nums leading-none">
              <CountUp value={s.value} />
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">{s.label}</p>
            {s.hint && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{s.hint}</p>}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function BarsCard({ w }: { w: Extract<Widget, { type: 'bars' }> }) {
  return (
    <Card icon={BarChart3} title={w.title ?? 'Comparison'}>
      <ul className="space-y-3 p-4">
        {w.items.map((b, i) => {
          const pct = Math.min(100, (b.value / w.max) * 100);
          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-bold">{b.label}</span>
                <span className="shrink-0 font-heading font-black tabular-nums">
                  {Number.isInteger(b.value) ? b.value : b.value.toFixed(1)}
                  {w.unit ?? ''}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.2, 0, 0, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StepsCard({ w }: { w: Extract<Widget, { type: 'steps' }> }) {
  return (
    <Card icon={ListOrdered} title={w.title ?? 'Steps'}>
      <motion.ol initial="hidden" animate="show" variants={list} className="relative space-y-1 p-3">
        <span aria-hidden className="absolute bottom-6 left-[1.6rem] top-6 w-px bg-border" />
        {w.items.map((s, i) => (
          <motion.li key={i} variants={item} className="relative flex gap-3 rounded-2xl px-2 py-2">
            <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm shadow-primary/30">{i + 1}</span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-bold">{s.title}</span>
                {s.time && <span className="text-xs font-semibold text-muted-foreground">{s.time}</span>}
              </span>
              {s.detail && <span className="mt-0.5 block text-sm text-muted-foreground">{s.detail}</span>}
            </span>
          </motion.li>
        ))}
      </motion.ol>
    </Card>
  );
}

function ChecklistCard({ w }: { w: Extract<Widget, { type: 'checklist' }> }) {
  const done = w.items.filter((i) => i.done).length;
  return (
    <Card icon={ListChecks} title={w.title ?? 'Checklist'} aside={<span className="text-xs font-bold tabular-nums text-muted-foreground">{done}/{w.items.length}</span>}>
      <motion.ul initial="hidden" animate="show" variants={list} className="p-2">
        {w.items.map((c, i) => (
          <motion.li key={i} variants={item} className="flex items-center gap-3 rounded-2xl px-2 py-2">
            {c.done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-500" /> : <Circle className="size-5 shrink-0 text-muted-foreground/50" />}
            <span className={cn('text-sm font-medium', c.done && 'text-muted-foreground line-through')}>{c.text}</span>
          </motion.li>
        ))}
      </motion.ul>
    </Card>
  );
}

function CalloutCard({ w }: { w: Extract<Widget, { type: 'callout' }> }) {
  const Icon = { primary: Lightbulb, info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert }[w.tone];
  const t = TONE[w.tone];
  return (
    <motion.aside
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('not-prose my-4 flex gap-3 rounded-3xl border p-4', t.soft)}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', t.tile)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        {w.title && <p className={cn('text-sm font-bold', t.text)}>{w.title}</p>}
        <p className="text-sm text-foreground/90">{w.text}</p>
      </div>
    </motion.aside>
  );
}

function TableCard({ w }: { w: Extract<Widget, { type: 'table' }> }) {
  return (
    <Card icon={Table2} title={w.title ?? 'Table'}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              {w.columns.map((c, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.rows.map((r, i) => (
              <tr key={i} className="border-t border-border/50 transition-colors hover:bg-muted/40">
                {r.map((cell, j) => (
                  <td key={j} className={cn('px-4 py-2.5', j === 0 && 'font-bold')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** One card, or a shimmering placeholder while it is still being written or filled. */
export function ChatWidget({ widget }: { widget: Widget | null }) {
  if (!widget || (['schedule', 'exams', 'homework', 'marks'].includes(widget.type) && !('rows' in widget && widget.rows))) {
    return (
      <div className="not-prose my-4 space-y-2.5 rounded-3xl border border-border/60 bg-card p-4" aria-label="Loading card">
        <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-10 animate-pulse rounded-2xl bg-muted/70" />
        <div className="h-10 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }
  switch (widget.type) {
    case 'schedule':
      return <ScheduleCard w={widget} />;
    case 'exams':
      return <ExamsCard w={widget} />;
    case 'homework':
      return <HomeworkCard w={widget} />;
    case 'marks':
      return <MarksCard w={widget} />;
    case 'stats':
      return <StatsCard w={widget} />;
    case 'bars':
      return <BarsCard w={widget} />;
    case 'steps':
      return <StepsCard w={widget} />;
    case 'checklist':
      return <ChecklistCard w={widget} />;
    case 'callout':
      return <CalloutCard w={widget} />;
    case 'table':
      return <TableCard w={widget} />;
  }
}
