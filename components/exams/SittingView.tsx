'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, MotionConfig } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Hourglass,
  Pencil,
  Sparkles,
  Trophy,
  TrendingDown,
} from 'lucide-react';

import { CategoryDialog, type PickableExam } from '@/components/ExamCategories';
import { useIsArchived } from '@/components/ArchiveContext';
import { SubjectIcon } from '@/components/subjects/SubjectIcon';
import { categoryHref } from '@/lib/exam-category';
import { cn } from '@/lib/utils';
import {
  CategoryIcon,
  ExamRow,
  ScoreRing,
  StatTile,
  categoryStyle,
  countdown,
  listMotion,
  shownPercent,
  type ExamRowData,
} from '@/components/exams/exam-ui';

const shortDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** One category's page: header with its average, numbers, results by subject, and its exams. */
export function SittingView({
  name,
  exams,
  average,
  names,
  pickable,
}: {
  /** Null for the "no category" page. */
  name: string | null;
  exams: ExamRowData[];
  average: number | null;
  names: string[];
  pickable: PickableExam[];
}) {
  const router = useRouter();
  const archived = useIsArchived();
  const [editing, setEditing] = useState(false);
  const { classes, label } = categoryStyle(name);

  const upcoming = exams.filter((e) => !e.isDone).sort((a, b) => a.at - b.at);
  const done = exams.filter((e) => e.isDone).sort((a, b) => b.at - a.at);
  const graded = done.filter((e) => e.percent !== null).sort((a, b) => (b.percent as number) - (a.percent as number));
  const pending = done.length - graded.length;
  const next = upcoming[0];
  const due = next ? countdown(next) : null;
  const first = Math.min(...exams.map((e) => e.at));
  const last = Math.max(...exams.map((e) => e.at));
  const best = graded.length > 1 ? graded[0] : null;
  const lowest = graded.length > 1 ? graded[graded.length - 1] : null;
  const pct = Math.round((done.length / exams.length) * 100);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-8">
        <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary/80 transition-colors hover:text-primary">
          <ArrowLeft className="size-4" /> All exams
        </Link>

        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-8"
        >
          <span aria-hidden className={cn('pointer-events-none absolute -right-24 -top-24 size-80 rounded-full opacity-60 blur-3xl', classes.tile)} />
          <span aria-hidden className={cn('pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full opacity-30 blur-3xl', classes.tile)} />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <motion.span
                initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.15 }}
              >
                <CategoryIcon name={name} className="size-16 shadow-sm md:size-20" iconClassName="!size-8 md:!size-10" />
              </motion.span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <h1 className="break-words font-heading text-4xl font-black tracking-tight md:text-5xl">{name ?? 'No category'}</h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" />
                    {first === last ? shortDate(first) : `${shortDate(first)} – ${shortDate(last)}`}
                  </span>
                  <span>
                    {exams.length} {exams.length === 1 ? 'exam' : 'exams'}
                  </span>
                </p>
                {name && !archived && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
                  >
                    <Pencil className="size-3.5" /> Edit category
                  </button>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-6 text-sm font-bold">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="tabular-nums">
                    {done.length}/{exams.length}
                  </span>
                </div>
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div className={cn('progress-fill h-full rounded-full', classes.bar)} style={{ width: `${pct}%` }} />
                </div>
                {next && due && (
                  <p className="text-xs font-semibold text-muted-foreground">
                    Next: <span className="font-bold text-foreground">{next.subject ?? next.title}</span> {due.label.toLowerCase()}
                  </p>
                )}
              </div>
              <ScoreRing percent={average} />
            </div>
          </div>
        </motion.section>

        {/* Numbers */}
        <motion.div initial="hidden" animate="show" variants={listMotion} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={CalendarClock} label="Coming up" value={upcoming.length} hint={next ? `${next.subject ?? next.title} · ${due?.label.toLowerCase()}` : 'All sat'} />
          <StatTile icon={CheckCircle2} label="Done" value={done.length} hint={pending ? `${pending} ${pending === 1 ? 'mark' : 'marks'} pending` : graded.length ? 'All marked' : undefined} tone="emerald" />
          <StatTile icon={Trophy} label="Best" value={best ? shownPercent(best.percent as number) : '–'} hint={best ? best.subject ?? best.title : 'Needs two marks'} tone="amber" />
          <StatTile icon={TrendingDown} label="Lowest" value={lowest ? shownPercent(lowest.percent as number) : '–'} hint={lowest ? lowest.subject ?? lowest.title : 'Needs two marks'} tone="rose" />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Results by subject */}
          <section className="self-start rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-6 xl:col-span-2">
            <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="size-4" />
              </span>
              Results
            </h2>
            {graded.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <span className="float-soft grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Hourglass className="size-6" />
                </span>
                <p className="text-sm font-medium text-muted-foreground">
                  {done.length ? 'Add your marks on each exam to see results here.' : 'Results show here once exams are done and marked.'}
                </p>
              </div>
            ) : (
              <ul className="mt-5 space-y-3.5">
                {graded.map((exam, i) => {
                  const value = exam.percent as number;
                  return (
                    <li key={exam.id}>
                      <Link href={`/exams/${exam.id}`} className="group flex items-center gap-3">
                        <SubjectIcon name={exam.subject ?? exam.title} className="size-9 rounded-lg" iconClassName="!size-4" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm font-bold group-hover:text-primary">{exam.subject ?? exam.title}</span>
                            <span className="shrink-0 font-heading text-sm font-black tabular-nums">{shownPercent(value)}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, value)}%` }}
                              transition={{ duration: 0.9, delay: 0.2 + i * 0.06, ease: [0.2, 0, 0, 1] }}
                              className={cn('h-full rounded-full', value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* The exams */}
          <div className="space-y-6 xl:col-span-3">
            {(upcoming.length > 0 || done.length === 0) && (
              <ExamList title="Coming up" icon={CalendarClock} exams={upcoming} empty="Nothing left to sit in this category." />
            )}
            {done.length > 0 && <ExamList title="Done" icon={CalendarCheck2} exams={done} empty="None sat yet." />}
          </div>
        </div>

        {editing && name && (
          <CategoryDialog
            initialName={name}
            exams={pickable}
            names={names}
            onClose={() => setEditing(false)}
            onSaved={(renamed) => {
              // A rename moves the page; removing the category sends you back to all exams.
              router.replace(renamed ? categoryHref(renamed) : '/exams');
              router.refresh();
            }}
          />
        )}
      </div>
    </MotionConfig>
  );
}

function ExamList({
  title,
  icon: Icon,
  exams,
  empty,
}: {
  title: string;
  icon: typeof CalendarClock;
  exams: ExamRowData[];
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-3 shadow-sm md:p-4">
      <h2 className="flex items-center gap-2.5 px-2 pb-2 pt-1 font-heading text-lg font-bold">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
        <span className="text-sm font-bold text-muted-foreground tabular-nums">{exams.length}</span>
      </h2>
      {exams.length === 0 ? (
        <p className="flex items-center gap-2 px-3 py-4 text-sm font-medium text-muted-foreground">
          <Sparkles className="size-4" />
          {empty}
        </p>
      ) : (
        <motion.ul initial="hidden" animate="show" variants={listMotion} className="space-y-1">
          {exams.map((exam) => (
            <ExamRow key={exam.id} exam={exam} showCategory={false} />
          ))}
        </motion.ul>
      )}
    </section>
  );
}
