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
import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
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
  onQuit,
  busy,
}: {
  items: StudyItem[];
  mode: RunnerMode;
  /** The saved run to pick up: answers, flags, position and an exam deadline. */
  initial?: RunDraft;
  /** Called after every change, so the caller can autosave the run. */
  onProgress?: (snapshot: RunSnapshot) => void;
  onFinish: (answers: { id: string; answer: string }[], durationSec: number) => void;
  onQuit: () => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(() => Math.min(initial?.position ?? 0, Math.max(0, items.length - 1)));
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
    // An exam gets a last look at what is unanswered or flagged; practice has
    // already shown every answer, so it hands in directly.
    if (mode === 'EXAM') setReviewing(true);
    else submit();
  };

  const clock =
    deadline !== null && secondsLeft !== null ? (
      <Pill tone={secondsLeft < 60 ? 'danger' : 'default'} aria-label={`Time left: ${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds`}>
        <Clock />
        {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
      </Pill>
    ) : null;

  const navigator = (
    <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
      {items.map((q, i) => {
        const answered = isAnswered(q);
        const isFlagged = flags.has(q.id);
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === index && !reviewing ? 'step' : undefined}
            aria-label={`Question ${i + 1}${answered ? ', answered' : ', not answered'}${isFlagged ? ', flagged' : ''}`}
            className={cn(
              'relative flex size-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              i === index && !reviewing
                ? 'border-primary bg-primary text-primary-foreground'
                : answered
                  ? 'border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            {i + 1}
            {isFlagged && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-card bg-orange-500" />
            )}
          </button>
        );
      })}
    </nav>
  );

  if (reviewing) {
    return (
      <Panel className="p-5 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-heading text-xl font-bold">Hand in your paper?</h2>
          {clock}
        </div>
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {items.length} answered. Answers are marked only after you hand in.
        </p>
        {(unanswered.length > 0 || flagged.length > 0) && (
          <div className="mt-5 space-y-3">
            {unanswered.length > 0 && (
              <ReviewList label="Not answered" entries={unanswered} onPick={goTo} />
            )}
            {flagged.length > 0 && <ReviewList label="Flagged" entries={flagged} onPick={goTo} />}
          </div>
        )}
        <div className="mt-6">{navigator}</div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border/60 pt-6">
          <Button variant="outline" size="lg" onClick={() => goTo(index)}>
            <ArrowLeft />
            Keep working
          </Button>
          <Button size="lg" onClick={submit} disabled={busy}>
            {busy ? (
              <>
                Marking…
                <Loader2 className="animate-spin" />
              </>
            ) : (
              <>
                Hand in
                <Flag />
              </>
            )}
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-5 md:p-8">
      {/* Progress, the clock, and the way back out. */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
          <span className="tabular-nums">
            Question {index + 1} of {items.length} · {answeredCount} answered
          </span>
          <span className="flex items-center gap-3">
            {clock}
            <Button variant="ghost" size="sm" onClick={onQuit}>
              <X />
              {mode === 'EXAM' ? 'Leave (saved)' : 'Quit'}
            </Button>
          </span>
        </div>
        {navigator}
      </div>

      <div key={item.id} className="animate-in fade-in duration-200">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-primary">{TYPE_LABEL[item.type] ?? 'Question'}</p>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={flags.has(item.id)}
            onClick={toggleFlag}
            className={cn(flags.has(item.id) && 'text-orange-600 dark:text-orange-400')}
          >
            <Flag />
            {flags.has(item.id) ? 'Flagged' : 'Flag'}
          </Button>
        </div>
        <h2 className="mt-1.5 font-heading text-xl font-bold leading-snug md:text-2xl">{item.question}</h2>

        <div className="mt-6">
          <AnswerWidget item={item} given={given} onChange={set} locked={Boolean(isRevealed)} />
        </div>

        <div aria-live="polite">{isRevealed && <Verdict item={item} given={given} />}</div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <Button variant="outline" size="lg" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
            <ArrowLeft />
            Previous
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              {mode === 'EXAM' ? 'Saved as you go · marked when you hand in' : isRevealed ? '' : 'Answer, then check'}
            </span>
            {mode === 'PRACTICE' && !isRevealed && (
              <Button
                size="lg"
                disabled={!given.trim() || busy}
                onClick={() => setRevealed((r) => ({ ...r, [item.id]: true }))}
              >
                Check
                <Check />
              </Button>
            )}
            {(mode === 'EXAM' || isRevealed) && (
              <Button size="lg" onClick={advance} disabled={busy}>
                {busy && isLast ? (
                  <>
                    Marking…
                    <Loader2 className="animate-spin" />
                  </>
                ) : isLast ? (
                  <>
                    {mode === 'EXAM' ? 'Review & hand in' : 'Finish'}
                    <Flag />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
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
          <Button key={q.id} variant="outline" size="sm" onClick={() => onPick(i)}>
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
function Verdict({ item, given }: { item: StudyItem; given: string }) {
  const correct = previewVerdict(item, given);

  return (
    <div
      className={cn(
        'mt-6 rounded-2xl border p-4',
        correct === true
          ? 'border-success/30 bg-success/10'
          : correct === false
            ? 'border-destructive/30 bg-destructive/10'
            : 'border-border/60 bg-muted/40'
      )}
    >
      <p
        className={cn(
          'flex items-center gap-2 text-sm font-bold',
          correct === true
            ? 'text-success'
            : correct === false
              ? 'text-destructive'
              : 'text-muted-foreground'
        )}
      >
        {correct === true ? (
          <>
            <Check className="h-4 w-4" /> Correct
          </>
        ) : correct === false ? (
          <>
            <X className="h-4 w-4" /> Not quite
          </>
        ) : (
          <>
            <CircleAlert className="h-4 w-4" /> Marked at the end
          </>
        )}
      </p>

      {correct !== true && (
        <p className="mt-2 text-sm">
          <span className="font-bold">Answer: </span>
          <span className="text-muted-foreground">{formatAnswer(item.answer)}</span>
        </p>
      )}

      {item.explanation && (
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {item.explanation}
        </p>
      )}
    </div>
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
}: {
  item: StudyItem;
  given: string;
  onChange: (value: string) => void;
  locked: boolean;
}) {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
      return <ChoiceList item={item} given={given} onChange={onChange} locked={locked} />;
    case 'TRUE_FALSE':
      return (
        <ChoiceList
          item={{ ...item, options: ['True', 'False'] }}
          given={given}
          onChange={onChange}
          locked={locked}
        />
      );
    case 'MULTIPLE_SELECT':
      return <MultiSelect item={item} given={given} onChange={onChange} locked={locked} />;
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
          className="h-12 w-full rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
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
          placeholder={
            item.type === 'OPEN_ENDED' ? 'Write your answer…' : 'A sentence or two…'
          }
          className="w-full resize-none rounded-xl border border-input bg-transparent px-4 py-3 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
        />
      );
  }
}

function optionRow(state: 'idle' | 'picked' | 'right' | 'wrong') {
  return cn(
    'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors',
    state === 'right' && 'border-success/40 bg-success/10',
    state === 'wrong' && 'border-destructive/40 bg-destructive/10',
    state === 'picked' && 'border-primary bg-primary/10',
    state === 'idle' && 'border-border/60 hover:bg-muted/60'
  );
}

function ChoiceList({
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
  return (
    <div className="space-y-3">
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
          <button
            key={option}
            type="button"
            disabled={locked}
            aria-pressed={picked}
            onClick={() => onChange(option)}
            className={optionRow(state)}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-bold',
                state === 'right' && 'border-success/40 bg-success/20 text-success',
                state === 'wrong' && 'border-destructive/40 bg-destructive/20 text-destructive',
                state === 'picked' && 'border-primary bg-primary/20 text-primary',
                state === 'idle' && 'border-border text-muted-foreground'
              )}
            >
              {state === 'right' ? (
                <Check className="h-4 w-4" />
              ) : state === 'wrong' ? (
                <X className="h-4 w-4" />
              ) : (
                String.fromCharCode(65 + i)
              )}
            </span>
            <span className="text-sm font-semibold md:text-base">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect({
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
  const chosen = useMemo(() => new Set(given ? decodeSelection(item, given) : []), [given, item]);

  return (
    <div className="space-y-3">
      {item.options.map((option) => {
        const picked = chosen.has(option);
        return (
          <button
            key={option}
            type="button"
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
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                picked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
              )}
            >
              {picked && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="text-sm font-semibold md:text-base">{option}</span>
          </button>
        );
      })}
    </div>
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2">
        <span className="text-sm text-muted-foreground">Move the items, or keep this order if you think it is right.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(encodeAnswer(order))}>
          Keep this order
        </Button>
      </div>
    )}
    <ol className="space-y-2">
      {order.map((row, i) => (
        <li
          key={row}
          className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/40 p-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold">{row}</span>
          <span className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={locked || i === 0}
              onClick={() => move(i, i - 1)}
              aria-label={`Move ${row} up`}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={locked || i === order.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label={`Move ${row} down`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </span>
        </li>
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
    <div className="space-y-3">
      {item.items.map((term) => (
        <div
          key={term}
          className="flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/40 p-3 sm:flex-row sm:items-center"
        >
          <span className="min-w-0 flex-1 text-sm font-bold">{term}</span>
          <select
            value={pairs.get(term) ?? ''}
            disabled={locked}
            aria-label={`Match for ${term}`}
            onChange={(e) => setPair(term, e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring sm:w-64 dark:bg-input/30"
          >
            <option value="">Choose…</option>
            {item.options.map((definition) => (
              <option key={definition} value={definition}>
                {definition}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
