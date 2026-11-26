'use client';

/**
 * Practice's own screens (the library of sets, one set, and the results of a
 * run), drawn in the app's card style with motion. The stages and actions are
 * StudyGenerator's; these only show them.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, MotionConfig, type Variants } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';

import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorState } from '@/components/ui/error-state';
import { CountUp } from '@/components/ui/count-up';
import { Page, PageBody } from '@/components/ui/page';
import { SubjectIcon, subjectStyle } from '@/components/subjects/SubjectIcon';
import { CardDecor } from '@/components/home/LiveCardBits';
import { cn } from '@/lib/utils';
import { formatAnswer } from '@/lib/marking';
import {
  deleteStudySet,
  retryAttemptMarking,
  type AttemptResult,
  type RetryMarkingResult,
  type StudySetDetail,
  type StudySetSummary,
} from '@/lib/study-actions';
import type { RunnerMode } from './QuestionRunner';

const MODE_LABEL: Record<RunnerMode, string> = { PRACTICE: 'Practice', EXAM: 'Mock exam' };

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.2, 0, 0, 1] } },
};
const hero = {
  initial: { opacity: 0, y: 16, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

type Tone = 'success' | 'warning' | 'danger';
const scoreTone = (score: number): Tone => (score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger');
const TONE: Record<Tone, { chip: string; stroke: string; bar: string; text: string }> = {
  success: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', stroke: 'stroke-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  warning: { chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', stroke: 'stroke-amber-500', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  danger: { chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', stroke: 'stroke-rose-500', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

const subjectHref = (subject: string) => `/subjects?subject=${encodeURIComponent(subject)}`;

/** A score ring with a label under the number. Null shows an empty ring. */
function Ring({ value, size = 120, stroke = 9, label, onDark }: { value: number | null; size?: number; stroke?: number; label: string; onDark?: boolean }) {
  const r = 50 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} className={onDark ? 'stroke-white/15' : 'stroke-muted'} />
        {value !== null && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
            className={cn('ring-draw', onDark ? 'stroke-white' : TONE[scoreTone(value)].stroke)}
            style={{ '--ring-full': `${c}` } as React.CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-heading text-2xl font-black leading-none tabular-nums" style={{ fontSize: size / 4.6 }}>
            {value === null ? '–' : <CountUp value={`${value}%`} />}
          </p>
          <p className={cn('mt-1 text-[10px] font-bold uppercase tracking-wider', onDark ? 'text-white/70' : 'text-muted-foreground')}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary/80 transition-colors hover:text-primary">
      <ArrowLeft className="size-4" /> {children}
    </button>
  );
}

const WHITE_BUTTON =
  'inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-primary shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100';
const GLASS_BUTTON =
  'inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-60';

/* ================================================================ library */

type Sort = 'recent' | 'best' | 'needs-work';

export function LibraryView({
  sets,
  aiReady,
  busy,
  missingSet,
  onNew,
  onOpen,
}: {
  sets: StudySetSummary[];
  aiReady: boolean;
  busy: boolean;
  missingSet: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<StudySetSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');

  const totals = useMemo(() => {
    const taken = sets.filter((s) => s.lastScore !== null);
    return {
      attempts: sets.reduce((sum, s) => sum + s.attempts, 0),
      average: taken.length ? Math.round(taken.reduce((sum, s) => sum + (s.lastScore ?? 0), 0) / taken.length) : null,
      cards: sets.reduce((sum, s) => sum + s.cardCount, 0),
    };
  }, [sets]);

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.subject, (counts.get(s.subject) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [sets]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sets.filter((s) => (!subject || s.subject === subject) && (!q || `${s.title} ${s.subject}`.toLowerCase().includes(q)));
    const time = (s: StudySetSummary) => new Date(s.createdAt).getTime();
    return [...filtered].sort((a, b) =>
      sort === 'best'
        ? (b.bestScore ?? -1) - (a.bestScore ?? -1)
        : sort === 'needs-work'
          ? (a.lastScore ?? 101) - (b.lastScore ?? 101)
          : time(b) - time(a)
    );
  }, [sets, subject, query, sort]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await deleteStudySet(toDelete.id);
    setDeleting(false);
    setToDelete(null);
    if (res && 'error' in res) {
      toast.error('That set could not be deleted. Try again.');
      return;
    }
    toast.success('Set deleted.');
    router.refresh();
  };

  return (
    <MotionConfig reducedMotion="user">
      <Page>
        <PageBody className="space-y-8 pt-8">
          {/* Header card */}
          <motion.section
            {...hero}
            data-tour="practice-intro"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8"
          >
            <CardDecor icon={Target} />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Practice</p>
                <h1 className="font-heading text-4xl font-black tracking-tight md:text-5xl">Test yourself, see it stick.</h1>
                <p className="text-sm font-medium text-white/80">
                  Turn a chapter or your notes into questions, or ask the AI to quiz you. Every score is saved so you can watch it climb.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" onClick={onNew} disabled={busy} className={WHITE_BUTTON}>
                    <Plus className="size-5" /> New practice set
                  </button>
                  <Link href="/ai" className={GLASS_BUTTON}>
                    <MessageSquare className="size-4" /> Ask the AI to quiz me
                  </Link>
                </div>
              </div>
              {sets.length > 0 && (
                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[26rem] lg:grid-cols-2">
                  {[
                    { label: 'Sets', value: String(sets.length), icon: Library },
                    { label: 'Attempts', value: String(totals.attempts), icon: RotateCcw },
                    { label: 'Average', value: totals.average !== null ? `${totals.average}%` : '–', icon: TrendingUp },
                    { label: 'Flashcards', value: String(totals.cards), icon: Layers },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                      <Icon className="size-4 text-white/70" />
                      <div className="leading-tight">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</dt>
                        <dd className="font-heading text-xl font-black tabular-nums">
                          <CountUp value={value} />
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </motion.section>

          {missingSet && (
            <ErrorState
              title="That practice set could not be found"
              description="It may have been deleted, or it belongs to a different school year. Your other sets are below."
            />
          )}

          {!aiReady && (
            <div className="flex flex-col gap-3 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <KeyRound className="size-5" />
              </span>
              <p className="flex-1 text-sm text-foreground/90">
                Connect an AI to write new questions. Your saved sets and flashcards work without one.
              </p>
              <Link href="/settings?tab=ai" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-bold hover:bg-muted">
                AI settings <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}

          {sets.length === 0 ? (
            <motion.div {...hero} className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-border px-6 py-14 text-center">
              <span className="float-soft grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
                <BookOpenCheck className="size-8" />
              </span>
              <div>
                <h2 className="font-heading text-2xl font-black">No practice sets yet</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Upload a chapter, a handout or your own notes and the questions are written for you.
                </p>
              </div>
              <button type="button" onClick={onNew} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-md shadow-primary/25">
                <Upload className="size-4" /> Create your first set
              </button>
            </motion.div>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {[null, ...subjects].map((s) => (
                    <button
                      key={s ?? 'all'}
                      type="button"
                      onClick={() => setSubject(s)}
                      className={cn(
                        'relative inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition-colors',
                        subject === s ? 'text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {subject === s && <motion.span layoutId="practice-subject" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
                      {s && <SubjectIcon name={s} className="relative size-5 rounded-md" iconClassName="!size-3" />}
                      <span className="relative">{s ?? 'All'}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm focus-within:border-ring lg:w-56 lg:flex-none">
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    <span className="sr-only">Search sets</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sets" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
                  </label>
                  <label className="sr-only" htmlFor="practice-sort">Sort</label>
                  <select
                    id="practice-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="h-9 rounded-full border border-border bg-card px-3 text-sm font-bold outline-none focus:border-ring"
                  >
                    <option value="recent">Newest</option>
                    <option value="best">Best score</option>
                    <option value="needs-work">Needs work</option>
                  </select>
                </div>
              </div>

              {shown.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">No sets match.</p>
              ) : (
                <motion.ul key={`${subject}-${sort}`} initial="hidden" animate="show" variants={list} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((set) => (
                    <SetCard key={set.id} set={set} busy={busy} onOpen={() => onOpen(set.id)} onDelete={() => setToDelete(set)} />
                  ))}
                  <motion.li variants={item}>
                    <button
                      type="button"
                      onClick={onNew}
                      className="group flex h-full min-h-52 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                    >
                      <span className="grid size-12 place-items-center rounded-2xl bg-muted transition-transform duration-300 group-hover:rotate-90 group-hover:bg-primary/10">
                        <Plus className="size-6" />
                      </span>
                      <span className="font-bold">New practice set</span>
                      <span className="text-xs font-medium">From a PDF, Word file or your notes</span>
                    </button>
                  </motion.li>
                </motion.ul>
              )}
            </section>
          )}
        </PageBody>

        <ConfirmModal
          isOpen={toDelete !== null}
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
          isPending={deleting}
          title="Delete this practice set?"
          description={`"${toDelete?.title ?? ''}", its flashcards and its attempts will be removed.`}
        />
      </Page>
    </MotionConfig>
  );
}

function SetCard({ set, busy, onOpen, onDelete }: { set: StudySetSummary; busy: boolean; onOpen: () => void; onDelete: () => void }) {
  const { classes } = subjectStyle(set.subject);
  const best = set.bestScore;
  return (
    <motion.li variants={item} className="group relative">
      <button
        type="button"
        disabled={busy}
        onClick={onOpen}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        <span aria-hidden className={cn('pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-50 blur-2xl transition-transform duration-500 group-hover:scale-150', classes.tile)} />
        <div className="relative flex items-start justify-between gap-3">
          <SubjectIcon name={set.subject} className="size-12 rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" iconClassName="!size-6" />
          {best !== null ? (
            <Ring value={best} size={56} stroke={10} label="best" />
          ) : (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">New</span>
          )}
        </div>
        <p className="relative mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{set.subject}</p>
        <h3 className="relative mt-0.5 line-clamp-2 font-heading text-lg font-black leading-snug tracking-tight">{set.title}</h3>
        <div className="relative mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3.5" /> {set.itemCount} {set.itemCount === 1 ? 'question' : 'questions'}
          </span>
          {set.cardCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" /> {set.cardCount} {set.cardCount === 1 ? 'card' : 'cards'}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <RotateCcw className="size-3.5" /> {set.attempts ? `${set.attempts} ${set.attempts === 1 ? 'try' : 'tries'}` : 'Not taken'}
          </span>
        </div>
        {set.lastScore !== null && set.lastScore !== best && (
          <p className={cn('relative mt-2 text-xs font-bold', TONE[scoreTone(set.lastScore)].text)}>Last try {set.lastScore}%</p>
        )}
      </button>
      <button
        type="button"
        aria-label={`Delete ${set.title}`}
        onClick={onDelete}
        className="absolute bottom-4 right-4 grid size-9 place-items-center rounded-full bg-card text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </motion.li>
  );
}

/* ============================================================= one set */

export function SetOverview({
  detail,
  busy,
  onBack,
  onStart,
  onCards,
  onMakeCards,
}: {
  detail: StudySetDetail;
  busy: boolean;
  onBack: () => void;
  onStart: (mode: RunnerMode, fresh?: boolean) => void;
  onCards: () => void;
  onMakeCards: () => void;
}) {
  const empty = detail.items.length === 0;
  const scores = detail.attempts.map((a) => a.score);
  const best = scores.length ? Math.max(...scores) : null;
  // Oldest first for the chart, at most the last 12 tries.
  const timeline = [...detail.attempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-12);

  return (
    <MotionConfig reducedMotion="user">
      <Page>
        <PageBody className="space-y-8 pt-8">
          <BackLink onClick={onBack}>Your sets</BackLink>

          <motion.section {...hero} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8">
            <CardDecor icon={Target} />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                <SubjectIcon name={detail.subject} className="size-16 shrink-0 rounded-2xl shadow-lg ring-2 ring-white/30 md:size-20" iconClassName="!size-8 md:!size-10" />
                <div className="min-w-0">
                  <Link href={subjectHref(detail.subject)} className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70 hover:text-white">
                    {detail.subject}
                  </Link>
                  <h1 className="break-words font-heading text-3xl font-black tracking-tight md:text-4xl">{detail.title}</h1>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white/80">
                    <span className="inline-flex items-center gap-1.5"><ListChecks className="size-4 text-white/60" /> {detail.items.length} {detail.items.length === 1 ? 'question' : 'questions'}</span>
                    {detail.cards.length > 0 && <span className="inline-flex items-center gap-1.5"><Layers className="size-4 text-white/60" /> {detail.cards.length} {detail.cards.length === 1 ? 'flashcard' : 'flashcards'}</span>}
                    {detail.sourceName && <span className="inline-flex items-center gap-1.5"><BookOpenCheck className="size-4 text-white/60" /> {detail.sourceName}</span>}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <Ring value={best} size={108} label="best" onDark />
                <button type="button" onClick={() => onStart('PRACTICE')} disabled={busy || empty} className={WHITE_BUTTON}>
                  <BookOpenCheck className="size-5" /> Start practice
                </button>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <section className="space-y-4 xl:col-span-3">
              <h2 className="font-heading text-xl font-bold">Choose how to practise</h2>
              <motion.div initial="hidden" animate="show" variants={list} className="grid gap-4 sm:grid-cols-3">
                <ModeCard
                  title="Practice"
                  blurb="Marked as you go, with an explanation after each question."
                  icon={BookOpenCheck}
                  tone="from-sky-500 to-blue-600"
                  onClick={() => onStart('PRACTICE')}
                  onRestart={() => onStart('PRACTICE', true)}
                  resume={detail.drafts.find((d) => d.mode === 'PRACTICE')}
                  disabled={busy || empty}
                />
                <ModeCard
                  title="Mock exam"
                  blurb="Timed. No feedback at all until you hand it in."
                  icon={Clock}
                  tone="from-violet-500 to-purple-600"
                  onClick={() => onStart('EXAM')}
                  onRestart={() => onStart('EXAM', true)}
                  resume={detail.drafts.find((d) => d.mode === 'EXAM')}
                  disabled={busy || empty}
                />
                {detail.cards.length > 0 ? (
                  <ModeCard
                    title="Flashcards"
                    blurb={`${detail.cards.length} ${detail.cards.length === 1 ? 'card' : 'cards'}. The ones you find hard come back sooner.`}
                    icon={Layers}
                    tone="from-emerald-500 to-teal-600"
                    onClick={onCards}
                    disabled={busy}
                  />
                ) : (
                  <ModeCard
                    title="Make flashcards"
                    blurb="Turn the same material into cards to flip through."
                    icon={busy ? Loader2 : Plus}
                    spin={busy}
                    tone="from-emerald-500 to-teal-600"
                    onClick={onMakeCards}
                    disabled={busy}
                  />
                )}
              </motion.div>
            </section>

            <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-6 xl:col-span-2">
              <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold">
                <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><TrendingUp className="size-4" /></span>
                Your attempts
                <span className="text-sm font-bold text-muted-foreground tabular-nums">{detail.attempts.length}</span>
              </h2>
              {detail.attempts.length === 0 ? (
                <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
                  <span className="float-soft grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Trophy className="size-6" /></span>
                  <p className="text-sm text-muted-foreground">Not taken yet. Your score is saved every time you finish, so you can see it climb.</p>
                </div>
              ) : (
                <>
                  {/* Score per try, oldest on the left. */}
                  <div className="mt-5 flex h-32 items-end gap-1.5 rounded-2xl bg-muted/40 px-3 pb-3 pt-4" aria-label="Scores over time">
                    {timeline.map((a, i) => (
                      <div key={a.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${a.score}%`}>
                        <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{a.score}</span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(4, a.score)}%` }}
                          transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.2, 0, 0, 1] }}
                          className={cn('w-full max-w-8 rounded-lg', TONE[scoreTone(a.score)].bar)}
                        />
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 space-y-1">
                    {detail.attempts.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/50">
                        <span className={cn('grid size-9 place-items-center rounded-xl', a.mode === 'EXAM' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400')}>
                          {a.mode === 'EXAM' ? <Clock className="size-4" /> : <BookOpenCheck className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{a.mode === 'EXAM' ? 'Mock exam' : 'Practice'}</span>
                          <span className="block text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </span>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', TONE[scoreTone(a.score)].chip)}>{a.score}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </PageBody>
      </Page>
    </MotionConfig>
  );
}

function ModeCard({
  title,
  blurb,
  icon: Icon,
  tone,
  spin,
  onClick,
  onRestart,
  resume,
  disabled,
}: {
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Gradient classes for the icon tile. */
  tone: string;
  spin?: boolean;
  onClick: () => void;
  onRestart?: () => void;
  resume?: { answered: number; total: number; deadlineAt: string | null };
  disabled: boolean;
}) {
  const pct = resume && resume.total ? Math.round((resume.answered / resume.total) * 100) : 0;
  return (
    <motion.div variants={item} className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <button type="button" onClick={onClick} disabled={disabled} className="flex-1 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:opacity-50">
        <span className={cn('grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110', tone)}>
          <Icon className={cn('size-6', spin && 'animate-spin')} />
        </span>
        <p className="mt-4 flex items-center gap-2 font-heading text-lg font-black">
          {resume ? `Continue` : title}
          {resume && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">{title}</span>}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{resume ? `${resume.answered} of ${resume.total} answered, saved.` : blurb}</p>
        {resume && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="progress-fill h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>
      {resume && onRestart && (
        <button type="button" onClick={onRestart} disabled={disabled} className="flex items-center gap-1.5 border-t border-border/60 px-5 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <RotateCcw className="size-3.5" /> Start over
        </button>
      )}
    </motion.div>
  );
}

/* ============================================================== results */

function verdict(score: number): { title: string; line: string } {
  if (score >= 90) return { title: 'Outstanding!', line: 'You really know this. Try a mock exam next.' };
  if (score >= 75) return { title: 'Great work', line: 'Strong result. Go over the few you missed and it is yours.' };
  if (score >= 50) return { title: 'Good effort', line: 'You are getting there. The mistakes below show exactly what to fix.' };
  return { title: 'Keep going', line: 'This is how learning starts. Review the answers, then try again.' };
}

export function Results({
  result,
  onRemarked,
  detail,
  mode,
  onRetake,
  onSet,
  onNewSet,
  onLibrary,
}: {
  result: AttemptResult;
  onRemarked: (next: RetryMarkingResult) => void;
  detail: StudySetDetail;
  mode: RunnerMode;
  onRetake: () => void;
  onSet: () => void;
  onNewSet: () => void;
  onLibrary: () => void;
}) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const [remarking, setRemarking] = useState(false);
  const mistakes = result.answers.filter((a) => !a.isCorrect && a.status !== 'UNMARKED').length;
  const final = result.markingStatus === 'FINAL';
  const said = verdict(result.score);

  const remark = async () => {
    setRemarking(true);
    try {
      const next = await retryAttemptMarking(result.attemptId);
      if ('error' in next) toast.error(next.error);
      else {
        onRemarked(next);
        if (next.markingStatus === 'FINAL') toast.success('Everything is marked.');
        else toast.error('Some answers still could not be marked. They are saved - try again later.');
      }
    } catch {
      toast.error('Could not reach the marker. Your answers are saved - try again.');
    } finally {
      setRemarking(false);
    }
  };
  const shown = wrongOnly ? result.answers.filter((a) => !a.isCorrect) : result.answers;
  const reviewMistakes = () => {
    setWrongOnly(true);
    document.getElementById('practice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const next: { icon: LucideIcon; label: string; hint: string; onClick?: () => void; href?: string; primary?: boolean }[] = [
    ...(mistakes > 0 ? [{ icon: ListChecks, label: `Review ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`, hint: 'See the right answers and why', onClick: reviewMistakes, primary: true }] : []),
    { icon: RotateCcw, label: 'Retake this set', hint: 'Same questions, fresh start', onClick: onRetake },
    { icon: Target, label: 'Another mode', hint: mode === 'EXAM' ? 'Practice or flashcards' : 'Mock exam or flashcards', onClick: onSet },
    { icon: Sparkles, label: 'New questions', hint: `A fresh set on ${detail.subject}`, onClick: onNewSet },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <Page>
        <PageBody className="space-y-8 pt-8">
          <BackLink onClick={onLibrary}>Your sets</BackLink>

          <motion.section {...hero} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-6 text-white shadow-xl shadow-primary/20 md:p-8">
            <CardDecor icon={Trophy} />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}>
                <Ring value={result.markingStatus === 'PENDING' ? null : result.score} size={150} stroke={8} label={final ? 'score' : 'so far'} onDark />
              </motion.div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
                  {MODE_LABEL[mode]} finished · {detail.subject}
                </p>
                <h1 className="font-heading text-4xl font-black tracking-tight md:text-5xl">{final ? said.title : 'Almost marked'}</h1>
                <p className="max-w-lg text-sm font-medium text-white/85">
                  {final ? said.line : `${result.unmarked} of ${result.total} answers are still waiting to be marked.`}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
                    <CheckCircle2 className="size-3.5" /> {result.correct} of {result.total} correct
                  </span>
                  {result.xp && result.xp.granted > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
                      <Sparkles className="size-3.5" /> +{result.xp.granted} XP
                    </span>
                  )}
                  {result.xp?.leveledUp && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary">
                      <Trophy className="size-3.5" /> Level up!
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {!final && (
                  <button type="button" onClick={remark} disabled={remarking} className={GLASS_BUTTON}>
                    {remarking ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                    {remarking ? 'Marking…' : 'Mark again'}
                  </button>
                )}
                <button type="button" onClick={onRetake} className={WHITE_BUTTON}>
                  <RotateCcw className="size-4" /> Retake
                </button>
              </div>
            </div>
          </motion.section>

          {result.notice && (
            <p className="rounded-3xl border border-orange-500/25 bg-orange-500/5 px-5 py-3 text-sm font-medium text-orange-600 dark:text-orange-400">{result.notice}</p>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <aside className="space-y-4 xl:col-span-2">
              <h2 className="font-heading text-xl font-bold">What next</h2>
              {result.revisit !== undefined && (
                <Link
                  href={result.revisit ? result.revisit.weekHref : '/manage'}
                  className="flex items-start gap-3 rounded-3xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><CalendarClock className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">
                      {result.revisit ? `Fix the gaps: ${result.revisit.day}, ${result.revisit.startTime}–${result.revisit.endTime}` : `Make time for ${detail.subject}`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {result.revisit ? `Your next ${detail.subject} block. Go over the mistakes then.` : `${detail.subject} has no block in your study routine yet. Add one.`}
                    </span>
                  </span>
                </Link>
              )}
              <motion.ul initial="hidden" animate="show" variants={list} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {next.map(({ icon: Icon, label, hint, onClick, primary }) => (
                  <motion.li key={label} variants={item}>
                    <button
                      type="button"
                      onClick={onClick}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-3xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                        primary ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card'
                      )}
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl transition-transform group-hover:-rotate-6', primary ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
              <Link href={subjectHref(detail.subject)} className="inline-flex items-center gap-1.5 px-1 text-sm font-bold text-primary hover:underline">
                <Library className="size-4" /> Open {detail.subject}
              </Link>
            </aside>

            <section id="practice-review" className="scroll-mt-24 rounded-3xl border border-border/60 bg-card p-3 shadow-sm md:p-4 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-1">
                <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold">
                  <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><ListChecks className="size-4" /></span>
                  {wrongOnly ? 'Your mistakes' : 'Every question'}
                </h2>
                {mistakes > 0 && (
                  <div className="flex rounded-full bg-muted p-1">
                    {([false, true] as const).map((only) => (
                      <button
                        key={String(only)}
                        type="button"
                        onClick={() => setWrongOnly(only)}
                        className={cn('relative rounded-full px-3.5 py-1.5 text-xs font-bold', wrongOnly === only ? 'text-foreground' : 'text-muted-foreground')}
                      >
                        {wrongOnly === only && <motion.span layoutId="results-filter" className="absolute inset-0 rounded-full bg-card shadow-sm" />}
                        <span className="relative">{only ? `Mistakes ${mistakes}` : `All ${result.answers.length}`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <motion.ol key={String(wrongOnly)} initial="hidden" animate="show" variants={list} className="space-y-2">
                {shown.map((a, i) => {
                  const state = a.status === 'UNMARKED' ? 'waiting' : a.isCorrect ? 'right' : a.score > 0 ? 'part' : 'wrong';
                  return (
                    <motion.li
                      key={a.id}
                      variants={item}
                      className={cn(
                        'flex gap-3 rounded-2xl border p-4',
                        state === 'right' ? 'border-emerald-500/20 bg-emerald-500/5' : state === 'waiting' ? 'border-border bg-muted/40' : state === 'part' ? 'border-amber-500/25 bg-amber-500/5' : 'border-rose-500/20 bg-rose-500/5'
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-full',
                          state === 'right' ? 'bg-emerald-500 text-white' : state === 'waiting' ? 'bg-muted text-muted-foreground' : state === 'part' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                        )}
                      >
                        {state === 'right' ? <Check className="size-4" strokeWidth={3} /> : state === 'waiting' ? <Clock className="size-4" /> : state === 'part' ? <span className="text-[10px] font-black">{a.score}</span> : <X className="size-4" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Question {wrongOnly ? '' : i + 1}</p>
                        <p className="font-bold leading-snug">{a.question}</p>
                        <p className="mt-2 text-sm">
                          <span className="font-semibold text-muted-foreground">You: </span>
                          {a.given ? formatAnswer(a.given) : <span className="italic text-muted-foreground">no answer</span>}
                          {state === 'part' && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">{a.score}% credit</span>}
                          {state === 'waiting' && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Waiting to be marked</span>}
                        </p>
                        {!a.isCorrect && (
                          <p className="mt-1 flex items-start gap-1.5 text-sm">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                            <span><span className="font-semibold text-muted-foreground">Answer: </span>{formatAnswer(a.expected)}</span>
                          </p>
                        )}
                        {(a.feedback || a.explanation) && (
                          <p className="mt-2 rounded-xl bg-background/70 px-3 py-2 text-sm leading-relaxed text-muted-foreground">{a.feedback || a.explanation}</p>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ol>
            </section>
          </div>
        </PageBody>
      </Page>
    </MotionConfig>
  );
}
