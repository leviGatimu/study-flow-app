'use client';

/**
 * Practice: turn a document into questions, then answer them.
 *
 * One route, several stages. A student arrives with a PDF and wants to be
 * tested on it; every extra page between those two facts is a place to lose
 * them. So the library, the upload, the configuration, the run and the results
 * are all here, and the only thing that changes is what is on screen. The open
 * set is mirrored into the URL (?set=<id>) so a refresh, or a link from another
 * page, lands on the same set.
 *
 * THE FILE NEVER LEAVES THE BROWSER. readStudyDocument extracts the text here
 * and the File object is dropped immediately afterwards - only the text is sent.
 * That is what makes this work on a serverless host with a read-only filesystem,
 * and it means nothing private is left lying in an uploads directory.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  ChevronRight,
  Clock,
  FileText,
  History,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow, Pill } from '@/components/ui/list-row';
import { Stat } from '@/components/ui/stat';
import { ConfirmModal } from '@/components/ConfirmModal';
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
  { id: 'TRUE_FALSE', label: 'True/false and blanks', blurb: 'Quick recall, fast to answer.' },
  { id: 'WRITTEN', label: 'Written answers', blurb: 'Short and long answers, marked by AI.' },
  { id: 'MIXED', label: 'A mix of everything', blurb: 'All eight types, like a real paper.' },
];

const MODE_LABEL: Record<RunnerMode, string> = {
  PRACTICE: 'Practice',
  EXAM: 'Mock exam',
};

/** Score colour: status, not decoration. */
function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  return score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
}

function subjectHref(subject: string) {
  return `/subjects?subject=${encodeURIComponent(subject)}`;
}

/**
 * Keep the address bar in step with what is on screen, without a server round
 * trip: the page already has everything it needs.
 */
function syncUrl(setId: string | null) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', setId ? `/ai?set=${encodeURIComponent(setId)}` : '/ai');
}

export function StudyGenerator({
  sets,
  subjects,
  aiReady,
  initialDetail,
  initialSubject,
  missingSet,
}: {
  sets: StudySetSummary[];
  subjects: string[];
  aiReady: boolean;
  initialDetail: StudySetDetail | null;
  initialSubject: string | null;
  missingSet: boolean;
}) {
  const router = useRouter();
  // A returning student wants their sets first (retake, continue); somebody
  // with nothing yet, or arriving from a subject, wants the generator.
  const [stage, setStage] = useState<Stage>(() =>
    initialDetail ? 'set' : initialSubject || sets.length === 0 ? 'configure' : 'library'
  );
  const [doc, setDoc] = useState<StudyDocument | null>(null);
  const [detail, setDetail] = useState<StudySetDetail | null>(initialDetail);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('PRACTICE');
  const [configSubject, setConfigSubject] = useState<string | null>(initialSubject);
  const [busy, setBusy] = useState(false);

  const openSet = useCallback(
    async (setId: string) => {
      setBusy(true);
      const loaded = await getStudySet(setId);
      setBusy(false);
      if (!loaded) {
        toast.error('That set could not be found. It may have been deleted.');
        router.refresh();
        return;
      }
      setDetail(loaded);
      setResult(null);
      setStage('set');
      syncUrl(loaded.id);
    },
    [router]
  );

  const toLibrary = () => {
    setDetail(null);
    setResult(null);
    setStage('library');
    syncUrl(null);
  };

  const toConfigure = (subject: string | null) => {
    setConfigSubject(subject);
    setStage('configure');
    syncUrl(null);
  };

  const startRun = (mode: RunnerMode) => {
    setRunnerMode(mode);
    setResult(null);
    setStage('running');
  };

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
    // Refresh the attempts list behind the results, so "Back to the set"
    // shows this attempt.
    const reloaded = await getStudySet(detail.id);
    if (reloaded) setDetail(reloaded);
  };

  if (stage === 'configure') {
    return (
      <Configure
        key={configSubject ?? ''}
        subjects={subjects}
        initialSubject={configSubject}
        aiReady={aiReady}
        doc={doc}
        setDoc={setDoc}
        onBack={sets.length > 0 ? toLibrary : undefined}
        onGenerating={() => setStage('generating')}
        onDone={async (setId) => {
          setDoc(null);
          await openSet(setId);
          router.refresh();
        }}
        onFailed={() => setStage('configure')}
      />
    );
  }

  if (stage === 'generating') return <Generating doc={doc} />;

  if (stage === 'set' && detail) {
    return (
      <SetOverview
        detail={detail}
        busy={busy}
        onBack={toLibrary}
        onStart={startRun}
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
    );
  }

  if (stage === 'running' && detail) {
    return (
      <Page>
        <PageHeader
          title={detail.title}
          description={
            runnerMode === 'EXAM'
              ? 'Mock exam. Timed, and marked only when you hand it in.'
              : 'Practice. Check each answer as you go.'
          }
        />
        <PageBody>
          <div className="mx-auto w-full max-w-3xl">
            <QuestionRunner
              items={detail.items}
              mode={runnerMode}
              minutes={runnerMode === 'EXAM' ? Math.max(5, detail.items.length * 2) : undefined}
              busy={busy}
              onFinish={finish}
              onQuit={() => setStage('set')}
            />
          </div>
        </PageBody>
      </Page>
    );
  }

  if (stage === 'cards' && detail) {
    return (
      <Page>
        <PageHeader
          title={detail.title}
          description="Flashcards. Show the answer, then grade how well you remembered it."
        />
        <PageBody>
          <div className="mx-auto w-full max-w-2xl">
            <FlashcardRunner
              setId={detail.id}
              cards={detail.cards}
              onDone={async () => {
                await openSet(detail.id);
              }}
            />
          </div>
        </PageBody>
      </Page>
    );
  }

  if (stage === 'results' && result && detail) {
    return (
      <Results
        result={result}
        detail={detail}
        mode={runnerMode}
        onRetake={() => startRun(runnerMode)}
        onSet={() => setStage('set')}
        onNewSet={() => toConfigure(detail.subject)}
        onLibrary={toLibrary}
      />
    );
  }

  return (
    <LibraryView
      sets={sets}
      aiReady={aiReady}
      busy={busy}
      missingSet={missingSet && !detail}
      onNew={() => toConfigure(null)}
      onOpen={openSet}
    />
  );
}

/* ------------------------------------------------------------ shared pieces */

function AiKeyNotice() {
  return (
    <Panel>
      <PanelTitle icon={<KeyRound />}>Add an AI key first</PanelTitle>
      <p className="text-sm text-muted-foreground">
        Writing questions is the one thing here that cannot be done on your device. Google&apos;s
        key is free and takes a minute to set up.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/settings?tab=ai">
          Add a key
          <ChevronRight />
        </Link>
      </Button>
    </Panel>
  );
}

/* ----------------------------------------------------------------- library */

function LibraryView({
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

  const totals = useMemo(() => {
    const taken = sets.filter((s) => s.lastScore !== null);
    const attempts = sets.reduce((sum, s) => sum + s.attempts, 0);
    const average = taken.length
      ? Math.round(taken.reduce((sum, s) => sum + (s.lastScore ?? 0), 0) / taken.length)
      : null;
    return { attempts, average, cards: sets.reduce((sum, s) => sum + s.cardCount, 0) };
  }, [sets]);

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
    <Page>
      <PageHeader
        title="Practice"
        description="Turn a chapter or your notes into questions, then answer them one at a time."
        actions={
          <Button size="lg" onClick={onNew}>
            <Plus />
            New practice set
          </Button>
        }
      />
      <PageBody>
        {missingSet && (
          <ErrorState
            title="That practice set could not be found"
            description="It may have been deleted, or it belongs to a different school year. Your other sets are below."
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Panel>
              <PanelTitle icon={<Library />}>Your practice sets</PanelTitle>
              {sets.length === 0 ? (
                <EmptyState
                  icon={<BookOpenCheck />}
                  title="No practice sets yet"
                  description="Upload a chapter, a handout or your own notes and the questions are written for you."
                  action={
                    <Button onClick={onNew}>
                      <Upload />
                      Upload something
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {sets.map((set) => (
                    <li key={set.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onOpen(set.id)}
                        className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/40 px-5 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-foreground transition-colors group-hover:text-primary">
                            {set.title}
                          </span>
                          <span className="block truncate text-xs font-medium text-muted-foreground">
                            {set.subject} · {set.itemCount} questions
                            {set.cardCount > 0 ? ` · ${set.cardCount} cards` : ''}
                          </span>
                        </span>
                        {set.bestScore !== null ? (
                          <Pill tone={scoreTone(set.bestScore)}>Best {set.bestScore}%</Pill>
                        ) : (
                          <Pill>Not taken</Pill>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-auto w-11 shrink-0 rounded-2xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${set.title}`}
                        onClick={() => setToDelete(set)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6 lg:col-span-4">
            {!aiReady && <AiKeyNotice />}
            {sets.length > 0 && (
              <Panel>
                <PanelTitle icon={<History />}>So far</PanelTitle>
                <div className="grid grid-cols-2 gap-6">
                  <Stat label="Sets" value={sets.length} />
                  <Stat label="Attempts" value={totals.attempts} />
                  <Stat
                    label="Average latest score"
                    value={totals.average !== null ? `${totals.average}%` : '–'}
                    hint={totals.average === null ? 'Take a set to see one' : undefined}
                    tone={totals.average !== null ? scoreTone(totals.average) : 'default'}
                  />
                  <Stat label="Flashcards" value={totals.cards} />
                </div>
              </Panel>
            )}
          </div>
        </div>
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
  );
}

/* --------------------------------------------------------------- configure */

function Configure({
  subjects,
  initialSubject,
  aiReady,
  doc,
  setDoc,
  onBack,
  onGenerating,
  onDone,
  onFailed,
}: {
  subjects: string[];
  initialSubject: string | null;
  aiReady: boolean;
  doc: StudyDocument | null;
  setDoc: (d: StudyDocument | null) => void;
  onBack?: () => void;
  onGenerating: () => void;
  onDone: (setId: string) => Promise<void>;
  onFailed: () => void;
}) {
  // A subject passed in from another page wins; matched case-insensitively
  // against the student's list, and added to it if it is not there.
  const matched = initialSubject
    ? subjects.find((s) => s.toLowerCase() === initialSubject.toLowerCase()) ?? initialSubject
    : null;
  const options = matched && !subjects.includes(matched) ? [matched, ...subjects] : subjects;

  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [subject, setSubject] = useState(matched ?? subjects[0] ?? '');
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
    if (!subject.trim()) {
      toast.error('Pick a subject.');
      return;
    }
    onGenerating();
    const res = await generateStudySet({
      subject: subject.trim(),
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
    <Page>
      <PageHeader
        title="New practice set"
        description="Upload a document, say how many questions and what kind, and they are written for you."
        actions={
          onBack && (
            <Button variant="outline" size="lg" onClick={onBack}>
              <ArrowLeft />
              Your sets
            </Button>
          )
        }
      />
      <PageBody>
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {!aiReady && <AiKeyNotice />}

          <Panel>
            <PanelTitle icon={<FileText />}>What are you studying?</PanelTitle>
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
                  'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/30'
                )}
              >
                {reading ? (
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Reading it…
                  </p>
                ) : (
                  <>
                    <Upload className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-3 font-heading text-lg font-bold">Drop a file here</p>
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
                      aria-label="Choose a file to practise from"
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
              <div className="rounded-2xl border border-border/40 bg-muted/40 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{doc.name}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {doc.image
                        ? 'Image. The AI will read it directly.'
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
                  <p className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                    That is longer than can be used at once. Only the first part will be read. Split
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
          </Panel>

          <Panel className={cn(!doc && 'opacity-60')}>
            <PanelTitle icon={<ListChecks />}>What should it test?</PanelTitle>
            <fieldset disabled={!doc} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="set-subject">Subject</Label>
                  {options.length > 0 ? (
                    <select
                      id="set-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {options.map((s) => (
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
                  <Label htmlFor="set-count">
                    How many questions? <span className="text-primary tabular-nums">{count}</span>
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
                <p id="set-style-label" className="text-sm font-medium">
                  What kind?
                </p>
                <div role="group" aria-labelledby="set-style-label" className="grid gap-3 sm:grid-cols-2">
                  {STYLES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={style === option.id}
                      onClick={() => setStyle(option.id)}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                        style === option.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/60 hover:bg-muted/60'
                      )}
                    >
                      <p className="font-bold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{option.blurb}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="set-focus">
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
            </fieldset>

            <Button
              size="lg"
              className="mt-6 h-12 w-full rounded-xl text-base"
              disabled={!doc || !aiReady}
              onClick={generate}
            >
              <Sparkles />
              Write my {count} questions
            </Button>
          </Panel>
        </div>
      </PageBody>
    </Page>
  );
}

function Generating({ doc }: { doc: StudyDocument | null }) {
  return (
    <Page>
      <PageHeader
        title="Writing your questions"
        description="Longer sets are written in batches, so this can take up to a minute. Keep this tab open."
      />
      <PageBody>
        <Panel className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <p className="font-heading text-lg font-bold" role="status">
            Reading {doc?.name ?? 'your document'}
          </p>
        </Panel>
      </PageBody>
    </Page>
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
  const empty = detail.items.length === 0;

  return (
    <Page>
      <PageHeader
        title={detail.title}
        description={`${detail.items.length} questions${detail.sourceName ? ` from ${detail.sourceName}` : ''}.`}
        meta={
          <Link href={subjectHref(detail.subject)} className="font-medium text-primary hover:underline">
            {detail.subject}
          </Link>
        }
        actions={
          <>
            <Button variant="outline" size="lg" onClick={onBack}>
              <ArrowLeft />
              Your sets
            </Button>
            <Button size="lg" onClick={() => onStart('PRACTICE')} disabled={busy || empty}>
              <BookOpenCheck />
              Start practice
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Panel>
              <PanelTitle icon={<BrainCircuit />}>Choose how to practise</PanelTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <ModeCard
                  title="Practice"
                  blurb="Marked as you go, with an explanation after each question."
                  icon={<BookOpenCheck />}
                  onClick={() => onStart('PRACTICE')}
                  disabled={busy || empty}
                />
                <ModeCard
                  title="Mock exam"
                  blurb="Timed. No feedback at all until you hand it in."
                  icon={<Clock />}
                  onClick={() => onStart('EXAM')}
                  disabled={busy || empty}
                />
                {detail.cards.length > 0 ? (
                  <ModeCard
                    title="Flashcards"
                    blurb={`${detail.cards.length} cards, spaced repetition.`}
                    icon={<Layers />}
                    onClick={onCards}
                    disabled={busy}
                  />
                ) : (
                  <ModeCard
                    title="Make flashcards"
                    blurb="Generate cards from the same material."
                    icon={busy ? <Loader2 className="animate-spin" /> : <Plus />}
                    onClick={onMakeCards}
                    disabled={busy}
                  />
                )}
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-4">
            <Panel>
              <PanelTitle icon={<History />}>Your attempts</PanelTitle>
              {detail.attempts.length === 0 ? (
                <EmptyState
                  title="Not taken yet"
                  description="Your score is saved every time you finish, so you can see it climb."
                  action={
                    <Button onClick={() => onStart('PRACTICE')} disabled={busy || empty}>
                      Start practice
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {detail.attempts.map((a) => (
                    <li key={a.id}>
                      <ListRow
                        title={a.mode === 'EXAM' ? 'Mock exam' : 'Practice'}
                        subtitle={new Date(a.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                        trailing={<Pill tone={scoreTone(a.score)}>{a.score}%</Pill>}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
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
      className="group rounded-2xl border border-border/40 bg-muted/40 p-5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <p className="mt-3 font-heading text-base font-bold transition-colors group-hover:text-primary">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{blurb}</p>
    </button>
  );
}

/* ----------------------------------------------------------------- results */

function Results({
  result,
  detail,
  mode,
  onRetake,
  onSet,
  onNewSet,
  onLibrary,
}: {
  result: AttemptResult;
  detail: StudySetDetail;
  mode: RunnerMode;
  onRetake: () => void;
  onSet: () => void;
  onNewSet: () => void;
  onLibrary: () => void;
}) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const mistakes = result.answers.filter((a) => !a.isCorrect).length;
  const shown = wrongOnly ? result.answers.filter((a) => !a.isCorrect) : result.answers;

  const reviewMistakes = () => {
    setWrongOnly(true);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Page>
      <PageHeader
        title={detail.title}
        description={`${MODE_LABEL[mode]} finished. Your score is saved.`}
        meta={
          <Link href={subjectHref(detail.subject)} className="font-medium text-primary hover:underline">
            {detail.subject}
          </Link>
        }
        actions={
          <>
            <Button variant="outline" size="lg" onClick={onLibrary}>
              <ArrowLeft />
              Your sets
            </Button>
            <Button size="lg" onClick={onRetake}>
              <RotateCcw />
              Retake
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <Panel>
              <Stat
                label="Score"
                value={`${result.score}%`}
                tone={scoreTone(result.score)}
                hint={`${result.correct} of ${result.total} correct${
                  result.xp ? ` · +${result.xp.granted} XP` : ''
                }`}
              />
              {result.xp?.leveledUp && (
                <p className="mt-3 text-sm font-bold text-primary">You levelled up.</p>
              )}
              {result.notice && (
                <p className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                  {result.notice}
                </p>
              )}
            </Panel>

            <Panel>
              <PanelTitle icon={<ArrowRight />}>What next</PanelTitle>
              <div className="flex flex-col gap-2">
                {mistakes > 0 && (
                  <Button variant="outline" className="justify-start" onClick={reviewMistakes}>
                    <ListChecks />
                    Review {mistakes} {mistakes === 1 ? 'mistake' : 'mistakes'}
                  </Button>
                )}
                <Button variant="outline" className="justify-start" onClick={onSet}>
                  <BrainCircuit />
                  Another mode for this set
                </Button>
                <Button variant="outline" className="justify-start" onClick={onNewSet}>
                  <Sparkles />
                  Practice again with new questions
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={subjectHref(detail.subject)}>
                    <Library />
                    Open {detail.subject}
                  </Link>
                </Button>
              </div>
            </Panel>
          </div>

          <div className="scroll-mt-24 lg:col-span-8" ref={listRef}>
            <Panel>
              <PanelTitle
                icon={<ListChecks />}
                action={
                  mistakes > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setWrongOnly((v) => !v)}>
                      {wrongOnly ? 'Show all' : 'Only mistakes'}
                    </Button>
                  )
                }
              >
                {wrongOnly ? 'Your mistakes' : 'Every question'}
              </PanelTitle>

              <ul className="space-y-3">
                {shown.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      'rounded-2xl border px-5 py-4',
                      a.isCorrect ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'
                    )}
                  >
                    <p className="font-bold">{a.question}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">You: </span>
                      {a.given || <span className="italic text-muted-foreground">no answer</span>}
                      {a.score > 0 && a.score < 100 && (
                        <Pill tone="warning" className="ml-2">
                          {a.score}% credit
                        </Pill>
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
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
