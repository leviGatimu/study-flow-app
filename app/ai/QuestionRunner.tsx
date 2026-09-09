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
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Flag,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StudyItem } from '@/lib/study-actions';

export type RunnerMode = 'PRACTICE' | 'EXAM';

/** Lowercase, drop punctuation, collapse spaces — mirrors the server marker. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether the answer is right, or null when this component should not say.
 *
 * Null for everything written, and for matching and ordering where the server
 * awards partial credit that a simple comparison here would misreport.
 */
function looksCorrect(item: StudyItem, given: string): boolean | null {
  if (!given.trim()) return false;
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
      return normalise(given) === normalise(item.answer);
    case 'MULTIPLE_SELECT': {
      const want = new Set(item.answer.split(',').map(normalise).filter(Boolean));
      const got = new Set(given.split(',').map(normalise).filter(Boolean));
      return want.size === got.size && [...want].every((w) => got.has(w));
    }
    case 'FILL_IN_THE_BLANK': {
      const want = normalise(item.answer);
      const got = normalise(given);
      return Boolean(want) && (got === want || got.includes(want) || want.includes(got));
    }
    default:
      return null;
  }
}

export function QuestionRunner({
  items,
  mode,
  minutes,
  onFinish,
  onQuit,
  busy,
}: {
  items: StudyItem[];
  mode: RunnerMode;
  /** Exam only. The paper submits itself when this runs out. */
  minutes?: number;
  onFinish: (answers: { id: string; answer: string }[], durationSec: number) => void;
  onQuit: () => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  // Set on mount rather than during render: reading the clock while rendering
  // is impure, and the value wanted here is "when did this run begin", which
  // happens once.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [secondsLeft, setSecondsLeft] = useState((minutes ?? 0) * 60);

  const item = items[index];
  const given = answers[item?.id] ?? '';
  const isRevealed = mode === 'PRACTICE' && revealed[item?.id];
  const isLast = index === items.length - 1;

  const submit = useCallback(() => {
    onFinish(
      items.map((q) => ({ id: q.id, answer: answers[q.id] ?? '' })),
      startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0
    );
  }, [answers, items, onFinish]);

  // The exam clock. Runs only when a limit was set, and submits the paper
  // itself rather than leaving the student staring at 00:00.
  useEffect(() => {
    if (mode !== 'EXAM' || !minutes) return;
    const timer = setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          clearInterval(timer);
          submit();
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, minutes, submit]);

  if (!item) return null;

  const answeredCount = items.filter((q) => (answers[q.id] ?? '').trim()).length;
  const set = (value: string) => setAnswers((a) => ({ ...a, [item.id]: value }));

  const advance = () => {
    if (isLast) submit();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      {/* Progress. In an exam this is the only thing on screen that changes
          between questions, so it carries the clock too. */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
          <span>
            Question {index + 1} of {items.length}
          </span>
          <span className="flex items-center gap-3">
            {mode === 'EXAM' && minutes ? (
              <span
                className={cn(
                  'flex items-center gap-1.5 tabular-nums',
                  secondsLeft < 60 && 'text-rose-500'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </span>
            ) : (
              <span>{answeredCount} answered</span>
            )}
            <button
              type="button"
              onClick={onQuit}
              className="font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Quit
            </button>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((index + (isRevealed ? 1 : 0)) / items.length) * 100}%` }}
          />
        </div>
      </header>

      <div key={item.id} className="animate-in fade-in slide-in-from-right-4 duration-200">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
          {TYPE_LABEL[item.type] ?? 'Question'}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-black leading-snug md:text-3xl">
          {item.question}
        </h2>

        <div className="mt-7">
          <AnswerWidget item={item} given={given} onChange={set} locked={Boolean(isRevealed)} />
        </div>

        {isRevealed && <Verdict item={item} given={given} />}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/60 pt-6">
          <span className="text-xs text-muted-foreground">
            {mode === 'EXAM'
              ? 'Marked when you finish the paper.'
              : isRevealed
                ? ''
                : 'Answer, then check.'}
          </span>
          <div className="flex gap-2">
            {mode === 'PRACTICE' && !isRevealed && (
              <Button
                size="lg"
                disabled={!given.trim() || busy}
                onClick={() => setRevealed((r) => ({ ...r, [item.id]: true }))}
              >
                Check
                <Check className="h-4 w-4" />
              </Button>
            )}
            {(mode === 'EXAM' || isRevealed) && (
              <Button size="lg" onClick={advance} disabled={busy}>
                {isLast ? (
                  <>
                    Finish
                    <Flag className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
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
  const correct = looksCorrect(item, given);

  return (
    <div
      className={cn(
        'mt-6 rounded-2xl border p-4',
        correct === true
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : correct === false
            ? 'border-rose-500/40 bg-rose-500/10'
            : 'border-border/60 bg-muted/40'
      )}
    >
      <p
        className={cn(
          'flex items-center gap-2 text-sm font-black',
          correct === true
            ? 'text-emerald-600 dark:text-emerald-400'
            : correct === false
              ? 'text-rose-600 dark:text-rose-400'
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
          <span className="text-muted-foreground">{item.answer}</span>
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
 * Every one of them writes a STRING, in the exact format the server marker
 * parses: comma-separated for multi-select, " | " for ordering, "Term: value;"
 * for matching. Keeping the encoding here rather than in the caller means there
 * is one place to look when a mark comes back wrong.
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
    state === 'right' && 'border-emerald-500/50 bg-emerald-500/10',
    state === 'wrong' && 'border-rose-500/50 bg-rose-500/10',
    state === 'picked' && 'border-primary bg-primary/10',
    state === 'idle' && 'border-border/60 hover:border-primary/40 hover:bg-muted/40'
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
            onClick={() => onChange(option)}
            className={optionRow(state)}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-black',
                state === 'right' && 'border-emerald-500/50 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                state === 'wrong' && 'border-rose-500/50 bg-rose-500/20 text-rose-600 dark:text-rose-400',
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
  const chosen = useMemo(
    () => new Set(given.split(',').map((s) => s.trim()).filter(Boolean)),
    [given]
  );

  return (
    <div className="space-y-3">
      {item.options.map((option) => {
        const picked = chosen.has(option);
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            onClick={() => {
              const next = new Set(chosen);
              if (next.has(option)) next.delete(option);
              else next.add(option);
              onChange([...next].join(', '));
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
    const current = given.split('|').map((s) => s.trim()).filter(Boolean);
    return current.length === item.items.length ? current : item.items;
  }, [given, item.items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next.join(' | '));
  };

  return (
    <ol className="space-y-2">
      {order.map((row, i) => (
        <li
          key={row}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground">
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
  const pairs = useMemo(() => {
    const map = new Map<string, string>();
    for (const pair of given.split(';')) {
      const [term, definition] = pair.split(':');
      if (term?.trim()) map.set(term.trim(), (definition ?? '').trim());
    }
    return map;
  }, [given]);

  const setPair = (term: string, definition: string) => {
    const next = new Map(pairs);
    next.set(term, definition);
    onChange(
      item.items
        .map((t) => `${t}: ${next.get(t) ?? ''}`)
        .filter((row) => !row.endsWith(': '))
        .join('; ')
    );
  };

  return (
    <div className="space-y-3">
      {item.items.map((term) => (
        <div
          key={term}
          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center"
        >
          <span className="min-w-0 flex-1 text-sm font-bold">{term}</span>
          <select
            value={pairs.get(term) ?? ''}
            disabled={locked}
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
