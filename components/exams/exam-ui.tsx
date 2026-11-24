'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowDown,
  Award,
  BookMarked,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Hourglass,
  ListChecks,
  Milestone,
  Radio,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { DeleteExamButton } from '@/components/ExamsClient';
import { SubjectIcon, TONE_CLASSES } from '@/components/subjects/SubjectIcon';
import { CardDecor, StatusChip, SubjectBadge } from '@/components/home/LiveCardBits';
import { CountUp } from '@/components/ui/count-up';
import { categoryHref, categoryLook, type CategoryLook } from '@/lib/exam-category';
import type { SubjectTone } from '@/lib/subject-look';
import { cn } from '@/lib/utils';

export type ExamRowData = {
  id: string;
  title: string;
  subject: string | null;
  category: string | null;
  /** Milliseconds, for ordering. */
  at: number;
  when: string;
  days: number;
  inProgress: boolean;
  isDone: boolean;
  /** Rounded percentage once a mark is in. */
  percent: number | null;
  priority: string;
};

/* ---------------------------------------------------------------- motion */

export const listMotion: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

export const itemMotion: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.2, 0, 0, 1] } },
};

/* ------------------------------------------------------- category looks */

const LOOK: Record<CategoryLook, { icon: LucideIcon; tone: SubjectTone; label: string }> = {
  midterm: { icon: Milestone, tone: 'sky', label: 'Midterm' },
  final: { icon: GraduationCap, tone: 'violet', label: 'End of term' },
  mock: { icon: FlaskConical, tone: 'amber', label: 'Mock' },
  quiz: { icon: Zap, tone: 'emerald', label: 'Quiz / test' },
  coursework: { icon: FolderKanban, tone: 'pink', label: 'Coursework' },
  national: { icon: Award, tone: 'rose', label: 'National' },
  other: { icon: BookMarked, tone: 'indigo', label: 'Sitting' },
};

export function categoryStyle(name: string | null) {
  const look = name ? LOOK[categoryLook(name)] : { icon: ListChecks, tone: 'teal' as SubjectTone, label: 'Not grouped' };
  return { ...look, classes: TONE_CLASSES[look.tone] };
}

export function CategoryIcon({ name, className, iconClassName }: { name: string | null; className?: string; iconClassName?: string }) {
  const { icon: Icon, classes } = categoryStyle(name);
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-2xl', classes.tile, classes.ink, className)}>
      <Icon className={cn('size-1/2', iconClassName)} strokeWidth={1.75} />
    </span>
  );
}

/* ------------------------------------------------------------- helpers */

export const shownPercent = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

export function countdown(exam: Pick<ExamRowData, 'inProgress' | 'days'>) {
  if (exam.inProgress) return { label: 'In progress', tone: 'danger' as const };
  if (exam.days === 0) return { label: 'Today', tone: 'danger' as const };
  if (exam.days === 1) return { label: 'Tomorrow', tone: 'danger' as const };
  return {
    label: `In ${exam.days} days`,
    tone: exam.days <= 3 ? ('danger' as const) : exam.days <= 7 ? ('warning' as const) : ('default' as const),
  };
}

const CHIP = {
  default: 'bg-muted text-muted-foreground',
  warning: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  primary: 'bg-primary/10 text-primary',
};

export function Chip({ tone = 'default', icon: Icon, children, className }: { tone?: keyof typeof CHIP; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', CHIP[tone], className)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

/** A mark as a coloured percentage: green from 70, amber from 50, red below. */
export function markTone(percent: number) {
  return percent >= 70 ? 'success' : percent >= 50 ? 'warning' : 'danger';
}

/* --------------------------------------------------------------- the row */

export function ExamRow({ exam, showCategory = true }: { exam: ExamRowData; showCategory?: boolean }) {
  const due = countdown(exam);
  return (
    <motion.li variants={itemMotion} className="group relative flex items-center gap-1 rounded-2xl pr-1.5 transition-colors hover:bg-muted/50">
      <Link
        href={`/exams/${exam.id}`}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <SubjectIcon
          name={exam.subject ?? exam.title}
          className="size-11 rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
          iconClassName="!size-5"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-foreground transition-colors group-hover:text-primary">{exam.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {exam.when}
            </span>
            {showCategory && exam.category && (
              <span className={cn('inline-flex items-center gap-1', categoryStyle(exam.category).classes.ink)}>
                <span aria-hidden>·</span>
                {exam.category}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {exam.priority === 'HIGH' && !exam.isDone && (
            <Chip tone="danger" icon={Target} className="hidden sm:inline-flex">
              High priority
            </Chip>
          )}
          {exam.isDone ? (
            exam.percent !== null ? (
              <Chip tone={markTone(exam.percent)} icon={CheckCircle2}>
                {shownPercent(exam.percent)}
              </Chip>
            ) : (
              <Chip tone="warning" icon={Hourglass}>
                Marks pending
              </Chip>
            )
          ) : (
            <Chip tone={due.tone} icon={exam.inProgress ? Radio : Clock}>
              {due.label}
            </Chip>
          )}
        </span>
      </Link>
      <span className="opacity-60 transition-opacity group-hover:opacity-100">
        <DeleteExamButton id={exam.id} title={exam.title} />
      </span>
    </motion.li>
  );
}

/* ---------------------------------------------------------- next exam */

export type NextExamData = {
  id: string;
  title: string;
  subject: string | null;
  category: string | null;
  when: string;
  days: number;
  inProgress: boolean;
  stats: { sessions: number; focus: string; topics: string } | null;
};

/** The exam coming up next, big, with how ready you are and the two things to do. */
export function NextExamHero({ exam }: { exam: NextExamData }) {
  const status = exam.inProgress
    ? { text: 'Happening now', icon: Radio, live: true }
    : exam.days === 0
      ? { text: 'Today', icon: Radio, live: true }
      : exam.days === 1
        ? { text: 'Tomorrow', icon: Hourglass, live: true }
        : { text: `Next exam · in ${exam.days} days`, icon: CalendarClock, live: false };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      aria-label={`Next exam: ${exam.title}`}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8"
    >
      <CardDecor icon={GraduationCap} />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-5">
          <div className="flex">
            <StatusChip icon={status.icon} live={status.live}>
              {status.text}
            </StatusChip>
          </div>
          <div className="flex min-w-0 items-center gap-4">
            <SubjectBadge name={exam.subject ?? exam.title} />
            <div className="min-w-0">
              <Link href={`/exams/${exam.id}`} className="block truncate font-heading text-3xl font-black tracking-tight hover:underline md:text-4xl">
                {exam.title}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-white/60" />
                  {exam.when}
                </span>
                {exam.category && (
                  <Link href={categoryHref(exam.category)} className="inline-flex items-center gap-1.5 hover:text-white">
                    <ListChecks className="size-4 text-white/60" />
                    {exam.category}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {exam.stats && (
            <dl className="flex flex-wrap gap-2.5">
              {[
                { label: 'Sessions done', value: `${exam.stats.sessions}%`, icon: CheckCircle2 },
                { label: 'Focus time', value: exam.stats.focus, icon: Clock },
                { label: 'Topics', value: exam.stats.topics, icon: ListChecks },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 backdrop-blur-md">
                  <Icon className="size-4 text-white/70" />
                  <div className="leading-tight">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</dt>
                    <dd className="font-heading text-base font-black tabular-nums">
                      <CountUp value={value} />
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-5 lg:items-end">
          {!exam.inProgress && exam.days > 0 && (
            <div className="lg:text-right">
              <p className="font-heading text-7xl font-black leading-none tracking-tighter tabular-nums">
                <CountUp value={exam.days} />
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-white/70">{exam.days === 1 ? 'day left' : 'days left'}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {exam.subject && (
              <Link
                href={`/ai/practices?subject=${encodeURIComponent(exam.subject)}`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 font-bold backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <Brain className="size-4" />
                Practice
              </Link>
            )}
            <Link
              href={`/exams/${exam.id}`}
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-bold text-primary shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              Open
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** Buttons that sit on the gradient card: frosted glass, white text. */
export const GLASS_BUTTON =
  'inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-bold text-white shadow-none backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white dark:border-white/25 dark:bg-white/10 dark:hover:bg-white/20 [&_svg]:size-4';

/** The solid white button on the gradient card, for the main thing to do. */
export const WHITE_BUTTON =
  'group inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 font-bold text-primary shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-[0.97] [&_svg]:size-4';

export type ExamDetailHeroData = {
  title: string;
  subject: string | null;
  category: string | null;
  /** "Monday 30 November 2026". */
  date: string;
  /** "09:00–11:00" or "Time not set". */
  time: string;
  priority: string;
  days: number;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'DONE';
  /** Rounded percentage once a mark is in. */
  percent: number | null;
};

/**
 * The top of one exam's page: the same gradient card as the next exam on the
 * Exams page, holding everything the old header showed (title, category, date,
 * time, priority, time left or the result) and the page's buttons.
 */
export function ExamDetailHero({ exam, actions }: { exam: ExamDetailHeroData; actions?: React.ReactNode }) {
  const done = exam.status === 'DONE';
  const status = done
    ? { text: 'Finished', icon: CheckCircle2, live: false }
    : exam.status === 'IN_PROGRESS'
      ? { text: 'Happening now', icon: Radio, live: true }
      : exam.days === 0
        ? { text: 'Today', icon: Radio, live: true }
        : exam.days === 1
          ? { text: 'Tomorrow', icon: Hourglass, live: true }
          : { text: `In ${exam.days} days`, icon: CalendarClock, live: false };
  const { icon: CategoryGlyph } = categoryStyle(exam.category);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      aria-label={exam.title}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8"
    >
      <CardDecor icon={CategoryGlyph} />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip icon={status.icon} live={status.live}>
              {status.text}
            </StatusChip>
            {exam.priority === 'HIGH' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200/30 bg-red-500/30 py-1.5 pl-2.5 pr-3.5 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md">
                <Flame className="size-3.5" />
                High priority
              </span>
            )}
            {exam.priority === 'LOW' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 py-1.5 pl-2.5 pr-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
                <ArrowDown className="size-3.5" />
                Low priority
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <SubjectBadge name={exam.subject ?? exam.title} />
            <div className="min-w-0">
              <h1 className="break-words font-heading text-3xl font-black tracking-tight md:text-4xl">{exam.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-white/80">
                {exam.category && (
                  <Link href={categoryHref(exam.category)} className="inline-flex items-center gap-1.5 hover:text-white">
                    <CategoryGlyph className="size-4 text-white/60" />
                    {exam.category}
                  </Link>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-white/60" />
                  {exam.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 text-white/60" />
                  {exam.time}
                </span>
              </div>
            </div>
          </div>

          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <div className="shrink-0 lg:text-right">
          {done ? (
            exam.percent !== null ? (
              <>
                <p className="font-heading text-7xl font-black leading-none tracking-tighter tabular-nums">
                  <CountUp value={`${exam.percent}%`} />
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-white/70">your mark</p>
              </>
            ) : (
              <>
                <p className="font-heading text-3xl font-black leading-none tracking-tight">Marks pending</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">add it below</p>
              </>
            )
          ) : exam.status === 'IN_PROGRESS' || exam.days === 0 ? (
            <>
              <p className="font-heading text-5xl font-black leading-none tracking-tighter">{exam.status === 'IN_PROGRESS' ? 'Now' : 'Today'}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">good luck</p>
            </>
          ) : (
            <>
              <p className="font-heading text-7xl font-black leading-none tracking-tighter tabular-nums">
                <CountUp value={exam.days} />
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-white/70">{exam.days === 1 ? 'day left' : 'days left'}</p>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}

const MINI_TONES = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

/** One figure with its icon tile: "Focus time 3h 20m". */
export function MiniStat({
  icon,
  label,
  value,
  tone = 'primary',
  children,
}: {
  /** An icon element (<Clock />): a server page cannot pass the component itself. */
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: keyof typeof MINI_TONES;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-xl [&_svg]:size-4', MINI_TONES[tone])}>
          {icon}
        </span>
        <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2.5 font-heading text-2xl font-black leading-none tabular-nums tracking-tight">
        <CountUp value={value} />
      </p>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- stats */

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  tone?: 'primary' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };
  return (
    <motion.div variants={itemMotion} className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
      <span className={cn('grid size-10 place-items-center rounded-2xl', tones[tone])}>
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-heading text-3xl font-black tabular-nums leading-none tracking-tight">
        <CountUp value={value} />
      </p>
      <p className="mt-1.5 text-sm font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 truncate text-xs font-semibold text-muted-foreground/80">{hint}</p>}
    </motion.div>
  );
}

/** A score ring (0–100). Null shows an empty ring. */
export function ScoreRing({ percent, size = 112, className, label = 'average' }: { percent: number | null; size?: number; className?: string; label?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = percent === null ? 'stroke-muted' : percent >= 70 ? 'stroke-emerald-500' : percent >= 50 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle className="stroke-muted" strokeWidth="9" cx="50" cy="50" r={r} fill="none" />
        {percent !== null && (
          <circle
            className={cn('ring-draw', tone)}
            strokeWidth="9"
            strokeLinecap="round"
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)}
            style={{ '--ring-full': `${c}` } as React.CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-heading text-2xl font-black tabular-nums leading-none">{percent === null ? '–' : <CountUp value={shownPercent(percent)} />}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
