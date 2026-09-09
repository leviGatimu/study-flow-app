'use client';

/**
 * AI Study.
 *
 * The first version of this page was a faithful transcription of the sketch -
 * greeting, input, a row of pills, a strip, a list - and it read like a form.
 * Everything was the same weight, so nothing was the point, and the one thing
 * that makes this app's assistant different from any chatbot tab was a small
 * grey chip in a corner.
 *
 * This one is built around two claims, and lets the rest be quiet:
 *
 *   1. IT KNOWS YOU. That is the product. So the right-hand rail is a standing
 *      readout of what it can see - next exam, today's progress, weakest
 *      subject, your notes - and it is on screen permanently rather than hidden
 *      behind a chip. A student who can see the AI's evidence trusts its
 *      advice; one who cannot, does not.
 *
 *   2. IT ALREADY DECIDED WHAT YOU SHOULD DO. So the recommendation is the
 *      largest object on the page, above the input, phrased as an instruction
 *      with one button. An assistant that opens with a blank box asks the
 *      student to do the deciding, which is the work they wanted help with.
 *
 * The modes live INSIDE the composer as a segmented control, not as five loose
 * pills underneath it, because picking a mode and typing are one thought.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Flame,
  GraduationCap,
  Loader2,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { STUDY_MODES, modeMeta, type StudyMode } from '@/lib/ai-study';
import type { StudyHome } from '@/lib/ai-study-actions';
import {
  askStudyAI,
  getContextPreview,
  getStudySession,
  startStudySession,
} from '@/lib/ai-study-actions';
import { deleteChatSession } from '@/lib/ai-actions';

type Message = { role: 'user' | 'model'; content: string };

type ActiveSession = {
  id: string;
  title: string;
  mode: StudyMode;
  subject: string | null;
  messages: Message[];
};

/**
 * A colour per mode, as whole class strings.
 *
 * Written out rather than composed, because Tailwind only ships classes it can
 * see in the source - `bg-${colour}-500` compiles to nothing at all.
 */
const MODE_STYLE: Record<StudyMode, { chip: string; dot: string; glow: string }> = {
  ASK: {
    chip: 'bg-primary text-primary-foreground',
    dot: 'bg-primary',
    glow: 'from-primary/20',
  },
  LEARN: {
    chip: 'bg-violet-500 text-white',
    dot: 'bg-violet-500',
    glow: 'from-violet-500/20',
  },
  PRACTICE: {
    chip: 'bg-emerald-500 text-white',
    dot: 'bg-emerald-500',
    glow: 'from-emerald-500/20',
  },
  EXAM: {
    chip: 'bg-rose-500 text-white',
    dot: 'bg-rose-500',
    glow: 'from-rose-500/20',
  },
  REVIEW: {
    chip: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
    glow: 'from-amber-500/20',
  },
};

export function AiStudy({ home }: { home: StudyHome }) {
  const [session, setSession] = useState<ActiveSession | null>(null);

  return session ? (
    <SessionView
      session={session}
      onChange={setSession}
      onLeave={() => setSession(null)}
      aiReady={home.aiReady}
    />
  ) : (
    <HomeView home={home} onOpen={setSession} />
  );
}

/* --------------------------------------------------------------------- home */

function HomeView({
  home,
  onOpen,
}: {
  home: StudyHome;
  onOpen: (session: ActiveSession) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<StudyMode>('ASK');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ctx = home.context;

  /** Open a session and send its first message as one action. */
  const begin = useCallback(
    async (chosenMode: StudyMode, prompt: string, subject?: string | null) => {
      const text = prompt.trim();
      if (!text) {
        inputRef.current?.focus();
        return;
      }
      if (!home.aiReady) {
        toast.error('No AI is switched on yet. Add a key in Settings first.');
        return;
      }

      setBusy(true);
      const created = await startStudySession({
        mode: chosenMode,
        subject: subject ?? null,
        title: text.slice(0, 60),
      });
      if ('error' in created || !created.sessionId) {
        setBusy(false);
        toast.error('error' in created ? created.error! : 'Could not start that session.');
        return;
      }

      const opened: ActiveSession = {
        id: created.sessionId,
        title: text.slice(0, 60),
        mode: chosenMode,
        subject: subject ?? null,
        messages: [{ role: 'user', content: text }],
      };
      onOpen(opened);
      setBusy(false);

      const result = await askStudyAI({
        prompt: text,
        mode: chosenMode,
        sessionId: created.sessionId,
        history: [],
      });
      onOpen({
        ...opened,
        messages: [
          { role: 'user', content: text },
          { role: 'model', content: result.error ? `⚠️ ${result.error}` : result.text },
        ],
      });
      router.refresh();
    },
    [home.aiReady, onOpen, router]
  );

  const openExisting = useCallback(
    async (id: string) => {
      const loaded = await getStudySession(id);
      if (!loaded) {
        toast.error('That session is gone.');
        router.refresh();
        return;
      }
      onOpen({
        id: loaded.id,
        title: loaded.title,
        mode: loaded.mode,
        subject: loaded.subject,
        messages: loaded.messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          content: m.content,
        })),
      });
    },
    [onOpen, router]
  );

  /**
   * Openers built from their real subjects.
   *
   * "Test me on Physics" is a different invitation from "Test me on…". The
   * weakest subject leads, because that is the one they avoid.
   */
  const quickStarts = useMemo(() => {
    if (!ctx) return [];
    const seen = new Set<string>();
    const picks: { label: string; mode: StudyMode; subject: string; prompt: string }[] = [];

    for (const weak of ctx.weakAreas.slice(0, 2)) {
      if (seen.has(weak.subject)) continue;
      seen.add(weak.subject);
      picks.push({
        label: `Test me on ${weak.subject}`,
        mode: 'PRACTICE',
        subject: weak.subject,
        prompt: `Test me on ${weak.subject}, starting easy and getting harder.`,
      });
    }
    for (const subject of ctx.subjects) {
      if (picks.length >= 4 || seen.has(subject)) continue;
      seen.add(subject);
      picks.push({
        label: `Teach me ${subject}`,
        mode: 'LEARN',
        subject,
        prompt: `Teach me something from ${subject}. Ask me which topic first.`,
      });
    }
    return picks;
  }, [ctx]);

  /**
   * There is not always something to recommend - no exams, nothing due, no
   * weak subject, an empty schedule. That is a brand-new account, and the
   * moment the page must least look like a dead end.
   *
   * So the fallback asks the question this whole feature exists to answer, and
   * lets the assistant work it out from the context instead of the rules.
   */
  const opener = home.recommendation ?? {
    headline: ctx?.subjects.length ? 'What should I work on?' : 'Set up your year first',
    reason: ctx?.subjects.length
      ? 'Nothing is due and nothing is scheduled, so let it look at your subjects and pick.'
      : 'It answers from your real timetable, so it needs one to exist.',
    minutes: 20,
    subject: null as string | null,
    mode: 'ASK' as StudyMode,
    prompt:
      'Looking at my subjects, my schedule and how I have been doing, what is the most useful thing I could do in the next 30 minutes? Pick one thing and say why.',
  };
  const needsSetup = !ctx?.subjects.length;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 md:px-8 md:py-12">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------------------------------- main column */}
        <div className="min-w-0">
          <header className="relative overflow-hidden">
            {/* One soft wash behind the greeting. The app's landing pages use
                the same language, and it stops the page opening on flat grey. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-gradient-to-br from-primary/25 to-transparent blur-3xl"
            />
            <div className="relative">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI Study
              </p>
              <h1 className="mt-3 font-heading text-4xl font-black leading-[1.05] tracking-tight md:text-5xl">
                Good {ctx?.partOfDay ?? 'day'},{' '}
                <span className="text-primary">{ctx?.name ?? 'there'}</span>.
              </h1>
              <div className="mt-4 space-y-1.5">
                {situationLines(home).map((line) => (
                  <p key={line.text} className="flex items-start gap-2.5 text-base md:text-lg">
                    <span
                      className={cn(
                        'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                        line.urgent ? 'bg-rose-500' : 'bg-muted-foreground/40'
                      )}
                    />
                    <span className={cn(line.urgent ? 'font-bold' : 'text-muted-foreground')}>
                      {line.text}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </header>

          {!home.aiReady && <NoKeyNotice />}

          {/* The biggest thing on the page, deliberately: the assistant has
              already decided, so the student does not have to. */}
          <section className="mt-8">
              <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                      Start here
                    </p>
                    <h2 className="mt-2 font-heading text-2xl font-black tracking-tight md:text-3xl">
                      {opener.headline}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {opener.reason}
                    </p>
                    {!needsSetup && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-background/70 px-3 py-1 text-xs font-bold text-muted-foreground">
                          ~{opener.minutes} min
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-bold',
                            MODE_STYLE[opener.mode].chip
                          )}
                        >
                          {modeMeta(opener.mode).label}
                        </span>
                      </div>
                    )}
                  </div>
                  {needsSetup ? (
                    <Button asChild size="lg" className="h-12 shrink-0 rounded-2xl px-6 text-base">
                      <Link href="/setup">
                        Set up
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-12 shrink-0 rounded-2xl px-6 text-base"
                      disabled={busy}
                      onClick={() => void begin(opener.mode, opener.prompt, opener.subject)}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Start
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </section>

          {/* The composer. Mode and text are one object because choosing how to
              work and saying what to work on are one thought. */}
          <section className="mt-8">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-colors focus-within:border-primary/50">
              <div className="flex gap-1 overflow-x-auto border-b border-border/60 bg-muted/30 p-1.5">
                {STUDY_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id);
                      if (m.starter && !draft.trim()) setDraft(m.starter);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors',
                      mode === m.id
                        ? MODE_STYLE[m.id].chip
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void begin(mode, draft);
                  }
                }}
                rows={3}
                placeholder={
                  mode === 'ASK'
                    ? 'Ask anything — a concept, a bug, what to do tonight…'
                    : modeMeta(mode).starter + '…'
                }
                className="w-full resize-none bg-transparent px-5 py-4 text-base outline-none placeholder:text-muted-foreground/50"
              />

              <div className="flex items-end justify-between gap-4 px-5 pb-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {modeMeta(mode).blurb}
                </p>
                <Button
                  size="lg"
                  className="h-10 shrink-0 rounded-full px-5"
                  disabled={busy || !draft.trim()}
                  onClick={() => void begin(mode, draft)}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>

            {quickStarts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickStarts.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={busy}
                    onClick={() => void begin(q.mode, q.prompt, q.subject)}
                    className="rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {home.recent.length > 0 && (
            <section className="mt-10">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Pick up where you left off
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {home.recent.map((s) => (
                  <li key={s.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => void openExisting(s.id)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 pr-10 text-left transition-colors hover:border-primary/40"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          MODE_STYLE[s.mode].dot
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{s.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {modeMeta(s.mode).label}
                          {s.subject ? ` · ${s.subject}` : ''} · {relativeTime(s.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${s.title}`}
                      onClick={async () => {
                        await deleteChatSession(s.id);
                        router.refresh();
                      }}
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ------------------------------------------------------------- rail */}
        <aside className="xl:sticky xl:top-8 xl:self-start">
          <KnowledgeRail home={home} />
        </aside>
      </div>
    </div>
  );
}

function NoKeyNotice() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div>
        <p className="font-heading text-base font-black text-amber-700 dark:text-amber-400">
          The AI is not switched on yet
        </p>
        <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
          Google&apos;s key is free and takes a minute — or point it at a local model and it
          works with no internet at all.
        </p>
      </div>
      <Button asChild size="lg" className="h-10 shrink-0">
        <Link href="/settings?tab=ai">
          Add a key
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

/**
 * The standing evidence panel.
 *
 * This is the page's real argument. Anyone can put a text box on a screen; the
 * claim here is that the thing behind it has read your term. So it is shown,
 * permanently, in the student's own facts - and one click opens the exact text
 * the model receives, because advice you cannot audit is advice you stop
 * believing the first time it is wrong.
 */
function KnowledgeRail({ home }: { home: StudyHome }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ctx = home.context;

  if (!ctx) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-6">
        <h2 className="font-heading text-lg font-black">Nothing to go on yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Add your subjects and a study week and this panel fills up — the assistant answers
          from your real timetable, not from guesses.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/setup">Set up your year</Link>
        </Button>
      </div>
    );
  }

  const exam = ctx.upcomingExams[0];
  const doneToday = ctx.todayBlocks.filter((b) => b.isDone).length;
  const weak = ctx.weakAreas[0];

  const rows: { icon: typeof Target; label: string; value: string; urgent?: boolean }[] = [];
  if (exam) {
    rows.push({
      icon: GraduationCap,
      label: 'Next exam',
      value: `${exam.title} · ${exam.daysAway === 0 ? 'today' : `${exam.daysAway}d`}`,
      urgent: exam.daysAway <= 3,
    });
  }
  rows.push({
    icon: CalendarClock,
    label: 'Today',
    value: ctx.todayBlocks.length
      ? `${doneToday}/${ctx.todayBlocks.length} blocks done`
      : 'Nothing scheduled',
  });
  if (weak) {
    rows.push({ icon: Target, label: 'Weakest', value: weak.subject, urgent: true });
  }
  rows.push({
    icon: BookOpen,
    label: 'Subjects',
    value: `${ctx.subjects.length} tracked`,
  });
  rows.push({
    icon: FileText,
    label: 'Your notes',
    value: ctx.notesIndex.length ? `${ctx.notesIndex.length} readable` : 'None written yet',
  });
  rows.push({
    icon: Flame,
    label: 'Streak',
    value: `${ctx.currentStreak} days · level ${ctx.level}`,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="font-heading text-sm font-black uppercase tracking-wider">
            What it knows
          </h2>
        </div>

        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                  r.urgent ? 'bg-rose-500/10 text-rose-500' : 'bg-muted text-muted-foreground'
                )}
              >
                <r.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {r.label}
                </span>
                <span className="block truncate text-sm font-bold">{r.value}</span>
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={async () => {
            setOpen(true);
            if (preview === null) {
              setLoading(true);
              setPreview((await getContextPreview()) ?? 'Nothing yet.');
              setLoading(false);
            }
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" />
          See exactly what it&apos;s sent
        </button>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Your notes are listed by title only — nothing you have written is sent unless you ask
        about it by name.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>What the AI can see</DialogTitle>
            <DialogDescription>
              Attached to every message you send, so you can tell why it says what it says. It
              never leaves your account.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Assembling…
            </div>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed">
              {preview}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The two or three true things about right now, urgency flagged. */
function situationLines(home: StudyHome): { text: string; urgent: boolean }[] {
  const ctx = home.context;
  if (!ctx) {
    return [{ text: 'Add some subjects and a study week and I can start being useful.', urgent: false }];
  }

  const lines: { text: string; urgent: boolean }[] = [];
  const exam = ctx.upcomingExams[0];
  if (exam && exam.daysAway <= 14) {
    lines.push({
      text:
        exam.daysAway === 0
          ? `${exam.title} is today.`
          : `${exam.title} is in ${exam.daysAway} day${exam.daysAway === 1 ? '' : 's'}.`,
      urgent: exam.daysAway <= 3,
    });
  }

  const tomorrow = ctx.tomorrowBlocks[0];
  if (lines.length < 2 && tomorrow) {
    lines.push({ text: `You have ${tomorrow.subject} tomorrow.`, urgent: false });
  }

  const weak = ctx.weakAreas[0];
  if (weak) {
    lines.push({ text: `You've been struggling with ${weak.subject} recently.`, urgent: false });
  }

  if (lines.length === 0) {
    const open = ctx.todayBlocks.filter((b) => !b.isDone).length;
    lines.push({
      text:
        open > 0
          ? `${open} block${open === 1 ? '' : 's'} still open on today's schedule.`
          : 'Nothing urgent today. Good time to get ahead.',
      urgent: false,
    });
  }
  return lines.slice(0, 3);
}

/* ------------------------------------------------------------------ session */

function SessionView({
  session,
  onChange,
  onLeave,
  aiReady,
}: {
  session: ActiveSession;
  onChange: (s: ActiveSession) => void;
  onLeave: () => void;
  aiReady: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!aiReady) {
      toast.error('No AI is switched on yet.');
      return;
    }

    const history = session.messages.map((m) => ({ role: m.role, content: m.content }));
    const withUser = [...session.messages, { role: 'user' as const, content: text }];
    onChange({ ...session, messages: withUser });
    setDraft('');
    setBusy(true);

    const result = await askStudyAI({
      prompt: text,
      mode: session.mode,
      sessionId: session.id,
      history,
    });

    onChange({
      ...session,
      messages: [
        ...withUser,
        { role: 'model', content: result.error ? `⚠️ ${result.error}` : result.text },
      ],
    });
    setBusy(false);
  };

  const answered = session.messages.filter((m) => m.role === 'user').length;

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 md:px-8">
      <header className="flex items-center gap-3 border-b border-border/40 py-4">
        <Button variant="ghost" size="sm" onClick={onLeave}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', MODE_STYLE[session.mode].dot)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{session.title}</p>
          <p className="text-xs text-muted-foreground">
            {modeMeta(session.mode).label}
            {session.subject ? ` · ${session.subject}` : ''}
          </p>
        </div>
        {session.mode === 'EXAM' && (
          <span className="shrink-0 rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-500">
            Exam conditions · {answered} answered
          </span>
        )}
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto py-8">
        {session.messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={`${i}-u`} className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-sm font-medium">
                {m.content}
              </p>
            </div>
          ) : (
            <AssistantMessage key={`${i}-m`} content={m.content} />
          )
        )}
        {busy && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            Thinking
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 border-t border-border/40 bg-background py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 transition-colors focus-within:border-primary/50">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={session.mode === 'EXAM' ? 'Your answer…' : 'Reply, or ask something else…'}
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <Button
            size="icon"
            className="rounded-full"
            disabled={busy || !draft.trim()}
            onClick={() => void send()}
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** An assistant reply: prose, not a bubble, with a copy button on hover. */
function AssistantMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group relative">
      <div className="ai-response-bubble pr-8 text-[0.95rem] leading-relaxed text-foreground/90">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <button
        type="button"
        aria-label="Copy this answer"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error('Could not copy.');
          }
        }}
        className="absolute right-0 top-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------- utils */

function relativeTime(date: Date | string): string {
  const then = new Date(date).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
