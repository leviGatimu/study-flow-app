'use client';

/**
 * One question at a time.
 *
 * Two modes out of one component, because they are the same screen with one
 * difference that matters: PRACTICE tells you immediately, EXAM tells you
 * nothing until the paper is over. Splitting them into two components would
 * mean two copies of eight input widgets and two chances for them to drift.
 *
 * THE FEEDBACK SHOWN HERE IS NOT THE MARK. Practice mode compares the answer
 * locally for the types where that is unambiguous - pick one, true/false, pick
 * several - so the student gets an instant reaction. The real score comes from
 * the server on submit, where written answers are marked too. For anything this
 * component cannot judge it says so rather than guessing, because a screen that
 * says "correct" and a results page that disagrees destroys trust in both.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Flag,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { cn } from '@/lib/utils';
import type { StudyItem } from '@/lib/study-actions';
import type { RunDraft, RunSnapshot } from '@/lib/run-draft';
import { decodeOrder, decodePairs, decodeSelection, encodeAnswer, formatAnswer, normalise, previewVerdict } from '@/lib/marking';

export type RunnerMode = 'PRACTICE' | 'EXAM';

export function QuestionRunner({
  items,
  mode,
  initial,
  onProgress,
  onFinish,
  busy,
}: {
  items: StudyItem[];
  mode: RunnerMode;
  /** The saved run to pick up: answers, flags, position and an exam deadline. */
  initial?: RunDraft;
  /** Called after every change, so the caller can autosave the run. */
  onProgress?: (snapshot: RunSnapshot) => void;
  onFinish: (answers: { id: string; answer: string }[], durationSec: number) => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(() => Math.min(initial?.position ?? 0, Math.max(0, items.length - 1)));
  const reduceMotion = useReducedMotion();
  // Which way the paper moved, so the next question slides in from that side.
  const [shownIndex, setShownIndex] = useState(index);
  const [direction, setDirection] = useState(1);
  if (shownIndex !== index) {
    setDirection(index > shownIndex ? 1 : -1);
    setShownIndex(index);
  }
  const [answers, setAnswers] = useState<Record<string, string>>(() => initial?.answers ?? {});
  const [flags, setFlags] = useState<Set<string>>(() => new Set(initial?.flags ?? []));
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  // Exam only: the hand-in screen listing unanswered and flagged questions.
  const [reviewing, setReviewing] = useState(false);
  // Set on mount rather than during render: reading the clock while rendering
  // is impure, and the value wanted here is "when did this run begin".
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const deadline = mode === 'EXAM' && initial?.deadlineAt ? new Date(initial.deadlineAt).getTime() : null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const item = items[index];
  const given = answers[item?.id] ?? '';
  const isRevealed = mode === 'PRACTICE' && revealed[item?.id];
  const isLast = index === items.length - 1;

  // Autosave: every change after the first render is reported to the caller.
  const firstRender = useRef(true);
  const progressRef = useRef(onProgress);
  useEffect(() => {
    progressRef.current = onProgress;
  }, [onProgress]);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    progressRef.current?.({ answers, flags: [...flags], position: index });
  }, [answers, flags, index]);

  // The latest answers, read at submit time. Submit must not CHANGE with every
  // keystroke: the exam clock depends on it, and a changing submit restarted
  // the clock's interval on each answer - typing steadily stopped time (S03).
  const latestAnswers = useRef(answers);
  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);

  const submit = useCallback(() => {
    onFinish(
      items.map((q) => ({ id: q.id, answer: latestAnswers.current[q.id] ?? '' })),
      startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0
    );
  }, [items, onFinish]);
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // The exam clock runs against the deadline the server fixed when the paper
  // first started, so neither a background tab, a sleeping laptop nor a reload
  // buys time. The paper hands itself in exactly once - immediately, if the
  // deadline passed while the student was away.
  useEffect(() => {
    if (deadline === null) return;
    let handedIn = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !handedIn) {
        handedIn = true;
        clearInterval(timer);
        submitRef.current();
      }
    };
    const timer = setInterval(tick, 500);
    tick();
    return () => clearInterval(timer);
  }, [deadline]);

  // A question paper is quicker from the keyboard. Nothing here fires while typing
  // an answer, and a modifier key always belongs to the browser.
  useEffect(() => {
    if (!item || reviewing || busy) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      if (event.key === 'ArrowRight' && index < items.length - 1) setIndex(index + 1);
      else if (event.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      else if (event.key.toLowerCase() === 'f') {
        setFlags((current) => {
          const next = new Set(current);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      } else if (/^[a-h]$/i.test(event.key) && !isRevealed) {
        const option = document.querySelector<HTMLButtonElement>(`[data-option="${event.key.toUpperCase().charCodeAt(0) - 65}"]`);
        option?.click();
      } else if (event.key === 'Enter') {
        // Enter on another button, such as Previous, means that button. A number in
        // the grid has already done its job by moving here, so Enter carries on.
        if (target?.closest('button:not([data-option])') && !target.closest('nav[aria-label="Questions"]')) return;
        event.preventDefault();
        if (mode === 'PRACTICE' && !isRevealed && given.trim()) setRevealed((r) => ({ ...r, [item.id]: true }));
        else if (mode === 'EXAM' || isRevealed) {
          if (isLast) setReviewing(true);
          else setIndex(index + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, reviewing, busy, index, items.length, isRevealed, mode, given, isLast]);


  if (!item) return null;

  const isAnswered = (q: StudyItem) => Boolean((answers[q.id] ?? '').trim());
  const answeredCount = items.filter(isAnswered).length;
  const unanswered = items.map((q, i) => ({ q, i })).filter(({ q }) => !isAnswered(q));
  const flagged = items.map((q, i) => ({ q, i })).filter(({ q }) => flags.has(q.id));
  const set = (value: string) => setAnswers((a) => ({ ...a, [item.id]: value }));
  const toggleFlag = () =>
    setFlags((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  const goTo = (i: number) => {
    setReviewing(false);
    setIndex(i);
  };

  const advance = () => {
    if (!isLast) return setIndex((i) => i + 1);
    // Both modes allow a final look at unanswered and flagged questions.
    setReviewing(true);
  };

  const flaggedCount = flagged.length;
  const lowTime = secondsLeft !== null && secondsLeft < 60;

  const clock =
    deadline !== null && secondsLeft !== null ? (
      <span
        aria-label={`Time left: ${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums',
          lowTime ? 'bg-destructive/15 text-destructive motion-safe:animate-pulse' : 'bg-muted/70 text-foreground'
        )}
      >
        <Clock className="size-4" />
        {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
      </span>
    ) : null;

  // One segment per question across the top: filled when answered, bright for
  // the current one, an orange tick when flagged. Click one to jump to it.
  const segments = (
    <nav aria-label="Questions" className="flex gap-1">
      {items.map((q, i) => {
        const answered = isAnswered(q);
        const current = i === index && !reviewing;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => goTo(i)}
            disabled={busy}
            title={`Question ${i + 1}`}
            aria-current={current ? 'step' : undefined}
            aria-label={`Question ${i + 1}${answered ? ', answered' : ', not answered'}${flags.has(q.id) ? ', flagged' : ''}`}
            className="group relative h-6 min-w-0 flex-1 focus-visible:outline-none"
          >
            <span
              className={cn(
                'absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 group-hover:h-2.5 group-focus-visible:ring-2 group-focus-visible:ring-ring',
                current ? 'h-2.5 bg-primary shadow-[0_0_12px] shadow-primary/60' : answered ? 'h-1.5 bg-primary/55' : 'h-1.5 bg-foreground/10'
              )}
            />
            {flags.has(q.id) && <span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-500" />}
          </button>
        );
      })}
    </nav>
  );

  const ratio = items.length ? answeredCount / items.length : 0;
  const ring = (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 40 40" className="size-16 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-foreground/10" />
        <circle
          cx="20" cy="20" r="16" fill="none" strokeWidth="4" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={2 * Math.PI * 16}
          strokeDashoffset={2 * Math.PI * 16 * (1 - ratio)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{Math.round(ratio * 100)}%</span>
    </div>
  );

  const numberGrid = (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((q, i) => {
        const answered = isAnswered(q);
        const isFlagged = flags.has(q.id);
        const current = i === index && !reviewing;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => goTo(i)}
            disabled={busy}
            title={q.question}
            aria-label={`Go to question ${i + 1}`}
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              current
                ? 'scale-105 bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : answered
                  ? 'bg-primary/15 text-foreground hover:bg-primary/25'
                  : 'bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/10'
            )}
          >
            {i + 1}
            {isFlagged && <Flag aria-hidden="true" className="absolute -right-1 -top-1 size-3 fill-orange-500 text-orange-500" />}
          </button>
        );
      })}
    </div>
  );


  const workspace = (content: React.ReactNode) => (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">{segments}</div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{answeredCount}/{items.length}</span>
        <span className="lg:hidden">{clock}</span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">{content}</div>

        <aside className="sticky top-0 hidden space-y-5 pt-2 lg:block">
          <div className="flex items-center gap-3">
            {ring}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{answeredCount} of {items.length} answered</p>
              <p className="text-xs text-muted-foreground">
                {flaggedCount > 0 ? <span className="text-orange-600 dark:text-orange-400">{flaggedCount} flagged</span> : 'Nothing flagged'}
              </p>
            </div>
          </div>
          {clock && <div>{clock}</div>}
          {numberGrid}
          <Button className="w-full rounded-full" variant="outline" onClick={() => setReviewing(true)} disabled={busy}>Review &amp; finish</Button>
          <div className="space-y-1.5 border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <p><Kbd>A</Kbd>–<Kbd>D</Kbd> pick an answer</p>
            <p><Kbd>Enter</Kbd> check or move on</p>
            <p><Kbd>←</Kbd> <Kbd>→</Kbd> change question · <Kbd>F</Kbd> flag</p>
          </div>
        </aside>
      </div>
    </div>
  );

  const blurIn = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, filter: 'blur(14px)', scale: 0.97 },
        animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
        exit: { opacity: 0, filter: 'blur(14px)', scale: 0.97 },
      };

  if (reviewing) {
    return workspace(
      <motion.div {...blurIn} transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }} className="pt-2 md:pt-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-bold md:text-3xl">Ready to hand in?</h2>
          {clock}
        </div>
        <p className="text-muted-foreground">
          {answeredCount} of {items.length} answered. You can go back to any question first.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ReviewStat label="Answered" value={answeredCount} tone="primary" />
          <ReviewStat label="Not answered" value={unanswered.length} tone={unanswered.length ? 'danger' : 'muted'} />
          <ReviewStat label="Flagged" value={flaggedCount} tone={flaggedCount ? 'warning' : 'muted'} />
        </div>

        {(unanswered.length > 0 || flagged.length > 0) && (
          <div className="mt-6 space-y-4">
            {unanswered.length > 0 && <ReviewList label="Not answered" entries={unanswered} onPick={goTo} />}
            {flagged.length > 0 && <ReviewList label="Flagged" entries={flagged} onPick={goTo} />}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border/50 pt-6">
          <Button variant="outline" size="lg" className="rounded-full" onClick={() => goTo(index)}>
            <ArrowLeft />
            Keep working
          </Button>
          <Button size="lg" className="rounded-full px-6" onClick={submit} disabled={busy}>
            {busy ? (<>Marking… <Loader2 className="animate-spin" /></>) : (<>Hand in <Flag /></>)}
          </Button>
        </div>
      </motion.div>
    );
  }

  const slide = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d: number) => ({ opacity: 0, x: d * 60, filter: 'blur(16px)', scale: 0.98 }),
        center: { opacity: 1, x: 0, filter: 'blur(0px)', scale: 1 },
        exit: (d: number) => ({ opacity: 0, x: d * -60, filter: 'blur(16px)', scale: 0.98 }),
      };

  return workspace(
    <div className="mx-auto w-full max-w-3xl pb-6">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={item.id}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
          className="pt-2 md:pt-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-heading text-4xl font-black tabular-nums leading-none text-primary">{String(index + 1).padStart(2, '0')}</span>
              <div className="leading-tight">
                <p className="text-xs text-muted-foreground">of {items.length}</p>
                <p className="text-sm font-semibold">{TYPE_LABEL[item.type] ?? 'Question'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={flags.has(item.id)}
              onClick={toggleFlag}
              disabled={busy}
              className={cn('rounded-full', flags.has(item.id) && 'bg-orange-500/10 text-orange-600 dark:text-orange-400')}
            >
              <Flag className={cn(flags.has(item.id) && 'fill-current')} />
              {flags.has(item.id) ? 'Flagged' : 'Flag'}
            </Button>
          </div>

          <h2 className="mt-5 font-heading text-xl font-bold leading-snug md:text-[1.7rem] md:leading-snug">{item.question}</h2>

          <div className="mt-7">
            <AnswerWidget item={item} given={given} onChange={set} locked={busy || Boolean(isRevealed)} reduceMotion={!!reduceMotion} />
          </div>

          <div aria-live="polite">
            <AnimatePresence>{isRevealed && <Verdict item={item} given={given} reduceMotion={!!reduceMotion} />}</AnimatePresence>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-5">
            <Button variant="ghost" size="lg" className="rounded-full" onClick={() => setIndex((i) => i - 1)} disabled={busy || index === 0}>
              <ArrowLeft />
              Previous
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {mode === 'EXAM' ? 'Saved as you go · marked when you hand in' : isRevealed ? '' : 'Answer, then check'}
              </span>
              {mode === 'PRACTICE' && !isRevealed && (
                <Button size="lg" variant="outline" className="rounded-full" disabled={!given.trim() || busy} onClick={() => setRevealed((r) => ({ ...r, [item.id]: true }))}>
                  Check
                  <Check />
                </Button>
              )}
              <Button size="lg" className="rounded-full px-6 shadow-lg shadow-primary/25" onClick={advance} disabled={busy}>
                {busy && isLast ? (
                  <>Marking… <Loader2 className="animate-spin" /></>
                ) : isLast ? (
                  <>Review &amp; finish <Flag /></>
                ) : (
                  <>Next <ArrowRight /></>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-grid min-w-5 place-items-center rounded-md border border-border bg-background px-1 font-mono text-[10px] font-semibold text-foreground">{children}</kbd>;
}

function ReviewStat({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'danger' | 'warning' | 'muted' }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] p-4">
      <p
        className={cn(
          'font-heading text-3xl font-black tabular-nums',
          tone === 'primary' && 'text-primary',
          tone === 'danger' && 'text-destructive',
          tone === 'warning' && 'text-orange-500',
          tone === 'muted' && 'text-muted-foreground'
        )}
      >
        <CountUp value={value} />
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ReviewList({
  label,
  entries,
  onPick,
}: {
  label: string;
  entries: { q: StudyItem; i: number }[];
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">
        {label} ({entries.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map(({ q, i }) => (
          <Button key={q.id} variant="outline" size="sm" className="rounded-full" onClick={() => onPick(i)} title={q.question}>
            Question {i + 1}
          </Button>
        ))}
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'Pick one',
  MULTIPLE_SELECT: 'Pick every correct answer',
  TRUE_FALSE: 'True or false',
  FILL_IN_THE_BLANK: 'Fill the blank',
  SHORT_ANSWER: 'Short answer',
  OPEN_ENDED: 'Written answer',
  MATCHING: 'Match the pairs',
  ORDERING: 'Put these in order',
};

/** What the student saw after pressing Check, in practice mode. */
function Verdict({ item, given, reduceMotion }: { item: StudyItem; given: string; reduceMotion: boolean }) {
  const correct = previewVerdict(item, given);

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(10px)' }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'mt-6 overflow-hidden rounded-2xl border p-5',
        correct === true
          ? 'border-success/30 bg-success/10'
          : correct === false
            ? 'border-destructive/30 bg-destructive/10'
            : 'border-border/60 bg-muted/40'
      )}
    >
      <p
        className={cn(
          'flex items-center gap-2.5 font-heading text-lg font-bold',
          correct === true ? 'text-success' : correct === false ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        <motion.span
          initial={reduceMotion ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.1 }}
          className={cn(
            'grid size-8 place-items-center rounded-full',
            correct === true ? 'bg-success text-white' : correct === false ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'
          )}
        >
          {correct === true ? <Check className="size-4" strokeWidth={3} /> : correct === false ? <X className="size-4" strokeWidth={3} /> : <CircleAlert className="size-4" />}
        </motion.span>
        {correct === true ? 'Correct' : correct === false ? 'Not quite' : 'Marked at the end'}
      </p>

      {correct !== true && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Answer: </span>
          <span className="text-muted-foreground">{formatAnswer(item.answer)}</span>
        </p>
      )}

      {item.explanation && (
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {item.explanation}
        </p>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ widgets */

/**
 * One widget per question type.
 *
 * Every one of them writes a STRING the shared marker (lib/marking.ts) reads:
 * plain text for single answers, JSON for structured ones - the chosen
 * options, the order, the term-to-definition map - because options can
 * themselves contain commas, pipes and colons.
 */
function AnswerWidget({
  item,
  given,
  onChange,
  locked,
  reduceMotion,
}: {
  item: StudyItem;
  given: string;
  onChange: (value: string) => void;
  locked: boolean;
  reduceMotion: boolean;
}) {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
      return <ChoiceList item={item} given={given} onChange={onChange} locked={locked} reduceMotion={reduceMotion} />;
    case 'TRUE_FALSE':
      return (
        <ChoiceList
          item={{ ...item, options: ['True', 'False'] }}
          given={given}
          onChange={onChange}
          locked={locked}
          reduceMotion={reduceMotion}
          columns
        />
      );
    case 'MULTIPLE_SELECT':
      return <MultiSelect item={item} given={given} onChange={onChange} locked={locked} reduceMotion={reduceMotion} />;
    case 'ORDERING':
      return <Ordering item={item} given={given} onChange={onChange} locked={locked} />;
    case 'MATCHING':
      return <Matching item={item} given={given} onChange={onChange} locked={locked} />;
    case 'FILL_IN_THE_BLANK':
      return (
        <input
          value={given}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          placeholder="The missing word or phrase"
          aria-label="Your answer"
          className="h-14 w-full rounded-2xl border border-border/60 bg-background/60 px-5 text-lg outline-none transition-shadow focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60"
        />
      );
    default:
      return (
        <textarea
          value={given}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          rows={item.type === 'OPEN_ENDED' ? 8 : 4}
          aria-label="Your answer"
          placeholder={item.type === 'OPEN_ENDED' ? 'Write your answer…' : 'A sentence or two…'}
          className="w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-5 py-4 text-base leading-relaxed outline-none transition-shadow focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60"
        />
      );
  }
}

/** Options arrive one after another, each sharpening out of a blur. */
const listMotion = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};
const rowMotion = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const } },
};

function optionRow(state: 'idle' | 'picked' | 'right' | 'wrong') {
  return cn(
    'group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    state === 'right' && 'answer-glow border-success/50 bg-success/10',
    state === 'wrong' && 'answer-shake border-destructive/50 bg-destructive/10',
    state === 'picked' && 'border-primary bg-primary/10 shadow-[0_8px_24px_-12px] shadow-primary/50',
    state === 'idle' && 'border-border/60 bg-background/50 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-background/80 hover:shadow-md'
  );
}

function optionKey(state: 'idle' | 'picked' | 'right' | 'wrong') {
  return cn(
    'grid size-9 shrink-0 place-items-center rounded-xl border text-sm font-bold transition-all duration-200',
    state === 'right' && 'border-success bg-success text-white',
    state === 'wrong' && 'border-destructive bg-destructive text-white',
    state === 'picked' && 'scale-110 border-primary bg-primary text-primary-foreground',
    state === 'idle' && 'border-border bg-background text-muted-foreground group-hover:border-foreground/30 group-hover:text-foreground'
  );
}

function ChoiceList({
  item,
  given,
  onChange,
  locked,
  reduceMotion,
  columns = false,
}: {
  item: StudyItem;
  given: string;
  onChange: (v: string) => void;
  locked: boolean;
  reduceMotion: boolean;
  columns?: boolean;
}) {
  return (
    <motion.div
      variants={reduceMotion ? undefined : listMotion}
      initial="hidden"
      animate="shown"
      className={cn(columns ? 'grid gap-3 sm:grid-cols-2' : 'space-y-2.5')}
    >
      {item.options.map((option, i) => {
        const picked = given === option;
        const isAnswer = normalise(option) === normalise(item.answer);
        const state = locked
          ? isAnswer
            ? 'right'
            : picked
              ? 'wrong'
              : 'idle'
          : picked
            ? 'picked'
            : 'idle';

        return (
          <motion.button
            variants={reduceMotion ? undefined : rowMotion}
            key={option}
            type="button"
            data-option={i}
            disabled={locked}
            aria-pressed={picked}
            onClick={() => onChange(option)}
            className={cn(optionRow(state), locked && state === 'idle' && 'opacity-55 hover:translate-y-0 hover:shadow-none')}
          >
            <span className={optionKey(state)}>
              {state === 'right' ? <Check className="size-4" strokeWidth={3} /> : state === 'wrong' ? <X className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 text-base font-medium">{option}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function MultiSelect({
  item,
  given,
  onChange,
  locked,
  reduceMotion,
}: {
  item: StudyItem;
  given: string;
  onChange: (v: string) => void;
  locked: boolean;
  reduceMotion: boolean;
}) {
  const chosen = useMemo(() => new Set(given ? decodeSelection(item, given) : []), [given, item]);

  return (
    <motion.div variants={reduceMotion ? undefined : listMotion} initial="hidden" animate="shown" className="space-y-2.5">
      {item.options.map((option, i) => {
        const picked = chosen.has(option);
        return (
          <motion.button
            variants={reduceMotion ? undefined : rowMotion}
            key={option}
            type="button"
            data-option={i}
            disabled={locked}
            aria-pressed={picked}
            onClick={() => {
              const next = new Set(chosen);
              if (next.has(option)) next.delete(option);
              else next.add(option);
              // Structured, in option order: an option may contain a comma.
              onChange(next.size ? encodeAnswer(item.options.filter((o) => next.has(o))) : '');
            }}
            className={optionRow(picked ? 'picked' : 'idle')}
          >
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-all duration-200',
                picked ? 'scale-110 border-primary bg-primary text-primary-foreground' : 'border-border'
              )}
            >
              {picked && <Check className="size-4" strokeWidth={3} />}
            </span>
            <span className="min-w-0 text-base font-medium">{option}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function Ordering({
  item,
  given,
  onChange,
  locked,
}: {
  item: StudyItem;
  given: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  // The working order lives in the answer string so nothing is lost when the
  // student moves between questions and comes back.
  const order = useMemo(() => {
    const current = given ? decodeOrder(item, given) : [];
    return current.length === item.items.length ? current : item.items;
  }, [given, item]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(encodeAnswer(next));
  };

  // The starting order is only a suggestion until the student moves something
  // or says it is right - otherwise "I agree with this order" saved nothing
  // and the question counted as unanswered (S10).
  const confirmed = Boolean(given);

  return (
    <div className="space-y-3">
      {!confirmed && !locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Move the items, or keep this order if you think it is right.</span>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange(encodeAnswer(order))}>
            Keep this order
          </Button>
        </div>
      )}
      <ol className="space-y-2">
        {order.map((row, i) => (
          // layout: rows glide to their new place when moved.
          <motion.li
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            key={row}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
            <span className="min-w-0 flex-1 text-base font-medium">{row}</span>
            <span className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" className="rounded-full" disabled={locked || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${row} up`}>
                <ChevronUp />
              </Button>
              <Button variant="ghost" size="icon-sm" className="rounded-full" disabled={locked || i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${row} down`}>
                <ChevronDown />
              </Button>
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function Matching({
  item,
  given,
  onChange,
  locked,
}: {
  item: StudyItem;
  given: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  const pairs = useMemo(() => new Map(Object.entries(given ? decodePairs(item, given) : {})), [given, item]);

  const setPair = (term: string, definition: string) => {
    const next = new Map(pairs);
    if (definition) next.set(term, definition);
    else next.delete(term);
    onChange(next.size ? encodeAnswer(Object.fromEntries(item.items.filter((t) => next.has(t)).map((t) => [t, next.get(t)!]))) : '');
  };

  return (
    <div className="space-y-2.5">
      {item.items.map((term) => {
        const chosen = pairs.get(term) ?? '';
        return (
          <div
            key={term}
            className={cn(
              'flex flex-col gap-2 rounded-2xl border p-3 transition-colors sm:flex-row sm:items-center',
              chosen ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/60 bg-background/60'
            )}
          >
            <span className="min-w-0 flex-1 text-base font-semibold">{term}</span>
            <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
            <select
              value={chosen}
              disabled={locked}
              aria-label={`Match for ${term}`}
              onChange={(e) => setPair(term, e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 sm:w-72"
            >
              <option value="">Choose…</option>
              {item.options.map((definition) => (
                <option key={definition} value={definition}>
                  {definition}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
