'use client';

/**
 * The conversation the app never had with a new user.
 *
 * Registering created an account and dropped you on a dashboard that assumed you
 * already knew four things nobody had told you: that the year and term are yours
 * to name, that the whole schedule is generated from a recurring week you have
 * to define, that subjects come first because everything hangs off them, and
 * that every AI feature is inert until a key is saved. This asks for all four,
 * in the order they depend on each other, and explains WHY each one matters
 * while it asks.
 *
 * Three rules it sticks to:
 *
 *   Nothing is mandatory. Every step has a way past it, and the wizard is
 *   reachable again from the dashboard checklist and from Settings, because a
 *   person who wants to look around first is not a person to be trapped.
 *
 *   Each step saves on its way out, not at the end. Someone who closes the tab
 *   on step 4 keeps steps 1 to 3, and coming back resumes from the data itself.
 *
 *   It writes through the ordinary actions - the same ones /year, /subjects,
 *   /manage and /settings use. The wizard is a better road to those writes, not
 *   a second set of them.
 */

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Library,
  Loader2,
  Plus,
  Rocket,
  School,
  Sparkles,
  User,
  WifiOff,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadSchoolTimetableDialog } from '@/components/UploadSchoolTimetableDialog';
import { cn } from '@/lib/utils';
import { DAY_NAMES, weekdayOrder } from '@/lib/school';
import type { SetupSnapshot, SetupStepId } from '@/lib/setup';
import { getSetupSnapshot, saveSetupProfile, saveSetupYear } from '@/lib/setup-actions';
import { saveAIKey, saveOllamaConfig, getAIConnectivity } from '@/lib/ai-actions';
import { addSubject } from '@/lib/subject-actions';
import { createTemplate } from '@/lib/actions';

type StepId = SetupStepId | 'welcome' | 'done';

type StepMeta = {
  id: StepId;
  /** Short label for the rail. */
  label: string;
  icon: typeof User;
  /** Whether it counts towards the "x of y" progress. */
  counts: boolean;
};

const STEPS: StepMeta[] = [
  { id: 'welcome', label: 'Start here', icon: Sparkles, counts: false },
  { id: 'profile', label: 'You', icon: User, counts: true },
  { id: 'year', label: 'Year & term', icon: GraduationCap, counts: true },
  { id: 'ai', label: 'AI', icon: BrainCircuit, counts: true },
  { id: 'subjects', label: 'Subjects', icon: Library, counts: true },
  { id: 'school', label: 'School timetable', icon: School, counts: true },
  { id: 'blocks', label: 'Study week', icon: Layers, counts: true },
  { id: 'done', label: 'Finish', icon: Rocket, counts: false },
];

/**
 * The day picker, Monday first.
 *
 * dayOfWeek stays the schema's 0=Sunday - every consumer already reads it that
 * way - but a school week reads Mon-Sun, and a dropdown that opens on Sunday
 * makes people pick the wrong day.
 */
const DAY_OPTIONS = DAY_NAMES.map((name, value) => ({ name, value })).sort(
  (a, b) => weekdayOrder(a.value) - weekdayOrder(b.value)
);

/**
 * Naming conventions differ by country and there is no right answer, so the
 * field is free text and these are only a way to stop someone staring at an
 * empty box wondering what shape of thing is wanted.
 */
const YEAR_SUGGESTIONS = ['Senior 6', 'Form 4', 'Grade 12', 'Year 1', 'Level 300'];
const TERM_SUGGESTIONS = ['Term 1', 'Term 2', 'Semester 1', 'Semester 2'];

/** A starting point for the subject box - tapped, not typed. */
const SUBJECT_SUGGESTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Geography',
  'Computer Science',
  'Economics',
  'Entrepreneurship',
];

function timezoneOptions(): string[] {
  try {
    // Not in every runtime yet; the app must not blank out where it is missing.
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone');
    if (supported?.length) return supported;
  } catch {
    // falls through to the short list
  }
  return [
    'Africa/Kigali',
    'Africa/Nairobi',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Europe/London',
    'Europe/Paris',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Australia/Sydney',
    'UTC',
  ];
}

export function SetupWizard({ initial }: { initial: SetupSnapshot }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState(initial);
  // Deep link: the dashboard checklist links straight at the step that fixes
  // the item you clicked, so nobody has to walk the whole wizard to change one
  // thing. Read once, as the initial value - after that the user's own
  // navigation owns the position, and a stale ?step= must not drag them back.
  const [index, setIndex] = useState(() => {
    const wanted = searchParams.get('step');
    const at = wanted ? STEPS.findIndex((s) => s.id === wanted) : -1;
    return at >= 0 ? at : 0;
  });
  const [isPending, startTransition] = useTransition();

  const step = STEPS[index];

  const refresh = useCallback(async () => {
    const next = await getSetupSnapshot();
    if (next) setSnapshot(next);
  }, []);

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
    // Each step is its own screen; landing halfway down the previous one is
    // disorienting on a short window.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const back = useCallback(() => goTo(index - 1), [goTo, index]);

  /**
   * Leave the wizard - by skipping out of it or by finishing it.
   *
   * Deliberately writes NOTHING. Leaving is not "stop asking me": whatever was
   * skipped shows up on the dashboard checklist, which is the entire point of
   * letting people skip. Only the checklist's own dismiss button records that,
   * and the checklist disappears by itself once nothing is outstanding - so
   * somebody who answers everything here never sees it at all.
   */
  const leave = useCallback(
    (destination: string) => {
      startTransition(() => {
        router.push(destination);
        router.refresh();
      });
    },
    [router]
  );

  const counted = STEPS.filter((s) => s.counts);
  const countedIndex = counted.findIndex((s) => s.id === step.id);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Rail: where you are, and how much is left. Hidden on small screens,
          where the progress bar in the header carries the same information. */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col justify-between border-r border-border/60 bg-muted/20 p-8">
        <div>
          <div className="flex items-center gap-2.5 font-heading text-lg font-black">
            <div className="rounded-xl bg-foreground p-1.5 text-background">
              <BrainCircuit className="h-4 w-4" />
            </div>
            StudyFlow
          </div>

          <nav className="mt-10 space-y-1" aria-label="Setup steps">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isCurrent = i === index;
              const isPast = i < index;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                    isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border',
                      isCurrent
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : isPast
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                          : 'border-border/60 text-muted-foreground/70'
                    )}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Nothing here is permanent. Every answer can be changed later from Settings, and you
          can leave at any point.
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-4 md:px-10">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Setting up
            </p>
            <p className="truncate text-sm font-bold">
              {countedIndex >= 0
                ? `Step ${countedIndex + 1} of ${counted.length} · ${step.label}`
                : step.label}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => leave('/')}
            className="shrink-0"
          >
            Skip setup
            <X className="h-3.5 w-3.5" />
          </Button>
        </header>

        {/* Progress. The only thing on screen on mobile that says how long this
            is going to take, so it is not decoration. */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${(index / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
          <div className="mx-auto w-full max-w-3xl">
            {step.id === 'welcome' && <WelcomeStep snapshot={snapshot} onNext={next} />}
            {step.id === 'profile' && (
              <ProfileStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'year' && (
              <YearStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'ai' && (
              <AiStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'subjects' && (
              <SubjectsStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'school' && (
              <SchoolStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'blocks' && (
              <BlocksStep snapshot={snapshot} onSaved={refresh} onNext={next} onBack={back} />
            )}
            {step.id === 'done' && (
              <DoneStep snapshot={snapshot} onFinish={leave} isPending={isPending} onBack={back} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function StepHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-heading text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
      <div className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </header>
  );
}

function StepFooter({
  onBack,
  onNext,
  nextLabel = 'Continue',
  busy = false,
  skip,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  /** Present on every optional step. Its absence is what makes a step required. */
  skip?: { label: string; onSkip: () => void };
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
      {onBack && (
        <Button variant="ghost" size="lg" onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}
      <div className="flex-1" />
      {skip && (
        <Button variant="ghost" size="lg" onClick={skip.onSkip} disabled={busy}>
          {skip.label}
        </Button>
      )}
      <Button size="lg" onClick={onNext} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {nextLabel}
        {!busy && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}

/** A short "why this matters" note. Used everywhere a step asks for something. */
function Why({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-bold">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Chips({
  options,
  onPick,
}: {
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- steps */

function WelcomeStep({ snapshot, onNext }: { snapshot: SetupSnapshot; onNext: () => void }) {
  const returning = snapshot.setupCompletedAt !== null;

  return (
    <div>
      <StepHeader eyebrow={returning ? 'Setup' : 'Welcome'} title={returning ? 'Change your setup' : `Welcome, ${snapshot.name}`}>
        {returning ? (
          <>Everything you set up the first time, in one place. Change what has moved on and leave the rest alone.</>
        ) : (
          <>
            Six short questions and your account actually works. Most of them take one line, two
            are optional, and you can stop at any point — nothing here locks you out of the app.
          </>
        )}
      </StepHeader>

      <ul className="space-y-3">
        {[
          { icon: User, text: 'What to call you, and which timezone your day runs in.' },
          { icon: GraduationCap, text: 'The year you are in and when this term ends.' },
          { icon: BrainCircuit, text: 'A key to switch on the AI tutor, notes and photo reading — or a local model, offline.' },
          { icon: Library, text: 'Your subjects. Homework, exams and marks all hang off these.' },
          { icon: School, text: 'Your school timetable, read straight off a photo. Optional.' },
          { icon: Layers, text: 'Your recurring study week — the engine that fills in every day for you.' },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="leading-relaxed text-muted-foreground">{text}</span>
          </li>
        ))}
      </ul>

      <StepFooter onNext={onNext} nextLabel="Let's go" />
    </div>
  );
}

function ProfileStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(snapshot.name);
  const [timezone, setTimezone] = useState(snapshot.timezone);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => timezoneOptions(), []);

  // Offered, never imposed: the browser's guess is right almost always, and
  // wrong loudly enough to matter when a student travels or uses a VPN.
  const detected = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }, []);

  const now = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      return null;
    }
  }, [timezone]);

  const save = async () => {
    setBusy(true);
    const res = await saveSetupProfile({ name, timezone });
    setBusy(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    await onSaved();
    onNext();
  };

  return (
    <div>
      <StepHeader eyebrow="Step 1" title="First, the basics">
        Your name is only used to greet you. The timezone is the one that really matters — it
        decides which calendar day a task belongs to.
      </StepHeader>

      <div className="space-y-6">
        <Field label="What should the app call you?" htmlFor="setup-name">
          <Input
            id="setup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="h-12 rounded-xl px-4 text-base"
            placeholder="Your first name"
          />
        </Field>

        <Field
          label="Your timezone"
          htmlFor="setup-tz"
          hint={now ? `It is currently ${now} there.` : undefined}
        >
          <select
            id="setup-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {/* The stored zone may be absent from a trimmed runtime list. */}
            {!zones.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>

        {detected && detected !== timezone && (
          <button
            type="button"
            onClick={() => setTimezone(detected)}
            className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            <Clock className="h-4 w-4" />
            Use {detected.replace(/_/g, ' ')} — the timezone this device is in
          </button>
        )}

        <Why>
          Get this wrong and everything still works, just on the wrong day: a block you finish at
          11pm can land on tomorrow, and the streak can break while you are studying.
        </Why>
      </div>

      <StepFooter onBack={onBack} onNext={save} busy={busy} />
    </div>
  );
}

function YearStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [label, setLabel] = useState(snapshot.classLabel ?? '');
  const [termName, setTermName] = useState(snapshot.termName ?? 'Term 1');
  const [startDate, setStartDate] = useState(snapshot.termStartDate ?? '');
  const [endDate, setEndDate] = useState(snapshot.termEndDate ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await saveSetupYear({ label, termName, startDate, endDate });
    setBusy(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    if (res?.warning) toast.warning(res.warning, { duration: 8000 });
    await onSaved();
    onNext();
  };

  return (
    <div>
      <StepHeader eyebrow="Step 2" title="Which year are you in?">
        The app groups everything you do into an academic year and the terms inside it. When a year
        ends you archive it and start the next one clean — last year&apos;s work stays readable, it
        just stops cluttering today.
      </StepHeader>

      <div className="space-y-6">
        <Field
          label="Name this academic year"
          htmlFor="setup-year"
          hint="Whatever you actually call it. It appears on your dashboard."
        >
          <Input
            id="setup-year"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            className="h-12 rounded-xl px-4 text-base"
            placeholder="e.g. Senior 6"
          />
          <div className="pt-1">
            <Chips options={YEAR_SUGGESTIONS} onPick={setLabel} />
          </div>
        </Field>

        <Field label="What is this term called?" htmlFor="setup-term">
          <Input
            id="setup-term"
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            maxLength={60}
            className="h-12 rounded-xl px-4 text-base"
            placeholder="Term 1"
          />
          <div className="pt-1">
            <Chips options={TERM_SUGGESTIONS} onPick={setTermName} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Term starts (optional)" htmlFor="setup-start">
            <Input
              id="setup-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 rounded-xl px-4 text-base"
            />
          </Field>
          <Field label="Term ends (optional)" htmlFor="setup-end">
            <Input
              id="setup-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-12 rounded-xl px-4 text-base"
            />
          </Field>
        </div>

        <Why>
          Dates only ever prompt you — nothing starts or ends on its own. With an end date the app
          offers to close the term when it arrives; without one the term simply runs until you say
          otherwise. A start date in the future pauses the schedule until it comes round.
        </Why>
      </div>

      <StepFooter onBack={onBack} onNext={save} busy={busy} />
    </div>
  );
}

function AiStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const configured = snapshot.ai.gemini || snapshot.ai.openai || snapshot.ai.ollama;

  const saveKey = async () => {
    if (!key.trim()) {
      toast.error('Paste your key first.');
      return;
    }
    setBusy(true);
    // Validated against the provider before it is stored, so a typo is caught
    // here rather than three pages later when the tutor mysteriously fails.
    const res = await saveAIKey(key.trim());
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || 'That key did not work.');
      return;
    }
    setKey('');
    toast.success(`${res.provider} connected.`);
    await onSaved();
  };

  const useOllama = async () => {
    setProbing(true);
    await saveOllamaConfig({ enabled: true });
    const info = await getAIConnectivity();
    setProbing(false);
    if (!info.ollamaReachable) {
      toast.error('No local model answered on http://localhost:11434. Start Ollama, then try again.');
      return;
    }
    toast.success(`Offline model ready (${info.ollamaModels.slice(0, 3).join(', ')}).`);
    await onSaved();
  };

  return (
    <div>
      <StepHeader eyebrow="Step 3" title="Switch on the AI">
        The tutor, the quiz generator, the note summariser and the trick where you photograph a
        timetable and it reads it — all of them need a key. Google&apos;s is free and takes about a
        minute to get.
      </StepHeader>

      {configured && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          AI is on
          {snapshot.ai.gemini && ' · Gemini key saved'}
          {snapshot.ai.openai && ' · OpenAI key saved'}
          {snapshot.ai.ollama && ' · offline model enabled'}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-heading text-lg font-black">Get a free Gemini key</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-bold text-foreground">1.</span> Open{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                aistudio.google.com/app/apikey
                <ExternalLink className="h-3 w-3" />
              </a>{' '}
              and sign in with any Google account.
            </li>
            <li>
              <span className="font-bold text-foreground">2.</span> Click{' '}
              <span className="font-semibold text-foreground">Create API key</span>. No card, no
              billing setup.
            </li>
            <li>
              <span className="font-bold text-foreground">3.</span> Copy the key it shows you and
              paste it below. An OpenAI key works here too — the box works out which is which.
            </li>
          </ol>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input
              id="setup-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveKey();
              }}
              placeholder={
                snapshot.ai.gemini || snapshot.ai.openai
                  ? 'A key is already saved — paste a new one to replace it'
                  : 'Paste your API key'
              }
              className="h-12 flex-1 rounded-xl px-4 text-base"
            />
            <Button size="lg" className="h-12" onClick={saveKey} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save key
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The key is stored on this machine and is never sent anywhere except the provider you
            got it from. It is deliberately left out of sync, so it does not travel to your other
            devices.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-black">
            <WifiOff className="h-4 w-4" />
            No internet? Run a model locally
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Install <span className="font-semibold text-foreground">Ollama</span>, pull a model
            (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">ollama pull llama3.1</code>),
            and the app will use it whenever the internet is not there. Everything stays on your
            machine.
          </p>
          <Button variant="outline" size="lg" className="mt-4 h-11" onClick={useOllama} disabled={probing}>
            {probing ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
            Check for a local model
          </Button>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        skip={configured ? undefined : { label: 'Skip — no AI for now', onSkip: onNext }}
        nextLabel={configured ? 'Continue' : 'Continue anyway'}
      />
    </div>
  );
}

function SubjectsStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(snapshot.subjects);

  const add = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (subjects.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} is already on the list.`);
      return;
    }
    setBusy(true);
    try {
      await addSubject(name);
      setSubjects((current) => [...current, name].sort((a, b) => a.localeCompare(b)));
      setDraft('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That subject could not be added.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <StepHeader eyebrow="Step 4" title="What do you study?">
        Add every subject you take this year. Homework, exams, marks, revision blocks and the AI
        tutor all attach to a subject — until one exists, those forms have nothing to offer you.
      </StepHeader>

      <div className="space-y-6">
        <Field label="Add a subject" htmlFor="setup-subject" hint="Press Enter after each one.">
          <div className="flex gap-3">
            <Input
              id="setup-subject"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add(draft);
                }
              }}
              placeholder="e.g. Physics"
              className="h-12 flex-1 rounded-xl px-4 text-base"
            />
            <Button size="lg" className="h-12" onClick={() => add(draft)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Common ones
          </p>
          <Chips
            options={SUBJECT_SUGGESTIONS.filter(
              (s) => !subjects.some((existing) => existing.toLowerCase() === s.toLowerCase())
            )}
            onPick={(value) => void add(value)}
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your subjects ({subjects.length})
          </p>
          {subjects.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing yet. Add at least one — you can add the rest later from the Subjects page.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <li
                  key={subject}
                  className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
                >
                  <Check className="h-3.5 w-3.5" />
                  {subject}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={async () => {
          await onSaved();
          onNext();
        }}
        skip={subjects.length === 0 ? { label: 'Skip for now', onSkip: onNext } : undefined}
      />
    </div>
  );
}

function SchoolStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasAI = snapshot.ai.gemini || snapshot.ai.openai || snapshot.ai.ollama;

  return (
    <div>
      <StepHeader eyebrow="Step 5 · optional" title="Your school day">
        This is the timetable of lessons you attend — not your study plan. With it, the dashboard
        knows when you are in class and stops suggesting you study through Chemistry.
      </StepHeader>

      <div className="space-y-6">
        {snapshot.schoolLessonCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {snapshot.schoolLessonCount} lessons saved. Uploading again replaces them.
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-heading text-lg font-black">Photograph it</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Take a picture of the timetable on the wall, or upload the PDF the school sent. It gets
            read into a list you can correct — nothing is saved until you press the button at the
            bottom of that list.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-11"
              onClick={() => setOpen(true)}
              disabled={!hasAI}
            >
              <School className="h-4 w-4" />
              Upload a photo or PDF
            </Button>
            <Button variant="outline" size="lg" className="h-11" asChild>
              <Link href="/school-timetable" target="_blank">
                Add lessons by hand
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {!hasAI && (
            <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
              Reading a photo needs the AI, which is not switched on yet. Go back a step to add a
              key, or add the lessons by hand.
            </p>
          )}
        </div>

        <Why>
          Skipping this costs you nothing except the &ldquo;you are in Physics right now&rdquo;
          awareness on your dashboard. You can do it any time from Settings → School Timetable.
        </Why>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        skip={{ label: 'Skip — no school timetable', onSkip: onNext }}
      />

      {open && (
        <UploadSchoolTimetableDialog
          existingCount={snapshot.schoolLessonCount}
          onClose={() => {
            setOpen(false);
            void onSaved();
          }}
        />
      )}
    </div>
  );
}

function BlocksStep({
  snapshot,
  onSaved,
  onNext,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onSaved: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [subject, setSubject] = useState(snapshot.subjects[0] ?? '');
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:00');
  const [type, setType] = useState('HOMEWORK');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<
    { dayOfWeek: number; subject: string; startTime: string; endTime: string; type: string }[]
  >([]);

  const total = snapshot.templateCount + added.length;

  const add = async () => {
    if (!subject.trim()) {
      toast.error('Pick a subject first.');
      return;
    }
    if (endTime <= startTime) {
      toast.error('A block has to end after it starts.');
      return;
    }
    const day = Number(dayOfWeek);
    setBusy(true);
    await createTemplate({
      dayOfWeek: day,
      subject: subject.trim(),
      startTime,
      endTime,
      // The day it is due, which for a block you sit down to do is that same
      // day far more often than not. /manage is where anyone who needs
      // something else changes it.
      deadlineDay: DAY_NAMES[day],
      type,
    });
    setBusy(false);
    setAdded((current) => [...current, { dayOfWeek: day, subject: subject.trim(), startTime, endTime, type }]);
    toast.success(`${subject} added to ${DAY_NAMES[day]}.`);
  };

  return (
    <div>
      <StepHeader eyebrow="Step 6" title="Your study week">
        This is the engine. You describe one ordinary week — &ldquo;Physics, Wednesdays, 7 to
        9&rdquo; — and every day the app writes that day&apos;s tasks for you from it. It is why
        you never plan the same week twice.
      </StepHeader>

      <div className="space-y-6">
        {snapshot.subjects.length === 0 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
            You have no subjects yet, so there is nothing to schedule. Go back a step and add one,
            or skip this and set your week up later.
          </p>
        )}

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day" htmlFor="block-day">
              <select
                id="block-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {DAY_OPTIONS.map((day) => (
                  <option key={day.name} value={String(day.value)}>
                    {day.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subject" htmlFor="block-subject">
              <select
                id="block-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-transparent px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Choose a subject</option>
                {snapshot.subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Starts" htmlFor="block-start">
              <Input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-12 rounded-xl px-4 text-base"
              />
            </Field>

            <Field label="Ends" htmlFor="block-end">
              <Input
                id="block-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-12 rounded-xl px-4 text-base"
              />
            </Field>
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-sm font-bold">What kind of block?</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: 'HOMEWORK', title: 'Homework', body: 'Work that is due — shown with a solid blue edge.' },
                { value: 'REVISION', title: 'Revision', body: 'Going back over material — a dashed orange edge.' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    type === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:bg-muted/50'
                  )}
                >
                  <p className="font-bold">{option.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.body}</p>
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" className="mt-5 h-11 w-full" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add this block
          </Button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Blocks in your week ({total})
          </p>
          {added.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {snapshot.templateCount > 0
                ? `You already have ${snapshot.templateCount}. Anything you add here joins them.`
                : 'Nothing yet. Two or three is enough to start — the Weekly Timetable page is where you build out the rest.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {added.map((block, i) => (
                <li
                  key={`${block.subject}-${block.dayOfWeek}-${block.startTime}-${i}`}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border-l-4 bg-card px-4 py-2.5 text-sm',
                    block.type === 'HOMEWORK'
                      ? 'border-l-blue-500 border-y border-r border-border/60'
                      : 'border-l-orange-500 border-y border-r border-dashed border-border/60'
                  )}
                >
                  <span className="font-bold">{block.subject}</span>
                  <span className="text-muted-foreground">
                    {DAY_NAMES[block.dayOfWeek]} · {block.startTime}–{block.endTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={async () => {
          await onSaved();
          onNext();
        }}
        skip={total === 0 ? { label: 'Skip for now', onSkip: onNext } : undefined}
      />
    </div>
  );
}

function DoneStep({
  snapshot,
  onFinish,
  isPending,
  onBack,
}: {
  snapshot: SetupSnapshot;
  onFinish: (destination: string) => void;
  isPending: boolean;
  onBack: () => void;
}) {
  const rows = [
    { label: 'Year', value: snapshot.classLabel ?? '—', ok: Boolean(snapshot.classLabel) },
    { label: 'Term', value: snapshot.termName ?? '—', ok: Boolean(snapshot.termName) },
    {
      label: 'Term dates',
      value:
        snapshot.termStartDate && snapshot.termEndDate
          ? `${snapshot.termStartDate} → ${snapshot.termEndDate}`
          : 'Not set (optional)',
      ok: Boolean(snapshot.termStartDate && snapshot.termEndDate),
    },
    {
      label: 'AI',
      value: snapshot.ai.gemini
        ? 'Gemini key saved'
        : snapshot.ai.openai
          ? 'OpenAI key saved'
          : snapshot.ai.ollama
            ? 'Offline model'
            : 'Not set up',
      ok: snapshot.ai.gemini || snapshot.ai.openai || snapshot.ai.ollama,
    },
    {
      label: 'Subjects',
      value: snapshot.subjects.length ? `${snapshot.subjects.length} added` : 'None yet',
      ok: snapshot.subjects.length > 0,
    },
    {
      label: 'School timetable',
      value: snapshot.schoolLessonCount
        ? `${snapshot.schoolLessonCount} lessons`
        : 'Not imported (optional)',
      ok: snapshot.schoolLessonCount > 0,
    },
    {
      label: 'Study week',
      value: snapshot.templateCount ? `${snapshot.templateCount} blocks` : 'None yet',
      ok: snapshot.templateCount > 0,
    },
  ];

  const outstanding = rows.filter((r) => !r.ok).length;

  return (
    <div>
      <StepHeader eyebrow="Done" title="That is the setup">
        {outstanding === 0 ? (
          <>Everything is in place. The tour is next — it walks you through the actual pages, so
          you can see where all of this lives.</>
        ) : (
          <>Here is where you stand. Anything unfinished stays on a checklist on your dashboard —
          it will not get lost, and nothing is blocked in the meantime.</>
        )}
      </StepHeader>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="flex items-center gap-3 text-sm font-bold">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-lg',
                  row.ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'
                )}
              >
                {row.ok ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              {row.label}
            </span>
            <span className="truncate text-sm text-muted-foreground">{row.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <h2 className="flex items-center gap-2 font-heading text-lg font-black">
          <Rocket className="h-4 w-4 text-primary" />
          Take the tour next
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It moves through the real pages with you — the dashboard, your weekly timetable, subjects,
          progress and the AI — and points at the thing it is talking about. Two or three minutes,
          and you can leave it at any point.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
        <Button variant="ghost" size="lg" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="lg" onClick={() => onFinish('/')} disabled={isPending}>
          Just take me in
        </Button>
        <Button size="lg" onClick={() => onFinish('/?tour=1')} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Start the tour
        </Button>
      </div>
    </div>
  );
}
