'use client';

/**
 * AI Study: turn a document into questions, then answer them.
 *
 * One screen, five states, no navigation. A student arrives with a PDF and
 * wants to be tested on it; every extra page between those two facts is a place
 * to lose them. So the library, the upload, the configuration, the run and the
 * results are all here, and the only thing that changes is what is on screen.
 *
 * THE FILE NEVER LEAVES THE BROWSER. readStudyDocument extracts the text here
 * and the File object is dropped immediately afterwards - only the text is sent.
 * That is what makes this work on a serverless host with a read-only filesystem,
 * and it means nothing private is left lying in an uploads directory.
 */

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { readStudyDocument, type StudyDocument } from '@/lib/file-extract';
import {
  deleteStudySet,
  generateFlashcards,
  generateStudySet,
  getStudySet,
  submitAttempt,
  type AttemptResult,
  type StudySetDetail,
  type StudySetSummary,
  type StudyStyle,
} from '@/lib/study-actions';
import { QuestionRunner, type RunnerMode } from './QuestionRunner';
import { FlashcardRunner } from './FlashcardRunner';

type Stage = 'library' | 'configure' | 'generating' | 'set' | 'running' | 'cards' | 'results';

const STYLES: { id: StudyStyle; label: string; blurb: string }[] = [
  { id: 'MULTIPLE_CHOICE', label: 'Multiple choice', blurb: 'Pick one, sometimes pick several.' },
  { id: 'TRUE_FALSE', label: 'True/false & blanks', blurb: 'Quick recall, fast to answer.' },
  { id: 'WRITTEN', label: 'Written answers', blurb: 'Short and long answers, marked by AI.' },
  { id: 'MIXED', label: 'A mix of everything', blurb: 'All eight types, like a real paper.' },
];

export function StudyGenerator({
  sets,
  subjects,
  aiReady,
}: {
  sets: StudySetSummary[];
  subjects: string[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('library');
  const [doc, setDoc] = useState<StudyDocument | null>(null);
  const [detail, setDetail] = useState<StudySetDetail | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('PRACTICE');
  const [busy, setBusy] = useState(false);

  const openSet = useCallback(
    async (setId: string) => {
      setBusy(true);
      const loaded = await getStudySet(setId);
      setBusy(false);
      if (!loaded) {
        toast.error('That set is gone.');
        router.refresh();
        return;
      }
      setDetail(loaded);
      setStage('set');
    },
    [router]
  );

  const finish = async (answers: { id: string; answer: string }[], durationSec: number) => {
    if (!detail) return;
    setBusy(true);
    const res = await submitAttempt({
      setId: detail.id,
      mode: runnerMode,
      answers,
      durationSec,
    });
    setBusy(false);

    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    setResult(res);
    setStage('results');
    router.refresh();
  };

  return (
    <div className="min-h-full">
      {stage === 'library' && (
        <Library
          sets={sets}
          aiReady={aiReady}
          busy={busy}
          onNew={() => setStage('configure')}
          onOpen={openSet}
        />
      )}

      {stage === 'configure' && (
        <Configure
          subjects={subjects}
          doc={doc}
          setDoc={setDoc}
          onBack={() => setStage('library')}
          onGenerating={() => setStage('generating')}
          onDone={async (setId) => {
            setDoc(null);
            await openSet(setId);
            router.refresh();
          }}
          onFailed={() => setStage('configure')}
        />
      )}

      {stage === 'generating' && <Generating doc={doc} />}

      {stage === 'set' && detail && (
        <SetOverview
          detail={detail}
          busy={busy}
          onBack={() => {
            setDetail(null);
            setStage('library');
          }}
          onStart={(mode) => {
            setRunnerMode(mode);
            setStage('running');
          }}
          onCards={() => setStage('cards')}
          onMakeCards={async () => {
            setBusy(true);
            const res = await generateFlashcards(detail.id);
            setBusy(false);
            if ('error' in res) {
              toast.error(res.error);
              return;
            }
            toast.success(`${res.count} flashcards ready.`);
            await openSet(detail.id);
          }}
        />
      )}

      {stage === 'running' && detail && (
        <QuestionRunner
          items={detail.items}
          mode={runnerMode}
          minutes={runnerMode === 'EXAM' ? Math.max(5, detail.items.length * 2) : undefined}
          busy={busy}
          onFinish={finish}
          onQuit={() => setStage('set')}
        />
      )}

      {stage === 'cards' && detail && (
        <FlashcardRunner
          setId={detail.id}
          cards={detail.cards}
          onDone={async () => {
            await openSet(detail.id);
          }}
        />
      )}

      {stage === 'results' && result && detail && (
        <Results
          result={result}
          title={detail.title}
          onRetake={() => setStage('set')}
          onLibrary={() => {
            setDetail(null);
            setResult(null);
            setStage('library');
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- library */

function Library({
  sets,
  aiReady,
  busy,
  onNew,
  onOpen,
}: {
  sets: StudySetSummary[];
  aiReady: boolean;
  busy: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI Study
          </p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight md:text-4xl">
            Turn anything into a test.
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Drop in a PDF, a Word file or a photo of your notes. Say how many questions you want
            and what kind. Then answer them one at a time.
          </p>
        </div>
        <Button size="lg" className="h-11" onClick={onNew} disabled={!aiReady}>
          <Plus className="h-4 w-4" />
          New set
        </Button>
      </header>

      {!aiReady && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div>
            <p className="font-heading text-base font-black text-amber-700 dark:text-amber-400">
              This needs an AI key
            </p>
            <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
              Generating questions is the one thing here that cannot be done locally. Google&apos;s
              key is free.
            </p>
          </div>
          <Button asChild size="lg" className="h-10 shrink-0">
            <Link href="/settings?tab=ai">
              Add a key
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-10">
        {sets.length === 0 ? (
          <EmptyState
            icon={<BookOpenCheck className="h-6 w-6 text-muted-foreground" />}
            title="No study sets yet"
            description="Upload a chapter, a handout or your own notes and the questions are written for you."
            action={
              <Button onClick={onNew} disabled={!aiReady}>
                <Upload className="h-4 w-4" />
                Upload something
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sets.map((set) => (
              <li key={set.id} className="group relative">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onOpen(set.id)}
                  className="flex h-full w-full flex-col rounded-2xl border border-border/60 bg-card p-5 pr-12 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                    {set.subject}
                  </span>
                  <span className="mt-1.5 font-heading text-lg font-black leading-snug">
                    {set.title}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {set.itemCount} questions
                    </span>
                    {set.cardCount > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {set.cardCount} cards
                      </span>
                    )}
                    {set.attempts > 0 && (
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        best {set.bestScore}%
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${set.title}`}
                  onClick={async () => {
                    await deleteStudySet(set.id);
                    toast.success('Set deleted.');
                    router.refresh();
                  }}
                  className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- configure */

function Configure({
  subjects,
  doc,
  setDoc,
  onBack,
  onGenerating,
  onDone,
  onFailed,
}: {
  subjects: string[];
  doc: StudyDocument | null;
  setDoc: (d: StudyDocument | null) => void;
  onBack: () => void;
  onGenerating: () => void;
  onDone: (setId: string) => Promise<void>;
  onFailed: () => void;
}) {
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [count, setCount] = useState(10);
  const [style, setStyle] = useState<StudyStyle>('MIXED');
  const [focus, setFocus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const take = async (file: File) => {
    setReading(true);
    try {
      const read = await readStudyDocument(file);
      setDoc(read);
      // The File is deliberately not kept anywhere. Only `read` survives, and
      // it holds text, never bytes.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setReading(false);
    }
  };

  const generate = async () => {
    if (!doc) return;
    if (!subject) {
      toast.error('Pick a subject.');
      return;
    }
    onGenerating();
    const res = await generateStudySet({
      subject,
      sourceName: doc.name,
      text: doc.text || undefined,
      image: doc.image,
      count,
      style,
      instructions: focus.trim() || undefined,
    });

    if ('error' in res) {
      toast.error(res.error);
      onFailed();
      return;
    }
    if (res.generated < res.requested) {
      toast.warning(
        `Asked for ${res.requested}, got ${res.generated}. The document may not have enough material for more.`
      );
    } else {
      toast.success(`${res.generated} questions ready.`);
    }
    await onDone(res.setId);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <h1 className="font-heading text-3xl font-black tracking-tight">New study set</h1>

      {/* 1. The document */}
      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          1 · What are you studying?
        </h2>

        {!doc ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void take(file);
            }}
            className={cn(
              'mt-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border/60'
            )}
          >
            {reading ? (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading it…
              </p>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-heading text-lg font-black">Drop a file here</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PDF, Word (.docx), a text file, or a photo of a page
                </p>
                <Button variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}>
                  Choose a file
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void take(file);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-bold">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{doc.name}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.image
                    ? 'Image — the AI will read it directly.'
                    : `${doc.totalChars.toLocaleString()} characters${
                        doc.pageCount ? ` · ${doc.pageCount} pages` : ''
                      }`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDoc(null)}>
                Change
              </Button>
            </div>

            {doc.truncated && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                That is longer than can be used at once. Only the first part will be read — split
                it into two sets to cover all of it.
              </p>
            )}

            {doc.text && (
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {doc.text.slice(0, 400)}…
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. The shape of the set */}
      <section className={cn('mt-8', !doc && 'pointer-events-none opacity-40')}>
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          2 · What should it test?
        </h2>

        <div className="mt-3 space-y-6 rounded-2xl border border-border/60 bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="set-subject" className="text-sm font-bold">
                Subject
              </Label>
              {subjects.length > 0 ? (
                <select
                  id="set-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring dark:bg-input/30"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="set-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="h-11 rounded-xl px-3 text-base"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="set-count" className="text-sm font-bold">
                How many questions? <span className="text-primary">{count}</span>
              </Label>
              <input
                id="set-count"
                type="range"
                min={3}
                max={40}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-11 w-full accent-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold">What kind?</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {STYLES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStyle(option.id)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    style === option.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:bg-muted/40'
                  )}
                >
                  <p className="font-bold">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="set-focus" className="text-sm font-bold">
              Anything to focus on? <span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input
              id="set-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. only chapter 3, or go hard on the formulas"
              className="h-11 rounded-xl px-3 text-base"
            />
          </div>
        </div>

        <Button size="lg" className="mt-6 h-12 w-full rounded-2xl text-base" disabled={!doc} onClick={generate}>
          <Sparkles className="h-4 w-4" />
          Write my {count} questions
        </Button>
      </section>
    </div>
  );
}

function Generating({ doc }: { doc: StudyDocument | null }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h2 className="mt-6 font-heading text-2xl font-black">Reading {doc?.name ?? 'your document'}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Writing questions from it. Longer sets are written in batches, so this can take up to a
        minute.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- set detail */

function SetOverview({
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
  onStart: (mode: RunnerMode) => void;
  onCards: () => void;
  onMakeCards: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
        <ArrowLeft className="h-4 w-4" />
        All sets
      </Button>

      <p className="text-[10px] font-black uppercase tracking-wider text-primary">
        {detail.subject}
      </p>
      <h1 className="mt-1.5 font-heading text-3xl font-black tracking-tight">{detail.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {detail.items.length} questions
        {detail.sourceName ? ` · from ${detail.sourceName}` : ''}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <ModeCard
          title="Practice"
          blurb="Marked as you go, with an explanation after each question."
          icon={<BookOpenCheck className="h-5 w-5" />}
          onClick={() => onStart('PRACTICE')}
          disabled={busy || detail.items.length === 0}
        />
        <ModeCard
          title="Mock exam"
          blurb="Timed. No feedback at all until you hand it in."
          icon={<Clock className="h-5 w-5" />}
          onClick={() => onStart('EXAM')}
          disabled={busy || detail.items.length === 0}
        />
        {detail.cards.length > 0 ? (
          <ModeCard
            title="Flashcards"
            blurb={`${detail.cards.length} cards, spaced repetition.`}
            icon={<Layers className="h-5 w-5" />}
            onClick={onCards}
            disabled={busy}
          />
        ) : (
          <ModeCard
            title="Make flashcards"
            blurb="Generate cards from the same material."
            icon={<Plus className="h-5 w-5" />}
            onClick={onMakeCards}
            disabled={busy}
          />
        )}
      </div>

      {detail.attempts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Your attempts
          </h2>
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {detail.attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-sm">
                  <span className="font-bold">{a.mode === 'EXAM' ? 'Mock exam' : 'Practice'}</span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </span>
                <span
                  className={cn(
                    'font-heading text-lg font-black tabular-nums',
                    a.score >= 80
                      ? 'text-emerald-500'
                      : a.score >= 50
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  )}
                >
                  {a.score}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModeCard({
  title,
  blurb,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl border border-border/60 bg-card p-5 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-3 font-heading text-base font-black">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{blurb}</p>
    </button>
  );
}

/* ----------------------------------------------------------------- results */

function Results({
  result,
  title,
  onRetake,
  onLibrary,
}: {
  result: AttemptResult;
  title: string;
  onRetake: () => void;
  onLibrary: () => void;
}) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const shown = wrongOnly ? result.answers.filter((a) => !a.isCorrect) : result.answers;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
      <div className="rounded-3xl border border-border/60 bg-card p-8 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
        <p
          className={cn(
            'mt-3 font-heading text-6xl font-black tabular-nums',
            result.score >= 80
              ? 'text-emerald-500'
              : result.score >= 50
                ? 'text-amber-500'
                : 'text-rose-500'
          )}
        >
          {result.score}%
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.correct} of {result.total} correct
          {result.xp ? ` · +${result.xp.granted} XP` : ''}
        </p>
        {result.xp?.leveledUp && (
          <p className="mt-1 text-sm font-black text-primary">You levelled up.</p>
        )}
      </div>

      {result.notice && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
          {result.notice}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Every question
        </h2>
        <button
          type="button"
          onClick={() => setWrongOnly((v) => !v)}
          className="text-xs font-bold text-primary hover:underline"
        >
          {wrongOnly ? 'Show all' : 'Only what I got wrong'}
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {shown.map((a) => (
          <li
            key={a.id}
            className={cn(
              'rounded-2xl border p-4',
              a.isCorrect ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
            )}
          >
            <p className="font-bold">{a.question}</p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">You: </span>
              {a.given || <span className="italic text-muted-foreground">no answer</span>}
              {a.score > 0 && a.score < 100 && (
                <span className="ml-2 text-xs font-bold text-amber-500">{a.score}% credit</span>
              )}
            </p>
            {!a.isCorrect && (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Answer: </span>
                {a.expected}
              </p>
            )}
            {(a.feedback || a.explanation) && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {a.feedback || a.explanation}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" onClick={onRetake}>
          <RotateCcw className="h-4 w-4" />
          Take it again
        </Button>
        <Button variant="outline" size="lg" onClick={onLibrary}>
          Back to my sets
        </Button>
      </div>
    </div>
  );
}
