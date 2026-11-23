'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { motion, MotionConfig, type Variants } from 'framer-motion';
import {
  AlarmClock,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock,
  Flame,
  Hourglass,
  ListTodo,
  PartyPopper,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react';

import { blockLength, blockTiming, formatMinutes, toMinutes, type BlockTiming } from '@/lib/focus-plan';
import { cn, getZonedNow } from '@/lib/utils';
import { CountUp } from '@/components/ui/count-up';
import { SubjectIcon } from '@/components/subjects/SubjectIcon';
import { CardDecor, NextChip, StatusChip, SubjectBadge } from '@/components/home/LiveCardBits';

export type PlanTask = {
  id: string;
  subject: string;
  revision: boolean;
  startTime: string;
  endTime: string;
  isDone: boolean;
  isMissed: boolean;
  focusedSeconds: number;
  /** Matches the ?subject= the page was opened with. */
  match: boolean;
};

type Stats = { streak: number; totalMinutes: number; sessions: number };

/**
 * The Focus picker (/focus): a big "up next" card to start the obvious block in
 * one click, today's plan as a timeline, and on the side today's progress, a
 * free session and your focus totals. `tasks` arrive sorted (to do first, the
 * asked-for subject first, then by time). Anything that depends on the clock
 * is only drawn in the browser, in the student's own timezone.
 */
export function FocusLauncher({
  tasks,
  subject,
  freeHref,
  timezone,
  stats,
}: {
  tasks: PlanTask[];
  subject: string;
  freeHref: string;
  timezone: string;
  stats: Stats | null;
}) {
  const now = useNowMinutes(timezone);
  const [next, ...rest] = byUrgency(tasks.filter((t) => !t.isDone), now);
  // "Then ..." only names a block still ahead of this one, never a missed one.
  const afterNext = next
    ? rest.find((t) => !t.isMissed && (toMinutes(t.startTime) ?? 0) > (toMinutes(next.startTime) ?? 0))
    : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {next ? (
            <UpNext task={next} then={afterNext} now={now} />
          ) : (
            <NothingLeft hasTasks={tasks.length > 0} freeHref={freeHref} />
          )}
          <Timeline tasks={tasks} nextId={next?.id} subject={subject} now={now} freeHref={freeHref} />
        </div>

        <motion.aside
          initial="hidden"
          animate="show"
          variants={list}
          className="space-y-6 lg:col-span-4"
        >
          {tasks.length > 0 && <TodayRing tasks={tasks} now={now} />}
          <FreeSession href={freeHref} subject={subject} />
          {stats && <Totals stats={stats} />}
        </motion.aside>
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ clock */

const subscribeClock = (onChange: () => void) => {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
};

/** Minutes after midnight in the student's timezone; null on the server. */
function useNowMinutes(timezone: string): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => {
      const d = getZonedNow(timezone);
      return d.getHours() * 60 + d.getMinutes();
    },
    () => null
  );
}

function timingOf(task: PlanTask, now: number | null): BlockTiming | null {
  return now === null ? null : blockTiming(task.startTime, task.endTime, now);
}

/**
 * What to offer first: the subject the page was opened for, else the block
 * happening now, then the next one coming up, then ones that ran late or were
 * missed. Ties keep the page's time order. Before the clock is known (the
 * server render) missed blocks still go last.
 */
function byUrgency(todo: PlanTask[], now: number | null): PlanTask[] {
  const rank = (t: PlanTask) => {
    if (t.match) return 0;
    if (t.isMissed) return 4;
    const timing = timingOf(t, now);
    if (!timing) return 2;
    return timing.state === 'now' ? 1 : timing.state === 'past' ? 3 : 2;
  };
  return [...todo].sort((a, b) => rank(a) - rank(b));
}

/** Short words for where a block is against the clock. */
function timingLabel(task: PlanTask, timing: BlockTiming | null): { text: string; icon: LucideIcon; tone: 'now' | 'soon' | 'late' | 'calm' } | null {
  if (task.isDone) return null;
  if (task.isMissed) return { text: 'Missed', icon: AlarmClock, tone: 'late' };
  if (!timing) return null;
  switch (timing.state) {
    case 'now':
      return { text: `Now · ${formatMinutes(timing.minutesLeft)} left`, icon: Radio, tone: 'now' };
    case 'soon':
      return { text: `In ${formatMinutes(timing.minutesUntil)}`, icon: Hourglass, tone: 'soon' };
    case 'later':
      return { text: `At ${task.startTime}`, icon: CalendarClock, tone: 'calm' };
    case 'past':
      return { text: 'Running late', icon: AlarmClock, tone: 'late' };
  }
}

/* ---------------------------------------------------------------- motion */

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.2, 0, 0, 1] } },
};

/* --------------------------------------------------------------- up next */

function heroStatus(task: PlanTask, timing: BlockTiming | null): { text: string; icon: LucideIcon; live: boolean } {
  if (task.isMissed) return { text: 'Missed · catch up now', icon: AlarmClock, live: false };
  if (!timing) return { text: 'Up next', icon: Target, live: false };
  switch (timing.state) {
    case 'now':
      return { text: `Happening now · ${formatMinutes(timing.minutesLeft)} left`, icon: Radio, live: true };
    case 'soon':
      return { text: `Starts in ${formatMinutes(timing.minutesUntil)}`, icon: Hourglass, live: true };
    case 'later':
      return { text: `Up next · ${task.startTime}`, icon: CalendarClock, live: false };
    case 'past':
      return { text: 'Running late · still time', icon: AlarmClock, live: false };
  }
}

function UpNext({ task, then, now }: { task: PlanTask; then?: PlanTask; now: number | null }) {
  const status = heroStatus(task, timingOf(task, now));
  const TypeIcon = task.revision ? RotateCcw : BookOpen;
  const focusedMin = Math.round(task.focusedSeconds / 60);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      aria-label={`Up next: ${task.subject}`}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8"
    >
      <CardDecor icon={Target} />

      <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-5">
          <div className="flex">
            <StatusChip icon={status.icon} live={status.live}>
              {/* Re-keyed so a new status blurs in rather than snapping. */}
              <motion.span key={status.text} initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}>
                {status.text}
              </motion.span>
            </StatusChip>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <SubjectBadge name={task.subject} />
            <div className="min-w-0">
              <h2 className="truncate font-heading text-3xl font-black tracking-tight md:text-4xl">{task.subject}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-white/80">
                <Meta icon={Clock}>
                  {task.startTime}–{task.endTime}
                </Meta>
                <Meta icon={TypeIcon}>{task.revision ? 'Revision' : 'Homework'}</Meta>
                <Meta icon={Hourglass}>{formatMinutes(blockLength(task.startTime, task.endTime))}</Meta>
                {focusedMin > 0 && <Meta icon={Flame}>{formatMinutes(focusedMin)} done</Meta>}
              </div>
            </div>
          </div>

          {then && (
            <NextChip subject={then.subject} icon={ArrowRight}>
              <span className="truncate text-sm font-medium text-white/80">
                Then <span className="font-bold text-white">{then.subject}</span> at {then.startTime}
              </span>
            </NextChip>
          )}
        </div>

        <Link
          href={`/focus/${task.id}`}
          className="group relative inline-flex h-14 shrink-0 items-center gap-3 self-start rounded-full bg-white pl-2 pr-6 text-base font-bold text-primary shadow-lg shadow-black/10 transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:scale-[0.97] md:self-auto"
        >
          <span className="relative grid size-10 place-items-center rounded-full bg-primary text-white">
            <span className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" />
            <Play className="relative size-4 fill-current" />
          </span>
          Start focus
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </motion.section>
  );
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-4 text-white/60" />
      {children}
    </span>
  );
}

/** In place of "up next" when nothing is left: all done, or nothing planned. */
function NothingLeft({ hasTasks, freeHref }: { hasTasks: boolean; freeHref: string }) {
  const Icon = hasTasks ? PartyPopper : Sparkles;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8',
        hasTasks
          ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-emerald-500/20'
          : 'bg-gradient-to-br from-primary via-primary to-primary/75 shadow-primary/20'
      )}
    >
      <CardDecor icon={Icon} />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <motion.span
            initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.15 }}
            className="grid size-14 place-items-center rounded-2xl bg-white/20 ring-2 ring-white/30"
          >
            <Icon className="size-7" />
          </motion.span>
          <div>
            <h2 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
              {hasTasks ? 'Everything is done today' : 'Nothing on the plan today'}
            </h2>
            <p className="mt-1.5 max-w-md text-sm font-medium text-white/80">
              {hasTasks
                ? 'Every block on today’s plan is ticked off. Want to keep going? Start a free session.'
                : 'Start a free session, or add study blocks to your routine so they show up here.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={freeHref}
            className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-5 font-bold text-foreground shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
          >
            <Timer className="size-4" />
            Free session
          </Link>
          {!hasTasks && (
            <Link
              href="/manage"
              className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/30 bg-white/10 px-5 font-bold backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <CalendarPlus className="size-4" />
              Study routine
            </Link>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/* -------------------------------------------------------------- timeline */

function Timeline({
  tasks,
  nextId,
  subject,
  now,
  freeHref,
}: {
  tasks: PlanTask[];
  nextId?: string;
  subject: string;
  now: number | null;
  freeHref: string;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <ListTodo className="size-4" />
          </span>
          Today&apos;s plan
        </h2>
        {tasks.length > 0 && (
          <span className="text-xs font-bold text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? 'block' : 'blocks'}
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <span className="float-soft grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <CalendarClock className="size-6" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">No study blocks today.</p>
          <Link href={freeHref} className="text-sm font-bold text-primary hover:underline">
            Start a free session
          </Link>
        </div>
      ) : (
        <motion.ol initial="hidden" animate="show" variants={list} className="relative">
          {tasks.map((task, i) => (
            <TimelineRow
              key={task.id}
              task={task}
              isNext={task.id === nextId}
              subject={subject}
              last={i === tasks.length - 1}
              timing={timingOf(task, now)}
            />
          ))}
        </motion.ol>
      )}
    </section>
  );
}

function TimelineRow({
  task,
  isNext,
  subject,
  last,
  timing,
}: {
  task: PlanTask;
  isNext: boolean;
  subject: string;
  last: boolean;
  timing: BlockTiming | null;
}) {
  const label = timingLabel(task, timing);
  const isNow = !task.isDone && timing?.state === 'now';
  const focusedMin = Math.round(task.focusedSeconds / 60);

  return (
    <motion.li variants={item} className="relative flex gap-3 sm:gap-4">
      <div className="hidden w-11 shrink-0 pt-[18px] text-right font-heading text-sm font-bold tabular-nums text-muted-foreground sm:block">
        {task.startTime}
      </div>

      {/* The rail: a dot per block joined by a line. */}
      <div className="relative hidden w-5 shrink-0 justify-center sm:flex">
        {!last && <span aria-hidden className="absolute bottom-0 top-8 w-px bg-border" />}
        <span
          aria-hidden
          className={cn(
            'relative z-10 mt-5 grid size-5 place-items-center rounded-full border-2 bg-card',
            task.isDone
              ? 'tick-in border-success bg-success text-white'
              : isNow
                ? 'border-primary'
                : isNext
                  ? 'border-primary/60'
                  : 'border-border'
          )}
        >
          {task.isDone ? (
            <Check className="size-3" strokeWidth={3} />
          ) : isNow ? (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" />
              <span className="size-2 rounded-full bg-primary" />
            </>
          ) : null}
        </span>
      </div>

      <div
        className={cn(
          'group mb-3 flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-background/60 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-3.5',
          // The app's focus-mode convention: homework solid blue, revision dashed orange.
          task.revision ? 'border-dashed border-orange-500/50' : 'border-primary/30',
          task.match && !task.isDone && 'bg-primary/5',
          isNow && 'ring-2 ring-primary/25',
          task.isDone && 'opacity-60 hover:translate-y-0 hover:shadow-none'
        )}
      >
        <SubjectIcon
          name={task.subject}
          className="size-11 rounded-xl transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"
          iconClassName="!size-5"
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-bold', task.isDone && 'line-through decoration-2 decoration-muted-foreground/40')}>
            {task.subject}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
            <span className={cn(task.revision ? 'text-orange-600 dark:text-orange-400' : 'text-primary')}>
              {task.revision ? 'Revision' : 'Homework'}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {task.startTime}–{task.endTime}
            </span>
            {focusedMin > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3 text-orange-500" />
                  {formatMinutes(focusedMin)} focused
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {task.match && !task.isDone && subject && (
            <span className="hidden rounded-full border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary md:inline-flex">
              {subject}
            </span>
          )}
          {label && <TimingChip {...label} />}
          {task.isDone ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">
              <Check className="size-3.5" strokeWidth={3} />
              Done
            </span>
          ) : (
            <Link
              href={`/focus/${task.id}`}
              aria-label={`Start a focus session for ${task.subject}`}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-all duration-200 active:scale-[0.96]',
                isNext
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg'
                  : 'border border-border bg-card hover:border-primary hover:bg-primary hover:text-primary-foreground'
              )}
            >
              <Play className="size-3.5 fill-current" />
              Start
            </Link>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function TimingChip({ text, icon: Icon, tone }: { text: string; icon: LucideIcon; tone: 'now' | 'soon' | 'late' | 'calm' }) {
  return (
    <span
      className={cn(
        'hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex',
        tone === 'now' && 'bg-primary/10 text-primary',
        tone === 'soon' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        tone === 'late' && 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
        tone === 'calm' && 'text-muted-foreground'
      )}
    >
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}

/* ----------------------------------------------------------------- aside */

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function TodayRing({ tasks, now }: { tasks: PlanTask[]; now: number | null }) {
  const done = tasks.filter((t) => t.isDone).length;
  const pct = Math.round((done / tasks.length) * 100);
  const complete = done === tasks.length;
  const focusedMin = Math.round(tasks.reduce((sum, t) => sum + t.focusedSeconds, 0) / 60);
  // Study time still ahead: the rest of the block running now plus every
  // block yet to start. Missed and finished blocks count for nothing.
  const plannedLeft = tasks.reduce((sum, t) => {
    if (t.isDone || t.isMissed) return sum;
    const timing = timingOf(t, now);
    if (timing?.state === 'now') return sum + timing.minutesLeft;
    if (timing?.state === 'past') return sum;
    return sum + blockLength(t.startTime, t.endTime);
  }, 0);

  return (
    <motion.section variants={item} className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <div className={cn('relative size-28 shrink-0 rounded-full', complete && 'progress-complete')}>
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle className="stroke-muted" strokeWidth="9" cx="50" cy="50" r={RADIUS} fill="none" />
            <circle
              className={cn('ring-draw transition-[stroke-dashoffset] duration-700 ease-out', complete ? 'stroke-success' : 'stroke-primary')}
              strokeWidth="9"
              strokeLinecap="round"
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - done / tasks.length)}
              style={{ '--ring-full': `${CIRCUMFERENCE}` } as React.CSSProperties}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-heading text-2xl font-black tabular-nums leading-none">
                <CountUp value={`${pct}%`} />
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">done</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-bold text-muted-foreground">Today</p>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {done} <span className="text-muted-foreground">/ {tasks.length}</span>
            </p>
          </div>
          <div className="space-y-1.5 text-sm font-semibold">
            <p className="flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              {focusedMin > 0 ? `${formatMinutes(focusedMin)} focused` : 'No focus yet'}
            </p>
            {plannedLeft > 0 && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Hourglass className="size-4" />
                {formatMinutes(plannedLeft)} planned left
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function FreeSession({ href, subject }: { href: string; subject: string }) {
  return (
    <motion.section variants={item} className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
      <Timer
        aria-hidden
        strokeWidth={1.25}
        className="pointer-events-none absolute -right-6 -top-6 size-32 text-primary/[0.06] transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110"
      />
      <div className="relative">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Timer className="size-5" />
        </span>
        <h2 className="mt-4 font-heading text-lg font-bold">Free session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No task attached, and a timer you set yourself. Good for unplanned study or
          {subject ? ` a quick round of ${subject}.` : ' anything not on the plan.'}
        </p>
        <Link
          href={href}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background font-bold transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
        >
          <Play className="size-4 fill-current" />
          Start a free session
        </Link>
      </div>
    </motion.section>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const hours = stats.totalMinutes / 60;
  const items: { icon: LucideIcon; value: string; label: string; tone: string }[] = [
    { icon: Flame, value: String(stats.streak), label: 'day streak', tone: 'bg-orange-500/10 text-orange-500' },
    {
      icon: Clock,
      value: hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`,
      label: 'focused',
      tone: 'bg-primary/10 text-primary',
    },
    { icon: Target, value: String(stats.sessions), label: stats.sessions === 1 ? 'session' : 'sessions', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  ];
  return (
    <motion.section variants={item} className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
      <h2 className="text-xs font-bold text-muted-foreground">All your focus</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map(({ icon: Icon, value, label, tone }) => (
          <div key={label} className="space-y-2">
            <span className={cn('grid size-9 place-items-center rounded-xl', tone)}>
              <Icon className="size-4" />
            </span>
            <p className="font-heading text-xl font-black tabular-nums leading-none">
              <CountUp value={value} />
            </p>
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
