'use client';

/**
 * AI Study.
 *
 * One page where there were three. The old shape - AI Buddy, AI Tutor, AI Notes
 * - made the student choose a product before they had a question, and none of
 * the three knew anything about them: the model was told the date and nothing
 * else, so the one question a study assistant exists to answer, "what should I
 * do right now?", could only be answered with a question back.
 *
 * So the page opens with the answer already on it. The greeting states what is
 * actually true today - the exam that is close, the subject that is slipping -
 * and the recommendation underneath it is COMPUTED, not generated: instant,
 * free, and present even for a student who has not added an API key yet, who is
 * exactly the student most in need of being told where to start.
 *
 * The modes are the same assistant told to behave differently, which is why
 * they are buttons around one input rather than five destinations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Eye,
  Loader2,
  MessageSquare,
  Trash2,
  Zap,
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

  /**
   * Open a session and send its first message in one go.
   *
   * Deliberately one action from the student's side. Asking them to "create a
   * session" and then type is the kind of ceremony that made the old tutor page
   * feel like paperwork.
   */
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

      // Show the student's own message immediately; the reply lands into it.
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
          {
            role: 'model',
            content: result.error ? `⚠️ ${result.error}` : result.text,
          },
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
            Good {ctx?.partOfDay ?? 'day'}, {ctx?.name ?? 'there'}.
          </h1>
          <ContextIndicator ctx={ctx} />
        </div>
        <div className="mt-3 space-y-1 text-base text-muted-foreground">
          {situationLines(home).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </header>

      {!home.aiReady && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div>
            <p className="font-heading text-base font-black text-amber-700 dark:text-amber-400">
              The AI is not switched on yet
            </p>
            <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
              Everything below needs a key. Google&apos;s is free and takes about a minute — or
              point it at a local model and it works offline.
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

      {/* The one input. Modes sit around it rather than replacing it. */}
      <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm focus-within:border-primary/40">
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
          placeholder="Ask me anything about what you're studying…"
          className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground/60"
        />
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {modeMeta(mode).blurb}
          </p>
          <Button
            size="lg"
            className="h-10 shrink-0 rounded-full"
            disabled={busy || !draft.trim()}
            onClick={() => void begin(mode, draft)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            Send
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
              'rounded-full border px-4 py-2 text-sm font-bold transition-colors',
              mode === m.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {home.recommendation && (
        <section className="mt-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Today&apos;s recommendation
          </h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-heading text-lg font-black">
                <Zap className="h-4 w-4 text-primary" />
                {home.recommendation.headline}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{home.recommendation.reason}</p>
            </div>
            <Button
              size="lg"
              className="h-10 shrink-0"
              disabled={busy}
              onClick={() =>
                void begin(
                  home.recommendation!.mode,
                  home.recommendation!.prompt,
                  home.recommendation!.subject
                )
              }
            >
              Start session
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {home.recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Recent
          </h2>
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {home.recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void openExisting(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {modeMeta(s.mode).label}
                      {s.subject ? ` · ${s.subject}` : ''} · {relativeTime(s.updatedAt)}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete session ${s.title}`}
                  onClick={async () => {
                    await deleteChatSession(s.id);
                    router.refresh();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * The two or three true sentences about right now.
 *
 * Ordered by urgency and capped, because a wall of status is the same as no
 * status - the student stops reading it after the first week.
 */
function situationLines(home: StudyHome): string[] {
  const ctx = home.context;
  if (!ctx) return ['Add some subjects and a study week and I can start being useful.'];

  const lines: string[] = [];
  const exam = ctx.upcomingExams[0];
  if (exam && exam.daysAway <= 14) {
    lines.push(
      exam.daysAway === 0
        ? `${exam.title} is today.`
        : `You have ${exam.title} in ${exam.daysAway} day${exam.daysAway === 1 ? '' : 's'}.`
    );
  }

  const tomorrow = ctx.tomorrowBlocks[0];
  if (lines.length < 2 && tomorrow) {
    lines.push(`You have ${tomorrow.subject} tomorrow.`);
  }

  const weak = ctx.weakAreas[0];
  if (weak) lines.push(`You've been struggling with ${weak.subject} recently.`);

  if (lines.length === 0) {
    const open = ctx.todayBlocks.filter((b) => !b.isDone).length;
    lines.push(
      open > 0
        ? `${open} block${open === 1 ? '' : 's'} still open on today's schedule.`
        : 'Nothing urgent today. Good time to get ahead.'
    );
  }
  return lines.slice(0, 3);
}

/**
 * What the AI is being told, on demand.
 *
 * An assistant that says "revise vectors" is only trustworthy if you can see
 * why it said so. This is the whole difference between a helpful tool and one
 * the student quietly stops believing.
 */
function ContextIndicator({ ctx }: { ctx: StudyHome['context'] }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!ctx) return null;

  const chips = [
    ctx.subjects.length ? `${ctx.subjects.length} subjects` : null,
    ctx.upcomingExams.length ? `${ctx.upcomingExams.length} exams` : null,
    ctx.notesIndex.length ? `${ctx.notesIndex.length} notes` : null,
    ctx.weakAreas.length ? 'recent performance' : null,
  ].filter(Boolean) as string[];

  return (
    <>
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
        className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        Knows: {chips.join(' · ') || 'not much yet'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>What the AI can see</DialogTitle>
            <DialogDescription>
              Exactly what is attached to every message you send, so you can tell why it says
              what it says. It never leaves your account.
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
    </>
  );
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages, busy]);

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

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 md:px-8">
      <header className="flex items-center gap-3 border-b border-border/40 py-4">
        <Button variant="ghost" size="sm" onClick={onLeave}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{session.title}</p>
          <p className="text-xs text-muted-foreground">
            {modeMeta(session.mode).label}
            {session.subject ? ` · ${session.subject}` : ''}
          </p>
        </div>
        {session.mode === 'EXAM' && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-destructive">
            Exam conditions
          </span>
        )}
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto py-6">
        {session.messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'ai-response-bubble max-w-[85%] leading-relaxed',
                m.role === 'user'
                  ? 'rounded-2xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-foreground'
                  : 'text-[0.95rem] text-foreground/90'
              )}
            >
              {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 border-t border-border/40 bg-background py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 focus-within:border-primary/40">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={
              session.mode === 'EXAM' ? 'Your answer…' : 'Reply, or ask something else…'
            }
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
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
