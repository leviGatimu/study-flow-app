'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, MotionConfig } from 'framer-motion';
import { ArrowUpRight, CalendarCheck2, CalendarClock, CheckCircle2, Hourglass, Plus, Sparkles, TrendingUp } from 'lucide-react';

import { CategoryDialog, type PickableExam } from '@/components/ExamCategories';
import { useIsArchived } from '@/components/ArchiveContext';
import { EmptyState } from '@/components/ui/empty-state';
import { categoryHref, normaliseCategory, type CategorySummary } from '@/lib/exam-category';
import { cn } from '@/lib/utils';
import {
  CategoryIcon,
  Chip,
  ExamRow,
  StatTile,
  categoryStyle,
  countdown,
  itemMotion,
  listMotion,
  markTone,
  shownPercent,
  type ExamRowData,
} from '@/components/exams/exam-ui';

export type { ExamRowData } from '@/components/exams/exam-ui';

const NO_CATEGORY = '__none';
const keyOf = (category: string | null) => normaliseCategory(category)?.toLowerCase() ?? NO_CATEGORY;

type Sitting = {
  key: string;
  name: string | null;
  total: number;
  done: number;
  next: ExamRowData | null;
  average: number | null;
  pending: number;
  first: number;
  last: number;
};

/**
 * The Exams page under the "next exam" card: a few numbers, a card per
 * category (each opens its own page at /exams/sitting/<name>), and every
 * exam in one list.
 */
export function ExamsView({
  exams,
  categories,
  pickable,
  names,
}: {
  exams: ExamRowData[];
  categories: CategorySummary[];
  pickable: PickableExam[];
  names: string[];
}) {
  const archived = useIsArchived();
  const [tab, setTab] = useState<'upcoming' | 'done'>(() => (exams.some((e) => !e.isDone) ? 'upcoming' : 'done'));
  const [dialog, setDialog] = useState<{ name: string | null } | null>(null);

  const upcoming = useMemo(() => exams.filter((e) => !e.isDone).sort((a, b) => a.at - b.at), [exams]);
  const done = useMemo(() => exams.filter((e) => e.isDone).sort((a, b) => b.at - a.at), [exams]);
  const thisWeek = upcoming.filter((e) => e.inProgress || e.days <= 7).length;
  const graded = done.filter((e) => e.percent !== null);
  const overall = graded.length ? Math.round((graded.reduce((s, e) => s + (e.percent as number), 0) / graded.length) * 10) / 10 : null;

  const sittings = useMemo<Sitting[]>(() => {
    const map = new Map<string, Sitting>();
    for (const exam of exams) {
      const key = keyOf(exam.category);
      const s = map.get(key) ?? {
        key,
        name: normaliseCategory(exam.category),
        total: 0,
        done: 0,
        next: null,
        average: null,
        pending: 0,
        first: exam.at,
        last: exam.at,
      };
      s.total += 1;
      s.first = Math.min(s.first, exam.at);
      s.last = Math.max(s.last, exam.at);
      if (exam.isDone) {
        s.done += 1;
        if (exam.percent === null) s.pending += 1;
      } else if (!s.next || exam.at < s.next.at) s.next = exam;
      map.set(key, s);
    }
    for (const s of map.values()) {
      s.average = categories.find((c) => keyOf(c.name) === s.key)?.average ?? null;
    }
    // Sittings still running first (soonest next exam), then finished ones newest first; no category last.
    return [...map.values()].sort(
      (a, b) =>
        Number(a.key === NO_CATEGORY) - Number(b.key === NO_CATEGORY) ||
        Number(!a.next) - Number(!b.next) ||
        (a.next && b.next ? a.next.at - b.next.at : b.last - a.last)
    );
  }, [exams, categories]);

  const shown = tab === 'done' ? done : upcoming;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-10">
        <motion.div initial="hidden" animate="show" variants={listMotion} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={CalendarClock} label="Coming up" value={upcoming.length} hint={upcoming[0] ? `Next: ${upcoming[0].title}` : 'Nothing planned'} />
          <StatTile icon={Hourglass} label="In the next 7 days" value={thisWeek} tone="amber" />
          <StatTile icon={CheckCircle2} label="Done" value={done.length} hint={`${graded.length} with marks`} tone="emerald" />
          <StatTile
            icon={TrendingUp}
            label="Average mark"
            value={overall === null ? '–' : shownPercent(overall)}
            hint={overall === null ? 'Add marks to see it' : 'Across every marked exam'}
            tone="violet"
          />
        </motion.div>

        <section aria-labelledby="sittings-title" className="space-y-4">
          <div>
            <h2 id="sittings-title" className="font-heading text-xl font-bold">Categories</h2>
            <p className="text-sm text-muted-foreground">Each sitting, like a midterm or end of term. Open one to see all its exams and results.</p>
          </div>
          <motion.ul initial="hidden" animate="show" variants={listMotion} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sittings.map((s) => (
              <SittingCard key={s.key} sitting={s} />
            ))}
            {!archived && pickable.length > 0 && (
              <motion.li variants={itemMotion}>
                <button
                  type="button"
                  onClick={() => setDialog({ name: null })}
                  className="group flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-muted transition-transform duration-300 group-hover:rotate-90 group-hover:bg-primary/10">
                    <Plus className="size-6" />
                  </span>
                  <span className="font-bold">New category</span>
                  <span className="text-xs font-medium">Midterm, mock, quiz, CAT…</span>
                </button>
              </motion.li>
            )}
          </motion.ul>
        </section>

        <section aria-labelledby="all-exams-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="all-exams-title" className="font-heading text-xl font-bold">All exams</h2>
            <Tabs tab={tab} setTab={setTab} counts={{ upcoming: upcoming.length, done: done.length }} />
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title={tab === 'done' ? 'No finished exams yet' : 'Nothing coming up'}
              description={tab === 'done' ? 'Exams move here once they are over.' : 'Add an exam when its date is announced.'}
            />
          ) : (
            <motion.ul key={tab} initial="hidden" animate="show" variants={listMotion} className="space-y-1 rounded-3xl border border-border/60 bg-card p-2 shadow-sm">
              {shown.map((exam) => (
                <ExamRow key={exam.id} exam={exam} />
              ))}
            </motion.ul>
          )}
        </section>

        {dialog && (
          <CategoryDialog key={dialog.name ?? '__new'} initialName={dialog.name} exams={pickable} names={names} onClose={() => setDialog(null)} />
        )}
      </div>
    </MotionConfig>
  );
}

export function Tabs({
  tab,
  setTab,
  counts,
}: {
  tab: 'upcoming' | 'done';
  setTab: (t: 'upcoming' | 'done') => void;
  counts: { upcoming: number; done: number };
}) {
  return (
    <div role="tablist" aria-label="Which exams" className="relative flex rounded-full bg-muted p-1">
      {([['upcoming', 'Coming up', CalendarClock], ['done', 'Done', CalendarCheck2]] as const).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          onClick={() => setTab(value)}
          className={cn(
            'relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            tab === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab === value && (
            <motion.span layoutId="exam-tab" className="absolute inset-0 rounded-full bg-card shadow-sm" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />
          )}
          <Icon className="relative size-4" />
          <span className="relative">{label}</span>
          <span className="relative tabular-nums text-muted-foreground">{counts[value]}</span>
        </button>
      ))}
    </div>
  );
}

const shortDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function SittingCard({ sitting: s }: { sitting: Sitting }) {
  const { classes, label } = categoryStyle(s.name);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const due = s.next ? countdown(s.next) : null;
  const from = shortDate(s.first);
  const to = shortDate(s.last);

  return (
    <motion.li variants={itemMotion}>
      <Link
        href={categoryHref(s.name)}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {/* A soft wash of the category's colour that grows on hover. */}
        <span
          aria-hidden
          className={cn('pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-50 blur-2xl transition-transform duration-500 group-hover:scale-150', classes.tile)}
        />

        <div className="relative flex items-start justify-between gap-3">
          <CategoryIcon name={s.name} className="size-12 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" iconClassName="!size-6" />
          <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </div>

        <div className="relative mt-4 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <h3 className="mt-0.5 truncate font-heading text-xl font-black tracking-tight">{s.name ?? 'No category'}</h3>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {s.total} {s.total === 1 ? 'exam' : 'exams'} · {from === to ? from : `${from} – ${to}`}
          </p>
        </div>

        <div className="relative mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>
              {s.done} of {s.total} done
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('progress-fill h-full rounded-full', classes.bar)} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {s.average !== null && (
            <Chip tone={markTone(s.average)} icon={TrendingUp}>
              Avg {shownPercent(s.average)}
            </Chip>
          )}
          {s.next && due && (
            <Chip tone={due.tone} icon={CalendarClock}>
              Next {due.label.toLowerCase()}
            </Chip>
          )}
          {s.pending > 0 && (
            <Chip tone="warning" icon={Hourglass}>
              {s.pending} {s.pending === 1 ? 'mark' : 'marks'} pending
            </Chip>
          )}
          {!s.next && s.pending === 0 && s.average === null && <Chip icon={CheckCircle2}>Finished</Chip>}
        </div>
      </Link>
    </motion.li>
  );
}
