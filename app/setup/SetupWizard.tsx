'use client';

/**
 * First-run setup: the conversation the app never had with a new user.
 *
 * Three rules it sticks to:
 *
 *   Nothing is mandatory. Every step has a way past it, and the wizard is
 *   reachable again from the dashboard checklist and from Settings.
 *
 *   Each step saves on its way out, not at the end. Someone who closes the tab
 *   on step 4 keeps steps 1 to 3, and coming back resumes from the data itself.
 *
 *   It writes through the ordinary actions - the same ones /year, /subjects,
 *   /manage and /settings use. The wizard is a better road to those writes, not
 *   a second set of them.
 *
 * Layout: the step on the left, a live preview of the workspace on the right
 * that fills in as the person answers (WorkspacePreview).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BrainCircuit, Sparkles, Trash2, Check, CheckCircle2, Clock, ExternalLink, GraduationCap,
  Layers, Library, Loader2, Plus, Rocket, School, User, WifiOff, X,
} from 'lucide-react';

import { Brand } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { UploadSchoolTimetableDialog } from '@/components/UploadSchoolTimetableDialog';
import { cn } from '@/lib/utils';
import { DAY_NAMES, weekdayOrder } from '@/lib/school';
import type { SetupSnapshot, SetupStepId } from '@/lib/setup';
import { getSetupSnapshot, saveSetupProfile, saveSetupYear } from '@/lib/setup-actions';
import { saveAIKey, saveOllamaConfig, testAIConnection, type AIConnectionTest } from '@/lib/ai-actions';
import { addSubject } from '@/lib/subject-actions';
import { createTemplate } from '@/lib/actions';
import { createSchoolLesson } from '@/lib/school-actions';
import { generateStudyWeek } from '@/lib/study-plan-actions';
import type { PlanBlock } from '@/lib/study-plan';
import { WorkspacePreview, type PreviewFocus } from './WorkspacePreview';
import styles from './Setup.module.css';

type StepId = SetupStepId | 'welcome' | 'done';

const STEPS: { id: StepId; label: string; icon: typeof User; focus: PreviewFocus }[] = [
  { id: 'welcome', label: 'Start', icon: Rocket, focus: 'all' },
  { id: 'profile', label: 'You', icon: User, focus: 'greeting' },
  { id: 'year', label: 'Year & term', icon: GraduationCap, focus: 'year' },
  { id: 'ai', label: 'Study assistant', icon: BrainCircuit, focus: 'ai' },
  { id: 'school', label: 'School timetable', icon: School, focus: 'school' },
  { id: 'subjects', label: 'Subjects', icon: Library, focus: 'subjects' },
  { id: 'blocks', label: 'Study week', icon: Layers, focus: 'week' },
  { id: 'done', label: 'Finish', icon: Check, focus: 'all' },
];
const COUNTED = STEPS.filter((s) => s.id !== 'welcome' && s.id !== 'done');

/** Monday first; dayOfWeek stays the schema's 0 = Sunday. */
const DAY_OPTIONS = DAY_NAMES.map((name, value) => ({ name, value })).sort((a, b) => weekdayOrder(a.value) - weekdayOrder(b.value));

const YEAR_SUGGESTIONS = ['Senior 6', 'Form 4', 'Grade 12', 'Year 1', 'Level 300'];
const TERM_SUGGESTIONS = ['Term 1', 'Term 2', 'Semester 1', 'Semester 2'];
const SUBJECT_SUGGESTIONS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science', 'Economics', 'Entrepreneurship'];

function timezoneOptions(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (supported?.length) return supported;
  } catch { /* short list below */ }
  return ['Africa/Kigali', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];
}

/** What the person is typing but has not saved yet, for the preview. */
type Draft = Partial<{ name: string; timezone: string; classLabel: string; termName: string; termEndDate: string; aiOn: boolean; proposed: PlanBlock[] }>;

type StepProps = { snapshot: SetupSnapshot; onSaved: () => Promise<void>; onNext: () => void; onBack: () => void; onDraft: (d: Draft) => void };

export function SetupWizard({ initial }: { initial: SetupSnapshot }) {
  const reduced = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState(initial);
  const [draft, setDraft] = useState<Draft>({});
  // Deep link (?step=) from the dashboard checklist, read once.
  const [index, setIndex] = useState(() => {
    const wanted = searchParams.get('step');
    const at = wanted ? STEPS.findIndex((s) => s.id === wanted) : -1;
    return at >= 0 ? at : 0;
  });
  const [direction, setDirection] = useState(1);
  const [isPending, startTransition] = useTransition();
  const step = STEPS[index];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    bodyRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    // Keep the step in the address bar, so a reload (or coming back after a
    // long upload) resumes on the same step instead of starting over. Through
    // the router, not history.replaceState: Next puts its own URL back after
    // every server action, which silently dropped a hand-written ?step=.
    const id = STEPS[index].id;
    const target = id === 'welcome' ? '/setup' : `/setup?step=${id}`;
    if (`${window.location.pathname}${window.location.search}` !== target) router.replace(target, { scroll: false });
  }, [index, router]);

  const refresh = useCallback(async () => {
    const next = await getSetupSnapshot();
    if (next) setSnapshot(next);
  }, []);
  const onDraft = useCallback((d: Draft) => setDraft((current) => ({ ...current, ...d })), []);

  const goTo = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, target));
    setDirection(clamped >= index ? 1 : -1);
    setIndex(clamped);
  }, [index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const back = useCallback(() => goTo(index - 1), [goTo, index]);

  /** Leaving writes nothing: whatever was skipped stays on the dashboard checklist. */
  const leave = useCallback((destination: string) => {
    startTransition(() => { router.push(destination); router.refresh(); });
  }, [router]);

  const preview = {
    name: draft.name ?? snapshot.name,
    timezone: draft.timezone ?? snapshot.timezone,
    classLabel: draft.classLabel ?? snapshot.classLabel ?? '',
    termName: draft.termName ?? snapshot.termName ?? '',
    termEndDate: draft.termEndDate ?? snapshot.termEndDate ?? '',
    aiOn: draft.aiOn ?? (snapshot.ai.gemini || snapshot.ai.openai),
    subjects: snapshot.subjects,
    schoolLessonCount: snapshot.schoolLessonCount,
    blocks: [...snapshot.templates, ...(draft.proposed ?? [])],
    proposedCount: draft.proposed?.length ?? 0,
  };

  const countedIndex = COUNTED.findIndex((s) => s.id === step.id);
  const props: StepProps = { snapshot, onSaved: refresh, onNext: next, onBack: back, onDraft };
  const motionProps = reduced ? {} : {
    initial: { opacity: 0, x: 32 * direction },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -32 * direction },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Brand />
        <nav aria-label="Setup steps" className={styles.stepsNav}>
          <ol>
            {COUNTED.map((s) => {
              const at = STEPS.findIndex((x) => x.id === s.id);
              const state = at < index ? 'past' : at === index ? 'current' : 'future';
              return <li key={s.id}>
                <button type="button" onClick={() => goTo(at)} aria-current={state === 'current' ? 'step' : undefined} aria-label={s.label} title={s.label} data-state={state}>
                  <span className={styles.segment}><motion.span className={styles.segmentFill} initial={false} animate={{ scaleX: state === 'future' ? 0 : 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} /></span>
                  <span className={styles.segmentLabel}>{s.label}</span>
                </button>
              </li>;
            })}
          </ol>
        </nav>
        <Button variant="ghost" disabled={isPending} onClick={() => leave('/')} className="h-10 shrink-0 rounded-xl">Finish later<X className="size-4" /></Button>
      </header>

      <div className={styles.split}>
        <main className={styles.body} ref={bodyRef}>
          <div className={styles.canvas}>
            {countedIndex >= 0 && <p className={styles.eyebrow}>Step {countedIndex + 1} of {COUNTED.length}</p>}
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div key={step.id} {...motionProps}>
                {step.id === 'welcome' && <WelcomeStep snapshot={snapshot} onNext={next} />}
                {step.id === 'profile' && <ProfileStep {...props} />}
                {step.id === 'year' && <YearStep {...props} />}
                {step.id === 'ai' && <AiStep {...props} />}
                {step.id === 'subjects' && <SubjectsStep {...props} />}
                {step.id === 'school' && <SchoolStep {...props} />}
                {step.id === 'blocks' && <BlocksStep {...props} />}
                {step.id === 'done' && <DoneStep snapshot={snapshot} aiOn={draft.aiOn} onFinish={leave} isPending={isPending} onBack={back} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <aside className={styles.previewSide}>
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.dots} aria-hidden="true" />
          <WorkspacePreview data={preview} focus={step.focus} />
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function StepHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return <header className={styles.stepHeader}>
    <h1 tabIndex={-1}>{title}</h1>
    {children && <p>{children}</p>}
  </header>;
}

function StepFooter({ onBack, onNext, nextLabel = 'Continue', busy = false, skip }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; busy?: boolean;
  /** Present on every optional step. */
  skip?: { label: string; onSkip: () => void };
}) {
  return <div className={styles.footer}>
    {onBack && <Button variant="outline" onClick={onBack} disabled={busy} className={styles.btnSecondary}><ArrowLeft className="size-4" />Back</Button>}
    <div className="flex-1" />
    {skip && <Button variant="ghost" onClick={skip.onSkip} disabled={busy} className={styles.btnGhost}>{skip.label}</Button>}
    <Button onClick={onNext} disabled={busy} className={styles.btnPrimary}>
      {busy && <Loader2 className="size-4 animate-spin" />}{nextLabel}{!busy && <ArrowRight className="size-4" />}
    </Button>
  </div>;
}

function Why({ children }: { children: React.ReactNode }) {
  return <p className={styles.why}>{children}</p>;
}

function Field({ label, htmlFor, hint, optional, children }: { label: string; htmlFor: string; hint?: React.ReactNode; optional?: boolean; children: React.ReactNode }) {
  return <div className={styles.field}>
    <label htmlFor={htmlFor}>{label}{optional && <span> (optional)</span>}</label>
    {children}
    {hint && <small>{hint}</small>}
  </div>;
}

function Chips({ options, onPick, selected }: { options: string[]; onPick: (value: string) => void; selected?: string }) {
  return <div className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option} type="button" onClick={() => onPick(option)} aria-pressed={selected === option}
      className={cn(styles.chip, selected === option && styles.chipOn)}>{option}</button>)}
  </div>;
}

function Done({ children }: { children: React.ReactNode }) {
  return <p className={styles.ok}><CheckCircle2 className="size-4 shrink-0" />{children}</p>;
}

/* ----------------------------------------------------------------- steps */

function WelcomeStep({ snapshot, onNext }: { snapshot: SetupSnapshot; onNext: () => void }) {
  const returning = snapshot.setupCompletedAt !== null;
  const items = [
    { icon: User, title: 'You', text: 'Your name and timezone' },
    { icon: GraduationCap, title: 'Year & term', text: 'What you call this year, and its dates' },
    { icon: BrainCircuit, title: 'Study assistant', text: 'Optional AI for quizzes and help' },
    { icon: School, title: 'School timetable', text: 'A photo is enough; your subjects come from it' },
    { icon: Library, title: 'Subjects', text: 'Check them and add anything missing' },
    { icon: Layers, title: 'Study week', text: 'The blocks you repeat every week' },
  ];
  return <div>
    <p className={styles.eyebrow}>{returning ? 'Setup' : 'About 3 minutes'}</p>
    <StepHeader title={returning ? 'Change your setup' : `Welcome, ${snapshot.name.split(' ')[0]}`}>
      {returning
        ? 'Everything you set up the first time, in one place. Change what has moved on and leave the rest.'
        : 'Let’s set up your workspace around your real school week. Each step saves as you go, and you can skip anything.'}
    </StepHeader>
    <ol className={styles.welcomeList}>
      {items.map(({ icon: Icon, title, text }, i) => <motion.li key={title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.4 }}>
        <span className={styles.welcomeIcon}><Icon className="size-4" /></span>
        <span><strong>{title}</strong>{text}</span>
        <span className={styles.welcomeNum}>{i + 1}</span>
      </motion.li>)}
    </ol>
    <StepFooter onNext={onNext} nextLabel={returning ? 'Start' : 'Let’s go'} />
  </div>;
}

function ProfileStep({ snapshot, onSaved, onNext, onBack, onDraft }: StepProps) {
  const [name, setName] = useState(snapshot.name);
  const [timezone, setTimezone] = useState(snapshot.timezone);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => timezoneOptions(), []);
  const detected = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } }, []);

  const save = async () => {
    setBusy(true);
    const res = await saveSetupProfile({ name, timezone });
    setBusy(false);
    if (res?.error) { toast.error(res.error); return; }
    await onSaved();
    onNext();
  };

  return <div>
    <StepHeader title="First, the basics">Your name is only used to greet you. Your timezone decides which day each task belongs to.</StepHeader>
    <div className={styles.stack}>
      <Field label="What should we call you?" htmlFor="setup-name">
        <div className={styles.withIcon}><User className={styles.icon} aria-hidden="true" />
          <input id="setup-name" value={name} maxLength={60} placeholder="Your first name" autoComplete="given-name"
            onChange={(e) => { setName(e.target.value); onDraft({ name: e.target.value }); }} />
        </div>
      </Field>
      <Field label="Your timezone" htmlFor="setup-tz">
        <div className={styles.withIcon}><Clock className={styles.icon} aria-hidden="true" />
          <select id="setup-tz" value={timezone} onChange={(e) => { setTimezone(e.target.value); onDraft({ timezone: e.target.value }); }}>
            {!zones.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {zones.map((zone) => <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </Field>
      {detected && detected !== timezone && (
        <button type="button" onClick={() => { setTimezone(detected); onDraft({ timezone: detected }); }} className={styles.linkButton}>
          <Clock className="size-4" />Use {detected.replace(/_/g, ' ')}, the timezone this device is in
        </button>
      )}
      <Why>You can change both any time in Settings.</Why>
    </div>
    <StepFooter onBack={onBack} onNext={save} busy={busy} />
  </div>;
}

function YearStep({ snapshot, onSaved, onNext, onBack, onDraft }: StepProps) {
  const [label, setLabel] = useState(snapshot.classLabel ?? '');
  const [termName, setTermName] = useState(snapshot.termName ?? 'Term 1');
  const [startDate, setStartDate] = useState(snapshot.termStartDate ?? '');
  const [endDate, setEndDate] = useState(snapshot.termEndDate ?? '');
  const [busy, setBusy] = useState(false);
  const pickLabel = (v: string) => { setLabel(v); onDraft({ classLabel: v }); };
  const pickTerm = (v: string) => { setTermName(v); onDraft({ termName: v }); };

  const save = async () => {
    setBusy(true);
    const res = await saveSetupYear({ label, termName, startDate, endDate });
    setBusy(false);
    if (res?.error) { toast.error(res.error); return; }
    if (res?.warning) toast.warning(res.warning, { duration: 8000 });
    await onSaved();
    onNext();
  };

  return <div>
    <StepHeader title="Which year are you in?">Your work is grouped by academic year and term. When the year ends you archive it and start fresh, and last year’s work stays readable.</StepHeader>
    <div className={styles.stack}>
      <Field label="Name this year" htmlFor="setup-year" hint="Whatever your school calls it.">
        <div className={styles.withIcon}><GraduationCap className={styles.icon} aria-hidden="true" />
          <input id="setup-year" value={label} maxLength={60} placeholder="e.g. Senior 6" onChange={(e) => pickLabel(e.target.value)} />
        </div>
        <Chips options={YEAR_SUGGESTIONS} onPick={pickLabel} selected={label} />
      </Field>
      <Field label="Current term" htmlFor="setup-term">
        <input id="setup-term" value={termName} maxLength={60} placeholder="e.g. Term 1" onChange={(e) => pickTerm(e.target.value)} />
        <Chips options={TERM_SUGGESTIONS} onPick={pickTerm} selected={termName} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Term starts" htmlFor="setup-start" optional>
          <input id="setup-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Term ends" htmlFor="setup-end" optional>
          <input id="setup-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); onDraft({ termEndDate: e.target.value }); }} />
        </Field>
      </div>
      <Why>Dates only prompt you; nothing starts or ends on its own. With an end date, the app offers to close the term when it arrives.</Why>
    </div>
    <StepFooter onBack={onBack} onNext={save} busy={busy} />
  </div>;
}

function AiStep({ snapshot, onSaved, onNext, onBack, onDraft }: StepProps) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  // "Connected" is only ever said after a real request got a real answer.
  const [status, setStatus] = useState<AIConnectionTest | 'checking'>('checking');
  const connected = status !== 'checking' && status.ok;

  const runTest = useCallback(async () => {
    setStatus('checking');
    const result = await testAIConnection();
    setStatus(result);
    onDraft({ aiOn: result.ok });
    return result;
  }, [onDraft]);

  useEffect(() => {
    let alive = true;
    void testAIConnection().then((result) => {
      if (!alive) return;
      setStatus(result);
      onDraft({ aiOn: result.ok });
    });
    return () => { alive = false; };
  }, [onDraft]);

  const saveKey = async () => {
    if (!key.trim()) { setKeyError('Paste your key first.'); return; }
    setBusy(true);
    setKeyError(null);
    // The server sends a test message with the key before storing it.
    const res = await saveAIKey(key.trim());
    setBusy(false);
    if (!res.success) { setKeyError(res.error || 'That key did not work.'); return; }
    setKey('');
    toast.success(`${res.provider} answered a test message.`);
    await onSaved();
    await runTest();
  };

  const useOllama = async () => {
    setProbing(true);
    await saveOllamaConfig({ enabled: true });
    const result = await runTest();
    setProbing(false);
    if (result.ollama.ok) toast.success(`Offline model ${result.ollama.model} answered a test message.`);
    else toast.error(result.ollama.error ?? 'No local model answered. Start Ollama, then try again.');
    await onSaved();
  };

  return <div>
    <StepHeader title="Connect a study assistant">Optional. The tutor, quiz generator, note summaries and reading a timetable photo all need an AI key. Paste one key below; the app works out which kind it is.</StepHeader>
    <AiStatus status={status} onRetest={() => void runTest()} />
    <div className={styles.stack}>
      <div className={styles.card}>
        <h2>Keys you can use</h2>
        <ul className="mt-3 grid gap-2.5 text-sm">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
            <span><strong className="font-semibold">Google Gemini</strong> <span className="text-muted-foreground">· starts with <code className="rounded bg-muted px-1 text-xs">AIza</code> · get one at </span><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">aistudio.google.com<ExternalLink className="size-3" /></a><span className="block text-xs text-muted-foreground">Sign in, click Create API key, no card needed. Free keys have a daily limit and work with Gemini Flash; the app picks it for you.</span></span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">Paid</span>
            <span><strong className="font-semibold">OpenAI</strong> <span className="text-muted-foreground">· starts with <code className="rounded bg-muted px-1 text-xs">sk-</code> · get one at </span><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">platform.openai.com<ExternalLink className="size-3" /></a><span className="block text-xs text-muted-foreground">Needs credit on your OpenAI account.</span></span>
          </li>
          <li className="flex items-start gap-3 text-muted-foreground">
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Not yet</span>
            <span>Claude (Anthropic) and Groq keys are not supported yet.</span>
          </li>
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className={cn(styles.field, 'flex-1')}>
            <label htmlFor="setup-key" className="sr-only">API key</label>
            <input id="setup-key" type="password" value={key} autoComplete="off" aria-describedby={keyError ? 'setup-key-error' : undefined} onChange={(e) => { setKey(e.target.value); setKeyError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveKey(); }}
              placeholder={snapshot.ai.gemini || snapshot.ai.openai ? 'Paste a new key to replace the saved one' : 'Paste your API key'} />
          </div>
          <Button onClick={saveKey} disabled={busy} className={styles.btnPrimary}>{busy ? <><Loader2 className="size-4 animate-spin" />Testing…</> : <><Check className="size-4" />Test and save</>}</Button>
        </div>
        {keyError && <p id="setup-key-error" role="alert" className={cn(styles.warn, 'mb-0 mt-3')}>{keyError}</p>}
        <small className="mt-3 block text-xs text-muted-foreground">Stored on this device only and never synced.</small>
      </div>
      <div className={styles.card}>
        <h2 className="flex items-center gap-2"><WifiOff className="size-4" />No internet? Use a local model</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Install Ollama, run <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ollama pull llama3.1</code>, then check below.</p>
        <Button variant="outline" onClick={useOllama} disabled={probing} className={cn(styles.btnSecondary, 'mt-3')}>{probing ? <Loader2 className="size-4 animate-spin" /> : <WifiOff className="size-4" />}Check for a local model</Button>
      </div>
    </div>
    <StepFooter onBack={onBack} onNext={onNext} skip={connected ? undefined : { label: 'Skip for now', onSkip: onNext }} nextLabel="Continue" />
  </div>;
}

/** What the real test said, per provider. */
function AiStatus({ status, onRetest }: { status: AIConnectionTest | 'checking'; onRetest: () => void }) {
  if (status === 'checking') {
    return <p className={styles.checking} aria-live="polite"><Loader2 className="size-4 animate-spin" />Checking your study assistant with a test message…</p>;
  }
  const rows = [
    ...status.cloud.map((c) => ({ key: c.provider, ok: c.ok, text: c.ok ? `${c.label} is answering (${c.model})` : c.error ?? `${c.label} is not answering` })),
    ...(status.ollama.enabled && (status.ollama.ok || status.cloud.length === 0)
      ? [{ key: 'ollama', ok: status.ollama.ok, text: status.ollama.ok ? `Offline model ${status.ollama.model} is answering` : status.ollama.error ?? 'Offline model is not answering' }]
      : []),
  ];
  if (rows.length === 0 || (status.cloud.length === 0 && !status.ollama.ok)) {
    return <p className={cn(styles.why, 'mb-5')} aria-live="polite">No study assistant is connected yet. Add a key below, or skip this step.</p>;
  }
  return <div className="mb-5 grid gap-2" aria-live="polite">
    {rows.map((row) => <p key={row.key} className={row.ok ? cn(styles.ok, 'mb-0') : cn(styles.warn, 'mb-0')}>
      {row.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}<span>{row.text}</span>
    </p>)}
    <button type="button" onClick={onRetest} className={styles.linkButton}>Test again</button>
  </div>;
}

function SubjectsStep({ snapshot, onSaved, onNext, onBack }: StepProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const subjects = snapshot.subjects;

  const add = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (subjects.some((s) => s.toLowerCase() === name.toLowerCase())) { toast.error(`${name} is already on the list.`); return; }
    setBusy(true);
    try {
      await addSubject(name);
      setDraft('');
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That subject could not be added.');
    } finally {
      setBusy(false);
    }
  };

  const suggestions = SUBJECT_SUGGESTIONS.filter((s) => !subjects.some((x) => x.toLowerCase() === s.toLowerCase()));

  return <div>
    {subjects.length > 0
      ? <StepHeader title="Check your subjects">These came from your timetable, each once. Add any that are missing, like ones you study without a lesson.</StepHeader>
      : <StepHeader title="What do you study?">Add every subject you take this year. Homework, exams, marks and study blocks all belong to a subject.</StepHeader>}
    <div className={styles.stack}>
      <Field label="Add a subject" htmlFor="setup-subject" hint="Press Enter after each one.">
        <div className="flex gap-2">
          <div className={cn(styles.withIcon, 'flex-1')}><Library className={styles.icon} aria-hidden="true" />
            <input id="setup-subject" value={draft} placeholder="e.g. Physics" onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(draft); } }} />
          </div>
          <Button onClick={() => add(draft)} disabled={busy} className={styles.btnPrimary}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add</Button>
        </div>
      </Field>
      {suggestions.length > 0 && <div className="grid gap-2">
        <p className={styles.miniLabel}>Tap to add</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => <button key={s} type="button" disabled={busy} onClick={() => void add(s)} className={styles.chip}><Plus className="size-3" />{s}</button>)}
        </div>
      </div>}
      <div className={styles.card}>
        <p className={styles.miniLabel}>Your subjects · {subjects.length}</p>
        {subjects.length === 0
          ? <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Add at least one; you can add more later from Subjects.</p>
          : <motion.ul layout className="mt-3 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {subjects.map((s) => <motion.li layout key={s} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 text-sm font-medium text-primary"><Check className="size-3.5" />{s}</motion.li>)}
            </AnimatePresence>
          </motion.ul>}
      </div>
    </div>
    <StepFooter onBack={onBack} onNext={onNext} skip={subjects.length === 0 ? { label: 'Skip for now', onSkip: onNext } : undefined} />
  </div>;
}

function SchoolStep({ snapshot, onSaved, onNext, onBack }: StepProps) {
  const [open, setOpen] = useState(false);
  const hasAI = snapshot.ai.gemini || snapshot.ai.openai || snapshot.ai.ollama;
  const [subject, setSubject] = useState(snapshot.subjects[0] ?? '');
  const [manual, setManual] = useState(false);
  const [days, setDays] = useState<number[]>([1]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const toggleDay = (d: number) => setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);

  // Lessons are picked from the subjects added in the step before, so the
  // timetable, homework and study blocks all agree on one spelling of each.
  const addLesson = async () => {
    const name = subject.trim();
    if (!name) { toast.error('Type or pick a subject first.'); return; }
    if (days.length === 0) { toast.error('Pick at least one day.'); return; }
    if (endTime <= startTime) { toast.error('A lesson has to end after it starts.'); return; }
    setBusy(true);
    // A subject typed here that does not exist yet becomes one, so the
    // Subjects step that follows already has it.
    if (!snapshot.subjects.some((s) => s.toLowerCase() === name.toLowerCase())) {
      try { await addSubject(name); } catch (e) {
        if (!(e instanceof Error && /already exists/i.test(e.message))) { setBusy(false); toast.error(e instanceof Error ? e.message : 'That subject could not be added.'); return; }
      }
    }
    const ordered = [...days].sort((a, b) => weekdayOrder(a) - weekdayOrder(b));
    for (const day of ordered) {
      const res = await createSchoolLesson({ dayOfWeek: day, subject: name, startTime, endTime });
      if (res?.error) { setBusy(false); toast.error(res.error); return; }
    }
    await onSaved();
    setBusy(false);
    const shown = snapshot.subjects.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name;
    toast.success(`${shown} lesson added to ${ordered.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}.`);
  };

  return <div>
    <StepHeader title="Your school timetable">Upload a photo of it and we pull out your lessons and your subjects, each subject once. No typing. These are the lessons you attend, not your study plan.</StepHeader>
    {snapshot.schoolLessonCount > 0 && <Done>{snapshot.schoolLessonCount} lesson{snapshot.schoolLessonCount === 1 ? '' : 's'} saved{snapshot.subjects.length ? ` · ${snapshot.subjects.length} subject${snapshot.subjects.length === 1 ? '' : 's'}` : ''}.</Done>}
    <div className={styles.stack}>
      <button type="button" onClick={() => setOpen(true)} disabled={!hasAI} className={cn(styles.option, styles.optionPrimary)}>
        <School className="size-5 text-primary" />
        <strong>Upload a photo or PDF</strong>
        <span>We read it into a list of lessons and subjects you can check before saving.{snapshot.schoolLessonCount ? ' This replaces the lessons saved now.' : ''}</span>
      </button>
      {!hasAI && <p className={styles.warn}>Reading a photo needs the study assistant. Go back a step to connect one, or add lessons by hand.</p>}
      {!manual
        ? <button type="button" onClick={() => setManual(true)} className={styles.linkButton}><Plus className="size-4" />Add lessons by hand instead</button>
        : <div className={styles.card}>
          <h2>Add lessons by hand</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Subject" htmlFor="lesson-subject" hint={snapshot.subjects.length ? 'Tap one you have, or type a new one.' : 'A new subject is added to your subjects too.'}>
              <div className={styles.withIcon}><Library className={styles.icon} aria-hidden="true" />
                <input id="lesson-subject" value={subject} placeholder="e.g. Mathematics" onChange={(e) => setSubject(e.target.value)} />
              </div>
              {snapshot.subjects.length > 0 && <div className="flex flex-wrap gap-2">
                {snapshot.subjects.map((s) => <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={cn(styles.chip, subject === s && styles.chipOn)}>{s}</button>)}
              </div>}
            </Field>
            <div className={styles.field}>
              <span id="lesson-days-label" className={styles.labelText}>Days</span>
              <div role="group" aria-labelledby="lesson-days-label" className="grid grid-cols-7 gap-1.5">
                {DAY_OPTIONS.map((d) => <button key={d.value} type="button" aria-pressed={days.includes(d.value)} onClick={() => toggleDay(d.value)} className={cn(styles.day, days.includes(d.value) && styles.dayOn)}>{d.name.slice(0, 3)}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="lesson-start"><input id="lesson-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
              <Field label="Ends" htmlFor="lesson-end"><input id="lesson-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
            </div>
            <Button onClick={addLesson} disabled={busy} className={cn(styles.btnPrimary, 'w-full')}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add lesson{days.length > 1 ? ` (${days.length} days)` : ''}
            </Button>
          </div>
        </div>}
      <Why>Breaks and lunch, and any later changes, are on the School timetable page.</Why>
    </div>
    <StepFooter onBack={onBack} onNext={async () => { await onSaved(); onNext(); }} skip={{ label: 'Skip', onSkip: onNext }} />
    {open && <UploadSchoolTimetableDialog existingCount={snapshot.schoolLessonCount} onClose={() => { setOpen(false); void onSaved(); }} />}
  </div>;
}

function BlocksStep({ snapshot, onSaved, onNext, onBack, onDraft }: StepProps) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [days, setDays] = useState<number[]>([1]);
  const [subject, setSubject] = useState(snapshot.subjects[0] ?? '');
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:00');
  const [type, setType] = useState<'HOMEWORK' | 'REVISION'>('HOMEWORK');
  const [busy, setBusy] = useState(false);
  const total = snapshot.templateCount;

  const toggleDay = (d: number) => setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);

  const add = async () => {
    if (!subject.trim()) { toast.error('Pick a subject first.'); return; }
    if (days.length === 0) { toast.error('Pick at least one day.'); return; }
    if (endTime <= startTime) { toast.error('A block has to end after it starts.'); return; }
    setBusy(true);
    try {
      const ordered = [...days].sort((a, b) => weekdayOrder(a) - weekdayOrder(b));
      const added: string[] = [];
      const taken: string[] = [];
      for (const day of ordered) {
        // Due the same day by default; /manage changes it for anyone who needs to.
        const result = await createTemplate({ dayOfWeek: day, subject: subject.trim(), startTime, endTime, deadlineDay: DAY_NAMES[day], type });
        (result && 'success' in result ? added : taken).push(DAY_NAMES[day].slice(0, 3));
      }
      await onSaved();
      if (added.length > 0) toast.success(`${subject} added to ${added.join(', ')}.`);
      if (taken.length > 0) toast.error(`${taken.join(', ')} already has something at that time, so ${subject} was not added there.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That block could not be added.');
    } finally {
      setBusy(false);
    }
  };

  return <div>
    <StepHeader title="Your study week">Describe one normal week, like “Physics, Wednesdays, 19:00 to 21:00”. Every day the app creates that day’s tasks from it.</StepHeader>
    {snapshot.subjects.length === 0 && <p className={styles.warn}>You have no subjects yet. Go back a step and add one, or skip this for now.</p>}
    <div role="tablist" aria-label="How to build your week" className={styles.segmented}>
      <button type="button" role="tab" aria-selected={mode === 'ai'} onClick={() => setMode('ai')}><Sparkles className="size-4" />Plan it for me</button>
      <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => { setMode('manual'); onDraft({ proposed: [] }); }}><Plus className="size-4" />Add by hand</button>
    </div>
    {mode === 'ai' ? <AiPlanner snapshot={snapshot} onSaved={onSaved} onDraft={onDraft} /> : <div className={styles.stack}>
      <Field label="Subject" htmlFor="block-subject">
        <div className={styles.withIcon}><Library className={styles.icon} aria-hidden="true" />
          <select id="block-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Choose a subject</option>
            {snapshot.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Field>
      <div className={styles.field}>
        <span id="block-days-label" className={styles.labelText}>Days <span>(pick one or more)</span></span>
        <div role="group" aria-labelledby="block-days-label" className="grid grid-cols-7 gap-1.5">
          {DAY_OPTIONS.map((d) => <button key={d.value} type="button" aria-pressed={days.includes(d.value)} onClick={() => toggleDay(d.value)} className={cn(styles.day, days.includes(d.value) && styles.dayOn)}>{d.name.slice(0, 3)}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts" htmlFor="block-start"><input id="block-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
        <Field label="Ends" htmlFor="block-end"><input id="block-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
      </div>
      <div className={styles.field}>
        <span id="block-type-label" className={styles.labelText}>Type</span>
        <div role="radiogroup" aria-labelledby="block-type-label" className="grid grid-cols-2 gap-3">
          {([
            { value: 'HOMEWORK', title: 'Homework', body: 'Work that is due', edge: 'border-blue-500/70' },
            { value: 'REVISION', title: 'Revision', body: 'Going over material', edge: 'border-dashed border-orange-500/70' },
          ] as const).map((o) => <button key={o.value} type="button" role="radio" aria-checked={type === o.value} onClick={() => setType(o.value)} className={cn(styles.typeCard, type === o.value && styles.typeOn)}>
            <span className={cn('h-8 w-1.5 shrink-0 rounded-full border-2', o.edge)} aria-hidden="true" />
            <span><strong>{o.title}</strong><span>{o.body}</span></span>
          </button>)}
        </div>
      </div>
      <Button onClick={add} disabled={busy || snapshot.subjects.length === 0} className={cn(styles.btnPrimary, 'w-full')}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add to my week{days.length > 1 ? ` (${days.length} days)` : ''}
      </Button>
      <p className="text-sm text-muted-foreground">{total ? `${total} block${total === 1 ? '' : 's'} in your week so far.` : 'Two or three blocks is enough to start. You can build the rest on the Week page.'}</p>
    </div>}
    <StepFooter onBack={onBack} onNext={async () => { await onSaved(); onNext(); }} skip={total === 0 ? { label: 'Skip for now', onSkip: onNext } : undefined} />
  </div>;
}

/**
 * "Plan it for me": the person gives their days and study hours, the AI drafts
 * blocks from their subjects around their school lessons, and they review the
 * draft before anything is saved.
 */
function AiPlanner({ snapshot, onSaved, onDraft }: { snapshot: SetupSnapshot; onSaved: () => Promise<void>; onDraft: (d: Draft) => void }) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('22:00');
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanBlock[] | null>(null);
  const [dropped, setDropped] = useState(0);
  const toggleDay = (d: number) => setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  const show = (blocks: PlanBlock[] | null) => { setPlan(blocks); onDraft({ proposed: blocks ?? [] }); };

  const generate = async () => {
    setError(null);
    if (days.length === 0) { setError('Pick at least one day.'); return; }
    if (end <= start) { setError('Your finish time has to be after your start time.'); return; }
    setPlanning(true);
    const res = await generateStudyWeek({ days, start, end });
    setPlanning(false);
    if (res.error || !res.blocks) { setError(res.error ?? 'No plan came back.'); return; }
    setDropped(res.dropped ?? 0);
    show(res.blocks);
  };

  const remove = (i: number) => show(plan ? plan.filter((_, j) => j !== i) : null);

  const save = async () => {
    if (!plan?.length) return;
    setSaving(true);
    try {
      let count = 0;
      for (const b of plan) {
        const result = await createTemplate({ dayOfWeek: b.dayOfWeek, subject: b.subject, startTime: b.startTime, endTime: b.endTime, deadlineDay: DAY_NAMES[b.dayOfWeek], type: b.type });
        if (result && 'success' in result) count++;
      }
      const skipped = plan.length - count;
      show(null);
      await onSaved();
      toast.success(`${count} blocks added to your week.`);
      if (skipped > 0) toast.error(`${skipped} left out because something is already at that time.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The plan could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const hours = plan ? Math.round(plan.reduce((sum, b) => sum + (Number(b.endTime.slice(0, 2)) * 60 + Number(b.endTime.slice(3)) - Number(b.startTime.slice(0, 2)) * 60 - Number(b.startTime.slice(3))), 0) / 6) / 10 : 0;

  if (plan) {
    return <div className={styles.stack}>
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">Your proposed week</p>
        <p className="text-sm text-muted-foreground">{plan.length} blocks · {hours}h</p>
      </div>
      {dropped > 0 && <p className={cn(styles.why, 'mb-0')}>{dropped} suggested block{dropped === 1 ? ' was' : 's were'} left out because {dropped === 1 ? 'it' : 'they'} clashed with your lessons or hours.</p>}
      <ul className={styles.planList}>
        <AnimatePresence initial={false}>
          {plan.map((b, i) => <motion.li key={`${b.dayOfWeek}-${b.startTime}-${b.subject}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
            <span className={cn('h-9 w-1.5 shrink-0 rounded-full border-2', b.type === 'REVISION' ? 'border-dashed border-orange-500/70' : 'border-blue-500/70')} aria-hidden="true" />
            <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground">{DAY_NAMES[b.dayOfWeek].slice(0, 3)}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{b.subject}</strong><span className="text-xs text-muted-foreground">{b.startTime}–{b.endTime} · {b.type === 'REVISION' ? 'Revision' : 'Homework'}</span></span>
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${b.subject} on ${DAY_NAMES[b.dayOfWeek]} at ${b.startTime}`} className={styles.iconButton}><Trash2 className="size-4" /></button>
          </motion.li>)}
        </AnimatePresence>
      </ul>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="outline" onClick={() => void generate()} disabled={planning || saving} className={styles.btnSecondary}>{planning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Try again</Button>
        <Button onClick={save} disabled={saving || plan.length === 0} className={styles.btnPrimary}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save {plan.length} blocks</Button>
      </div>
      <button type="button" onClick={() => show(null)} className={styles.linkButton}>Change my days or hours</button>
    </div>;
  }

  return <div className={styles.stack}>
    <p className="text-sm text-muted-foreground">Tell us when you study. The AI plans blocks for {snapshot.subjects.length ? snapshot.subjects.join(', ') : 'your subjects'}{snapshot.schoolLessonCount ? ', around your school lessons' : ''}. You check it before anything is saved.</p>
    <div className={styles.field}>
      <span id="plan-days-label" className={styles.labelText}>Days you study</span>
      <div role="group" aria-labelledby="plan-days-label" className="grid grid-cols-7 gap-1.5">
        {DAY_OPTIONS.map((d) => <button key={d.value} type="button" aria-pressed={days.includes(d.value)} onClick={() => toggleDay(d.value)} className={cn(styles.day, days.includes(d.value) && styles.dayOn)}>{d.name.slice(0, 3)}</button>)}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Field label="I start studying at" htmlFor="plan-start"><input id="plan-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label="I stop at" htmlFor="plan-end"><input id="plan-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
    </div>
    {error && <p role="alert" className={cn(styles.warn, 'mb-0')}><X className="size-4 shrink-0" /><span>{error}</span></p>}
    <Button onClick={() => void generate()} disabled={planning || snapshot.subjects.length === 0} className={cn(styles.btnPrimary, 'w-full')}>
      {planning ? <><Loader2 className="size-4 animate-spin" />Planning your week…</> : <><Sparkles className="size-4" />Plan my week</>}
    </Button>
    {planning && <div className={styles.planSkeleton} aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
    {snapshot.templateCount > 0 && <p className="text-sm text-muted-foreground">You already have {snapshot.templateCount} block{snapshot.templateCount === 1 ? '' : 's'}; the plan fits around them.</p>}
  </div>;
}

function Confetti() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const colors = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#eab308'];
  return <div className={styles.confetti} aria-hidden="true">
    {Array.from({ length: 28 }, (_, i) => {
      const x = ((i * 37) % 100) - 50;
      return <motion.span key={i} style={{ background: colors[i % colors.length], left: '50%' }}
        initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
        animate={{ x: x * 6, y: [0, -140 - (i % 5) * 30, 260], opacity: [1, 1, 0], rotate: (i % 2 ? 1 : -1) * 360 }}
        transition={{ duration: 1.8 + (i % 4) * 0.2, ease: 'easeOut', delay: (i % 6) * 0.03 }} />;
    })}
  </div>;
}

function DoneStep({ snapshot, aiOn, onFinish, isPending, onBack }: { snapshot: SetupSnapshot; aiOn?: boolean; onFinish: (destination: string) => void; isPending: boolean; onBack: () => void }) {
  const savedKey = snapshot.ai.gemini ? 'Gemini' : snapshot.ai.openai ? 'OpenAI' : null;
  const aiOk = aiOn ?? Boolean(savedKey);
  const ai = aiOn === true ? 'Answering' : aiOn === false ? (savedKey ? `${savedKey} key saved, not answering` : 'Not connected') : savedKey ? `${savedKey} key saved` : 'Not connected';
  const rows = [
    { label: 'Year', value: snapshot.classLabel ?? 'Not set', ok: Boolean(snapshot.classLabel) },
    { label: 'Term', value: snapshot.termStartDate && snapshot.termEndDate ? `${snapshot.termName} · ${snapshot.termStartDate} to ${snapshot.termEndDate}` : snapshot.termName ?? 'Not set', ok: Boolean(snapshot.termName) },
    { label: 'Study assistant', value: ai, ok: aiOk },
    { label: 'Subjects', value: snapshot.subjects.length ? `${snapshot.subjects.length} added` : 'None yet', ok: snapshot.subjects.length > 0 },
    { label: 'School timetable', value: snapshot.schoolLessonCount ? `${snapshot.schoolLessonCount} lessons` : 'Skipped', ok: snapshot.schoolLessonCount > 0 },
    { label: 'Study week', value: snapshot.templateCount ? `${snapshot.templateCount} blocks` : 'None yet', ok: snapshot.templateCount > 0 },
  ];
  const outstanding = rows.filter((r) => !r.ok).length;

  return <div className="relative">
    <Confetti />
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className={styles.doneBadge}><Check className="size-7" /></motion.div>
    <StepHeader title={outstanding === 0 ? 'You’re all set' : 'Your workspace is ready'}>
      {outstanding === 0 ? 'Everything is in place. Take the short tour to see where it all lives.' : 'Anything you skipped stays on a checklist on your dashboard. Nothing is blocked in the meantime.'}
    </StepHeader>
    <ul className={styles.summary}>
      {rows.map((row, i) => <motion.li key={row.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
        <span className={cn(styles.summaryMark, row.ok ? styles.summaryOk : '')}>{row.ok ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span>
        <span className="font-medium">{row.label}</span>
        <span className="ml-auto truncate text-muted-foreground">{row.value}</span>
      </motion.li>)}
    </ul>
    <div className={styles.footer}>
      <Button variant="outline" onClick={onBack} disabled={isPending} className={styles.btnSecondary}><ArrowLeft className="size-4" />Back</Button>
      <div className="flex-1" />
      <Button variant="ghost" onClick={() => onFinish('/')} disabled={isPending} className={styles.btnGhost}>Go to dashboard</Button>
      <Button onClick={() => onFinish('/?tour=1')} disabled={isPending} className={styles.btnPrimary}>{isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}Take the tour</Button>
    </div>
  </div>;
}
