'use client';

/**
 * "New practice set": build a set from a document. The choices sit on the
 * left; on the right a live card shows the set being made (its subject's
 * colour and icon, the document, how many questions of what kind, roughly how
 * long it takes), with the one button that writes it. Then Generating shows
 * the steps while the questions are written.
 *
 * Behaviour is unchanged from the old form: the file is read in the browser
 * (readStudyDocument) and only its text or image goes to generateStudySet.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  FileText,
  ImageIcon,
  KeyRound,
  Loader2,
  PenLine,
  Shuffle,
  Sparkles,
  ToggleLeft,
  Upload,
  CircleDot,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SubjectIcon, subjectStyle } from '@/components/subjects/SubjectIcon';
import { cn } from '@/lib/utils';
import { readStudyDocument, type StudyDocument } from '@/lib/file-extract';
import { generateStudySet, type StudyStyle } from '@/lib/study-actions';

const KINDS: {
  id: StudyStyle;
  label: string;
  short: string;
  blurb: string;
  icon: typeof CircleDot;
  minutesEach: number;
  example: React.ReactNode;
}[] = [
  {
    id: 'MULTIPLE_CHOICE',
    label: 'Multiple choice',
    short: 'Choice',
    blurb: 'Pick one, sometimes several',
    icon: CircleDot,
    minutesEach: 1,
    example: (
      <span className="flex gap-1">
        {['A', 'B', 'C', 'D'].map((l, i) => (
          <span key={l} className={cn('grid size-5 place-items-center rounded-md border text-[10px] font-semibold', i === 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{l}</span>
        ))}
      </span>
    ),
  },
  {
    id: 'TRUE_FALSE',
    label: 'True/false and blanks',
    short: 'True/false',
    blurb: 'Quick recall, fast to answer',
    icon: ToggleLeft,
    minutesEach: 0.5,
    example: (
      <span className="flex items-center gap-1 text-[10px] font-semibold">
        <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-success">True</span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-muted-foreground">False</span>
        <span className="ml-1 w-8 border-b-2 border-dashed border-muted-foreground/50" />
      </span>
    ),
  },
  {
    id: 'WRITTEN',
    label: 'Written answers',
    short: 'Written',
    blurb: 'Short and long, marked by AI',
    icon: PenLine,
    minutesEach: 3,
    example: (
      <span className="flex w-20 flex-col gap-1">
        <span className="h-1 w-full rounded-full bg-muted-foreground/40" />
        <span className="h-1 w-4/5 rounded-full bg-muted-foreground/40" />
        <span className="h-1 w-3/5 rounded-full bg-muted-foreground/40" />
      </span>
    ),
  },
  {
    id: 'MIXED',
    label: 'A mix of everything',
    short: 'Mixed',
    blurb: 'All eight types, like a real paper',
    icon: Shuffle,
    minutesEach: 1.5,
    example: (
      <span className="flex gap-1">
        <span className="size-2.5 rounded-full bg-violet-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-sky-400" />
      </span>
    ),
  },
];

const COUNTS = [5, 10, 15, 20, 30, 40];

const FOCUS_IDEAS = [
  'Only the key definitions',
  'Go hard on formulas and calculations',
  'Make it hard, exam level',
  'Start easy, then get harder',
  'Test the examples in the text',
];

function minutesLabel(minutes: number) {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `about ${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `about ${h} h${rest ? ` ${rest} min` : ''}`;
}

function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors',
            done ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function PracticeBuilder({
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
  onGenerating: (subject: string) => void;
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

  const kind = KINDS.find((k) => k.id === style) ?? KINDS[3];
  const look = subjectStyle(subject || 'Practice');
  const ready = !!doc && !!subject.trim() && aiReady;

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
    onGenerating(subject.trim());
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
      toast.warning(`Asked for ${res.requested}, got ${res.generated}. The document may not have enough material for more.`);
    } else {
      toast.success(`${res.generated} questions ready.`);
    }
    await onDone(res.setId);
  };

  const missing = !doc ? 'Add a document first' : !subject.trim() ? 'Pick a subject' : !aiReady ? 'Connect an AI provider first' : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
      <div className="mb-6 space-y-2 md:mb-8">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Your sets
          </button>
        )}
        <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">New practice set</h1>
        <p className="max-w-2xl text-muted-foreground">Give it something to read, choose what to be tested on, and the questions are written for you.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        {/* ------------------------------------------------ the choices */}
        <div className="stagger-in min-w-0 space-y-5">
          {!aiReady && (
            <div className="flex flex-col gap-3 rounded-3xl border border-orange-500/25 bg-orange-500/10 p-5 sm:flex-row sm:items-center">
              <KeyRound className="size-5 shrink-0 text-orange-500" />
              <p className="flex-1 text-sm">
                <span className="font-semibold">Connect an AI provider to write new questions.</span>{' '}
                <span className="text-muted-foreground">Your saved sets and flashcards work without one.</span>
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings?tab=ai">AI settings <ChevronRight /></Link>
              </Button>
            </div>
          )}

          <Step n={1} title="What should it read?" hint="A PDF, Word (.docx), a text file, or a photo of a page." done={!!doc}>
            {!doc ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void take(file);
                }}
                className={cn(
                  'group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/30 hover:border-primary/50'
                )}
              >
                {reading ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" /> Reading it…
                  </p>
                ) : (
                  <>
                    <div className="mb-4 flex items-end gap-2" aria-hidden>
                      <span className="grid size-11 -rotate-6 place-items-center rounded-xl bg-rose-500/15 text-[10px] font-black text-rose-500 transition-transform group-hover:-translate-y-1">PDF</span>
                      <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform group-hover:-translate-y-1.5">
                        <Upload className="size-6" />
                      </span>
                      <span className="grid size-11 rotate-6 place-items-center rounded-xl bg-sky-500/15 text-[10px] font-black text-sky-500 transition-transform group-hover:-translate-y-1">DOCX</span>
                    </div>
                    <p className="font-heading text-lg font-bold">Drop a file here</p>
                    <p className="mt-1 text-sm text-muted-foreground">or pick one from your computer</p>
                    <Button className="mt-4" onClick={() => inputRef.current?.click()}>
                      <Upload /> Choose a file
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
              <div className="flex gap-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
                <span className="grid h-16 w-13 shrink-0 place-items-center rounded-xl border border-border/60 bg-background shadow-sm">
                  {doc.image ? <ImageIcon className="size-6 text-primary" /> : <FileText className="size-6 text-primary" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.image
                          ? 'A photo. It is read as it is.'
                          : `${doc.pageCount ? `${doc.pageCount} pages · ` : ''}${doc.totalChars.toLocaleString()} characters`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDoc(null)}>Change</Button>
                  </div>
                  {doc.text && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{doc.text.slice(0, 300)}…</p>
                  )}
                  {doc.truncated && (
                    <p className="mt-2 rounded-lg bg-orange-500/10 px-2.5 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                      It is longer than can be read at once, so only the first part is used. Split it into two sets to cover all of it.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Step>

          <Step n={2} title="Which subject?" done={!!subject.trim()}>
            {options.length > 0 ? (
              <div role="radiogroup" aria-label="Subject" className="flex flex-wrap gap-2">
                {options.map((s) => {
                  const on = s === subject;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSubject(s)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-medium transition-colors',
                        on ? 'border-foreground bg-foreground text-background' : 'border-border/70 hover:bg-muted'
                      )}
                    >
                      <SubjectIcon name={s} className="size-7 rounded-full" iconClassName="!size-3.5" />
                      {s}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics"
                aria-label="Subject"
                className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            )}
          </Step>

          <Step n={3} title="How many questions?" hint={`${minutesLabel(count * kind.minutesEach)} to answer`} done>
            <div className="flex flex-wrap items-center gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={count === c}
                  onClick={() => setCount(c)}
                  className={cn(
                    'h-11 min-w-14 rounded-xl border px-4 text-base font-semibold tabular-nums transition-colors',
                    count === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 hover:bg-muted'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <input
                type="range"
                min={3}
                max={40}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label="Number of questions"
                className="h-2 flex-1 accent-primary"
              />
              <span className="w-10 text-right font-heading text-2xl font-black tabular-nums">{count}</span>
            </div>
          </Step>

          <Step n={4} title="What kind of questions?" done>
            <div role="radiogroup" aria-label="Question kind" className="grid gap-3 sm:grid-cols-2">
              {KINDS.map((k) => {
                const on = style === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setStyle(k.id)}
                    className={cn(
                      'group flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      on ? 'border-primary bg-primary/[0.07] ring-1 ring-primary' : 'border-border/70 hover:bg-muted/60'
                    )}
                  >
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      <k.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{k.label}</span>
                      <span className="block text-xs text-muted-foreground">{k.blurb}</span>
                      <span className="mt-2.5 block">{k.example}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={5} title="Anything to focus on?" hint="Optional. Tell it what matters, like you would tell a teacher." done={!!focus.trim()}>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. only chapter 3, and go hard on the formulas"
              aria-label="What to focus on"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {FOCUS_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setFocus((f) => (f.trim() ? `${f.trim().replace(/[.,;]$/, '')}. ${idea}` : idea))}
                  className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  + {idea}
                </button>
              ))}
            </div>
          </Step>
        </div>

        {/* ------------------------------------------- the set being made */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
            <div className={cn('relative h-36 overflow-hidden', look.classes.tile, look.classes.ink)}>
              <span aria-hidden className="absolute -left-6 -top-8 size-28 rounded-full bg-white/30 dark:bg-white/5" />
              <span aria-hidden className="absolute -bottom-10 right-6 size-32 rounded-full bg-white/25 dark:bg-white/5" />
              <look.Icon aria-hidden strokeWidth={1.4} className="absolute right-5 top-5 size-20 opacity-90" />
              <div className="absolute bottom-4 left-5 right-28">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Practice set</p>
                <p className="truncate font-heading text-2xl font-black">{subject || 'Pick a subject'}</p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-muted/50 px-2 py-3">
                  <dd className="font-heading text-2xl font-black tabular-nums">{count}</dd>
                  <dt className="text-[11px] text-muted-foreground">questions</dt>
                </div>
                <div className="rounded-2xl bg-muted/50 px-2 py-3">
                  <dd className="grid h-8 place-items-center"><kind.icon className="size-5" /></dd>
                  <dt className="truncate text-[11px] text-muted-foreground">{kind.short}</dt>
                </div>
                <div className="rounded-2xl bg-muted/50 px-2 py-3">
                  <dd className="grid h-8 place-items-center"><Clock className="size-5" /></dd>
                  <dt className="text-[11px] text-muted-foreground">{minutesLabel(count * kind.minutesEach).replace('about ', '~')}</dt>
                </div>
              </dl>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2.5">
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', doc ? 'bg-success text-white' : 'border border-border')}>
                    {doc && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn('min-w-0 truncate', !doc && 'text-muted-foreground')}>{doc ? doc.name : 'No document yet'}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', focus.trim() ? 'bg-success text-white' : 'border border-border')}>
                    {focus.trim() && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn('line-clamp-2 min-w-0', !focus.trim() && 'text-muted-foreground')}>{focus.trim() || 'No special focus'}</span>
                </li>
              </ul>

              <Button size="lg" className="h-12 w-full rounded-2xl text-base" disabled={!ready} onClick={generate}>
                <Sparkles /> Write my {count} questions
              </Button>
              {missing && <p className="text-center text-xs text-muted-foreground">{missing}</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const WRITING_STEPS = ['Reading your document', 'Finding the key ideas', 'Writing the questions', 'Checking the answers'];

/**
 * While the set is written. The server does it in one request, so the steps
 * are paced by time, not reported by it; the wording says so ("usually").
 */
export function PracticeWriting({ doc, subject }: { doc: StudyDocument | null; subject?: string | null }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, WRITING_STEPS.length - 1)), 6000);
    return () => clearInterval(timer);
  }, []);
  const look = subjectStyle(subject || 'Practice');

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto mb-8 size-28">
          <span className={cn('absolute inset-0 rounded-[2rem] motion-safe:animate-ping opacity-30', look.classes.tile)} />
          <span className={cn('relative grid size-28 place-items-center rounded-[2rem] shadow-lg', look.classes.tile, look.classes.ink)}>
            <look.Icon className="size-12" strokeWidth={1.5} />
          </span>
          <span className="absolute -bottom-2 -right-2 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="size-5 motion-safe:animate-pulse" />
          </span>
        </div>
        <h1 className="font-heading text-2xl font-black tracking-tight" role="status">Writing your questions</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">from {doc?.name ?? 'your document'}</p>

        <ol className="mx-auto mt-8 max-w-xs space-y-3 text-left">
          {WRITING_STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                  i < step ? 'bg-success text-white' : i === step ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i === step ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn(i === step ? 'font-semibold' : i < step ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs text-muted-foreground">Usually under a minute. Longer sets are written in batches, so keep this tab open.</p>
      </div>
    </div>
  );
}
