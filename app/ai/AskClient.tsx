'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { format, isThisYear, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import {
  ArrowUp,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CalendarPlus,
  Check,
  Copy,
  KeyRound,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { AiLogo } from '@/components/ai/AiLogo';
import { PlanCard } from '@/components/ai/PlanCard';
import { ChatWidget } from '@/components/ai/ChatWidgets';
import { useIsArchived } from '@/components/ArchiveContext';
import { deleteCopilotSession, stopCopilotTurn } from '@/lib/copilot-actions';
import type { CopilotMessage, CopilotPanel, CopilotSession } from '@/lib/copilot-server';
import type { SuggestedPrompt } from '@/lib/copilot-context';
import type { StudySetSummary } from '@/lib/study-actions';
import { liveReplyText } from '@/lib/copilot-plan';
import { splitReply, widgetForDisplay, widgetsForModel } from '@/lib/chat-ui';
import { linkCitations } from '@/lib/copilot-citations';
import { cn } from '@/lib/utils';

function sessionDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy');
}

/** Which heading a chat sits under in the rail. */
function sessionGroup(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  const days = differenceInCalendarDays(new Date(), d);
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  return 'Older';
}

const draftKey = (sessionId: string | null) => `ask-draft:${sessionId ?? 'new'}`;
const RAIL_KEY = 'ask-rail-collapsed';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null || value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; a lost draft is the worst outcome.
  }
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const practiceHref = (id: string) => `/ai/practices?set=${encodeURIComponent(id)}`;

/** A score as a coloured pill class: green when strong, orange when shaky. */
function scoreClass(score: number): string {
  if (score >= 80) return 'border-success/30 bg-success/10 text-success';
  if (score >= 50) return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}

/** One-tap starters under the box and on the empty chat. */
const QUICK: { label: string; prompt: string; icon: LucideIcon }[] = [
  { label: 'Plan an exam', prompt: 'I have an exam coming up. Help me add it and plan revision for it.', icon: CalendarPlus },
  { label: 'Quiz me', prompt: 'Quiz me with a 10-question practice.', icon: BrainCircuit },
  { label: "What's next?", prompt: 'What is next on my plan, and what is due soon?', icon: CalendarClock },
  { label: 'Explain a topic', prompt: 'I would like help understanding a topic. Ask me which topic I want to explore.', icon: BookOpenCheck },
];

/** Shown, one after another, while the AI reads before its first word. */
const THINKING = ['Reading your schedule', 'Checking your exams and homework', 'Thinking it through'];

type Streaming = { requestId: string; text: string; working: 'practice' | null };

type AskEvent =
  | { t: 'start'; sessionId: string; session?: CopilotSession; userMessage: CopilotMessage }
  | { t: 'delta'; text: string }
  | { t: 'working'; what: 'practice' }
  | { t: 'done'; userMessage: CopilotMessage; reply: CopilotMessage; practice?: StudySetSummary }
  | { t: 'error'; error: string; userMessage?: CopilotMessage };

/**
 * Study: the AI chat is the whole page. Past chats are in a rail on the left
 * that folds down to icons; under lg it is a sheet. Replies stream in word by
 * word (app/api/ask/route.ts). Asking to be tested makes a practice; asking to
 * schedule something makes a plan card that only changes anything on Yes.
 */
export function AskClient({
  sessions: initialSessions,
  initialMessages,
  activeSessionId,
  suggestions,
  panel,
  practices: initialPractices,
  missingSession,
}: {
  sessions: CopilotSession[];
  initialMessages: CopilotMessage[];
  activeSessionId: string | null;
  suggestions: SuggestedPrompt[];
  panel: CopilotPanel;
  practices: StudySetSummary[];
  missingSession: boolean;
}) {
  const archived = useIsArchived();
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [toDelete, setToDelete] = useState<CopilotSession | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [practices, setPractices] = useState(initialPractices);
  const [query, setQuery] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Words arrive faster than the screen draws: they are batched per frame.
  const pendingText = useRef('');
  const frame = useRef<number | null>(null);

  const canAsk = panel.provider.ready && !archived && !panel.isArchive;
  const waiting = Boolean(streaming);

  // Browser-only state, read after mount so the first render matches the server's.
  useEffect(() => {
    const restore = setTimeout(() => {
      setDraft(readStorage(draftKey(activeSessionId)) ?? '');
      setCollapsed(readStorage(RAIL_KEY) === '1');
    }, 0);
    return () => clearTimeout(restore);
  }, [activeSessionId]);

  useEffect(() => {
    if (missingSession) toast.error('That chat no longer exists. Starting a new one.');
  }, [missingSession]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Keep the newest line in view, unless the reader scrolled up to read. */
  const follow = useCallback((force = false) => {
    const box = threadRef.current;
    if (!box) return;
    if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 200) box.scrollTop = box.scrollHeight;
  }, []);

  useEffect(() => {
    follow(true);
  }, [messages.length, follow]);
  useEffect(() => {
    follow();
  }, [streaming?.text, error, follow]);

  const toggleRail = () => {
    setCollapsed((c) => {
      writeStorage(RAIL_KEY, c ? null : '1');
      return !c;
    });
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    writeStorage(draftKey(sessionId), value);
  };

  /** A truly new chat, cleared in place (the URL was changed with replaceState). */
  const startNewChat = () => {
    abortRef.current?.abort();
    setSessionId(null);
    setMessages([]);
    setError(null);
    setStreaming(null);
    setDraft(readStorage(draftKey(null)) ?? '');
    setSheetOpen(false);
    window.history.replaceState(null, '', '/ai');
    inputRef.current?.focus();
  };

  const flushText = useCallback(() => {
    frame.current = null;
    const piece = pendingText.current;
    pendingText.current = '';
    if (piece) setStreaming((s) => (s ? { ...s, text: s.text + piece } : s));
  }, []);

  const handleEvent = useCallback(
    (event: AskEvent, requestId: string) => {
      switch (event.t) {
        case 'start': {
          const created = event.session;
          if (created) {
            setSessions((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
            window.history.replaceState(null, '', `/ai?c=${created.id}`);
            writeStorage(draftKey(null), null);
          } else {
            setSessions((prev) => {
              const current = prev.find((s) => s.id === event.sessionId);
              return current ? [{ ...current, updatedAt: new Date().toISOString() }, ...prev.filter((s) => s.id !== event.sessionId)] : prev;
            });
          }
          setSessionId(event.sessionId);
          setMessages((prev) => prev.map((m) => (m.requestId === requestId ? { ...event.userMessage, status: 'PENDING' } : m)));
          break;
        }
        case 'delta':
          pendingText.current += event.text;
          if (frame.current === null) frame.current = requestAnimationFrame(flushText);
          break;
        case 'working':
          setStreaming((s) => (s ? { ...s, working: event.what } : s));
          break;
        case 'done': {
          setMessages((prev) => {
            const next = prev.map((m) => (m.requestId === requestId ? event.userMessage : m));
            return next.some((m) => m.id === event.reply.id) ? next : [...next, event.reply];
          });
          const made = event.practice;
          if (made) setPractices((prev) => [made, ...prev.filter((p) => p.id !== made.id)]);
          break;
        }
        case 'error':
          setMessages((prev) =>
            prev.map((m) => (m.requestId === requestId ? (event.userMessage ?? { ...m, status: 'FAILED' }) : m))
          );
          if (event.error !== 'Stopped.') setError(event.error);
          break;
      }
    },
    [flushText]
  );

  const send = useCallback(
    async (question: string, requestId: string) => {
      if (!question.trim() || streaming || !canAsk) return;
      setError(null);
      setStreaming({ requestId, text: '', working: null });
      pendingText.current = '';

      // Show the question at once; a retry reuses its bubble.
      setMessages((prev) =>
        prev.some((m) => m.requestId === requestId)
          ? prev.map((m) => (m.requestId === requestId ? { ...m, status: 'PENDING' } : m))
          : [...prev, { id: `local-${requestId}`, role: 'user', content: question, status: 'PENDING', requestId, sources: [], practiceIds: [], plan: null }]
      );

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, question, requestId }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || 'Could not reach the AI. Check your connection, then retry.');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const raw = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (raw) handleEvent(JSON.parse(raw) as AskEvent, requestId);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Ask AI:', err);
          setMessages((prev) => prev.map((m) => (m.requestId === requestId ? { ...m, status: 'FAILED' } : m)));
          setError(err instanceof Error ? err.message : 'Could not reach the server. Check your connection, then retry.');
        }
      } finally {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        pendingText.current = '';
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming((s) => (s?.requestId === requestId ? null : s));
        inputRef.current?.focus();
      }
    },
    [canAsk, sessionId, streaming, handleEvent]
  );

  const submitDraft = () => {
    const question = draft.trim();
    if (!question) return;
    updateDraft('');
    void send(question, newRequestId());
  };

  const stop = async () => {
    const requestId = streaming?.requestId;
    if (!requestId) return;
    abortRef.current?.abort();
    setStreaming(null);
    setMessages((prev) => prev.map((m) => (m.requestId === requestId ? { ...m, status: 'FAILED' } : m)));
    if (sessionId) {
      try {
        await stopCopilotTurn(sessionId, requestId);
      } catch {
        // The answer may still be saved; it will show on the next load.
      }
    }
  };

  const confirmDelete = () => {
    const target = toDelete;
    if (!target) return;
    startDeleting(async () => {
      try {
        await deleteCopilotSession(target.id);
        setSessions((prev) => prev.filter((s) => s.id !== target.id));
        setToDelete(null);
        toast.success('Chat deleted.');
        if (target.id === sessionId) startNewChat();
      } catch (err) {
        console.error('Delete chat:', err);
        toast.error('Could not delete that chat. Try again.');
      }
    });
  };

  const findPractice = (id: string) => practices.find((p) => p.id === id) ?? null;
  const isEmpty = messages.length === 0 && !streaming;
  const statusDot = !panel.provider.ready ? 'bg-destructive' : panel.provider.offline ? 'bg-orange-500' : 'bg-success';

  const rail = (inSheet: boolean) => (
    <ChatRail
      sessions={sessions}
      activeId={sessionId}
      query={query}
      setQuery={setQuery}
      collapsed={!inSheet && collapsed}
      archived={archived}
      onNew={startNewChat}
      onToggle={inSheet ? undefined : toggleRail}
      onPick={() => setSheetOpen(false)}
      onDelete={setToDelete}
      provider={panel.provider}
      statusDot={statusDot}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full min-h-0">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 288 }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          className="hidden shrink-0 flex-col overflow-hidden border-r border-border/60 bg-sidebar/60 lg:flex"
        >
          {rail(false)}
        </motion.aside>

        <section className="relative flex min-w-0 flex-1 flex-col">
          {/* Soft colour behind the chat, in the accent. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/[0.06] to-transparent" />

          <header data-tour="ask-intro" className="relative flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSheetOpen(true)} className="lg:hidden" aria-label="Chats">
                <Menu className="size-5" />
              </Button>
              <AiLogo size={34} thinking={waiting} />
              <div className="min-w-0">
                <h1 className="font-heading text-base font-bold leading-tight text-foreground">Study AI</h1>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <span className="relative grid size-2 place-items-center">
                    {panel.provider.ready && !panel.provider.offline && <span className="absolute inset-0 rounded-full bg-success/60 motion-safe:animate-ping" />}
                    <span className={cn('relative size-2 rounded-full', statusDot)} aria-hidden="true" />
                  </span>
                  <span className="truncate">
                    {panel.provider.label}
                    {panel.provider.ready && panel.provider.offline ? ' (offline)' : ''}
                    {' · '}
                    {[panel.yearLabel, panel.termName].filter(Boolean).join(' · ') || 'No academic year'}
                    {panel.isArchive && ' (read-only)'}
                  </span>
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={startNewChat} className="gap-1.5 rounded-full lg:hidden" aria-label="New chat">
              <MessageSquarePlus className="size-4" />
            </Button>
          </header>

          <div ref={threadRef} className="relative min-h-0 flex-1 overflow-y-auto">
            <div aria-live="polite" className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-10 pt-4 md:px-6">
              {isEmpty ? (
                <EmptyChat
                  name={panel.studentName}
                  nextUp={panel.nextUp}
                  suggestions={suggestions}
                  disabled={!canAsk}
                  onPick={(p) => void send(p, newRequestId())}
                />
              ) : (
                messages.map((m) => (
                  <MessageView
                    key={m.id}
                    message={m}
                    findPractice={findPractice}
                    readOnly={!canAsk}
                    onRetry={m.role === 'user' && m.status === 'FAILED' && m.requestId && canAsk && !waiting ? () => void send(m.content, m.requestId!) : undefined}
                  />
                ))
              )}

              {streaming && <LiveReply streaming={streaming} onStop={() => void stop()} />}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-foreground">{error}</p>
                  {/settings|no ai/i.test(error) && (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href="/settings">Open settings</Link>
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          <div className="relative px-4 pb-4 pt-2 md:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {!panel.provider.ready ? (
                <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="size-4 shrink-0 text-primary" />
                    Add an AI key, or start a local Ollama model, to ask questions.
                  </p>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href="/settings">Set up AI</Link>
                  </Button>
                </div>
              ) : archived || panel.isArchive ? (
                <p className="rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground">You are viewing a finished year. Its chats are read-only.</p>
              ) : (
                <Composer
                  inputRef={inputRef}
                  value={draft}
                  onChange={updateDraft}
                  onSubmit={submitDraft}
                  onStop={() => void stop()}
                  waiting={waiting}
                  showQuick={!isEmpty}
                  onQuick={(prompt) => void send(prompt, newRequestId())}
                />
              )}
            </div>
          </div>
        </section>

        <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="sr-only">
              <DialogTitle>Chats</DialogTitle>
              <DialogDescription>Open a past conversation.</DialogDescription>
            </DialogHeader>
            {rail(true)}
          </DialogContent>
        </Dialog>

        <ConfirmModal
          isOpen={toDelete !== null}
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
          title="Delete this chat?"
          description={toDelete ? `"${toDelete.title}" and all its messages will be removed.` : ''}
          isPending={isDeleting}
        />
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ rail */

function ChatRail({
  sessions,
  activeId,
  query,
  setQuery,
  collapsed,
  archived,
  onNew,
  onToggle,
  onPick,
  onDelete,
  provider,
  statusDot,
}: {
  sessions: CopilotSession[];
  activeId: string | null;
  query: string;
  setQuery: (q: string) => void;
  collapsed: boolean;
  archived: boolean;
  onNew: () => void;
  onToggle?: () => void;
  onPick: () => void;
  onDelete: (s: CopilotSession) => void;
  provider: CopilotPanel['provider'];
  statusDot: string;
}) {
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? sessions.filter((s) => s.title.toLowerCase().includes(q)) : sessions;
    const out: { label: string; items: CopilotSession[] }[] = [];
    for (const s of shown) {
      const label = sessionGroup(s.updatedAt);
      const group = out.find((g) => g.label === label);
      if (group) group.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [sessions, query]);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 py-3">
        <RailIcon label="Show chats" onClick={onToggle} icon={PanelLeftOpen} />
        <RailIcon label="New chat" onClick={onNew} icon={MessageSquarePlus} primary />
        <div className="my-1 h-px w-8 bg-border" />
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto [scrollbar-width:none]">
          {sessions.slice(0, 12).map((s) => (
            <Link
              key={s.id}
              href={`/ai?c=${s.id}`}
              title={s.title}
              aria-label={s.title}
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-xl text-xs font-black uppercase transition-all hover:scale-105',
                s.id === activeId ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {s.title.trim().charAt(0) || '?'}
            </Link>
          ))}
        </div>
        <RailIcon label="Practice" href="/ai/practices" icon={BrainCircuit} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onNew}
          className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <MessageSquarePlus className="size-4 transition-transform group-hover:-rotate-12" /> New chat
        </button>
        {onToggle && <RailIcon label="Hide chats" onClick={onToggle} icon={PanelLeftClose} />}
      </div>

      <div className="px-3 pb-2">
        <label className="flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 text-sm focus-within:border-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search chats</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
      </div>

      <nav aria-label="Past chats" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{query ? 'No chats match.' : 'Your chats will appear here.'}</p>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <h2 className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground/80">{g.label}</h2>
              <ul className="space-y-0.5">
                {g.items.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <li key={s.id} className={cn('group relative flex items-center rounded-xl transition-colors', active ? 'bg-primary/10' : 'hover:bg-muted')}>
                      {active && <motion.span layoutId="chat-active" className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary" />}
                      <Link
                        href={`/ai?c=${s.id}`}
                        onClick={onPick}
                        aria-current={active ? 'page' : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <MessageSquare className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm', active ? 'font-bold text-foreground' : 'font-medium text-foreground/85')}>{s.title}</span>
                          <span className="block text-[11px] text-muted-foreground">{sessionDate(s.updatedAt)}</span>
                        </span>
                      </Link>
                      {!archived && (
                        <button
                          type="button"
                          aria-label={`Delete chat "${s.title}"`}
                          onClick={() => onDelete(s)}
                          className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="space-y-2 border-t border-border/60 p-3">
        <Link
          href="/ai/practices"
          onClick={onPick}
          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Practice</span>
            <span className="block truncate text-xs text-muted-foreground">Your sets and scores</span>
          </span>
          <Play className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', statusDot)} />
          {provider.label}
        </p>
      </div>
    </div>
  );
}

function RailIcon({
  label,
  icon: Icon,
  onClick,
  href,
  primary,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const className = cn(
    'grid size-10 shrink-0 place-items-center rounded-xl transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    primary ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  );
  return href ? (
    <Link href={href} aria-label={label} title={label} className={className}>
      <Icon className="size-[18px]" />
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      <Icon className="size-[18px]" />
    </button>
  );
}

/* -------------------------------------------------------------- composer */

function Composer({
  inputRef,
  value,
  onChange,
  onSubmit,
  onStop,
  waiting,
  showQuick,
  onQuick,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  waiting: boolean;
  showQuick: boolean;
  onQuick: (prompt: string) => void;
}) {
  const ready = value.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!waiting) onSubmit();
      }}
      className={cn(
        'group/c relative rounded-[26px] border border-border bg-card p-2 shadow-lg shadow-black/[0.04] transition-all duration-300',
        'focus-within:border-primary/40 focus-within:shadow-xl focus-within:shadow-primary/10'
      )}
    >
      {/* A glow along the top edge while the box is in use. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-focus-within/c:opacity-100" />
      <label htmlFor="ask-input" className="sr-only">
        Ask anything about your studies
      </label>
      <textarea
        id="ask-input"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!waiting) onSubmit();
          }
        }}
        rows={1}
        maxLength={8000}
        placeholder="Ask anything, “quiz me on…”, or “schedule my exam…”"
        className="field-sizing-content block max-h-52 min-h-12 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-base outline-none placeholder:text-muted-foreground md:text-[15px]"
      />
      <div className="flex items-center gap-2 px-1 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {showQuick &&
            QUICK.slice(0, 3).map((q) => (
              <button
                key={q.label}
                type="button"
                disabled={waiting}
                onClick={() => onQuick(q.prompt)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-3 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
              >
                <q.icon className="size-3.5" />
                {q.label}
              </button>
            ))}
          {!showQuick && <span className="hidden px-2 text-xs text-muted-foreground sm:block">Enter to send · Shift+Enter for a new line</span>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {waiting ? (
            <motion.button
              key="stop"
              type="button"
              onClick={onStop}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              aria-label="Stop"
              className="relative grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background"
            >
              <span className="absolute inset-0 rounded-full border-2 border-foreground/30 motion-safe:animate-ping" />
              <Square className="size-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="submit"
              disabled={!ready}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Send"
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full transition-all duration-200',
                ready ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:scale-105' : 'bg-muted text-muted-foreground'
              )}
            >
              <ArrowUp className="size-5" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- replies */

/** The answer while it arrives: a thinking line first, then the words as they come. */
function LiveReply({ streaming, onStop }: { streaming: Streaming; onStop: () => void }) {
  const shown = liveReplyText(streaming.text);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (shown) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, THINKING.length - 1)), 1400);
    return () => clearInterval(id);
  }, [shown]);

  return (
    <div className="flex gap-3">
      <AiLogo size={32} thinking className="mt-0.5" />
      <div className="min-w-0 flex-1 pt-0.5">
        {shown ? (
          <div aria-hidden="true">
            <ReplyBody text={shown} live />
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1" role="status">
            <AnimatePresence mode="wait">
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
                className="ai-shimmer text-sm font-semibold"
              >
                {THINKING[step]}…
              </motion.span>
            </AnimatePresence>
          </div>
        )}
        {streaming.working === 'practice' && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
            <BrainCircuit className="size-3.5 motion-safe:animate-pulse" /> Making your practice…
          </p>
        )}
        <button type="button" onClick={onStop} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <Square className="size-3 fill-current" /> Stop
        </button>
      </div>
    </div>
  );
}

/**
 * A reply's text and its cards (lib/chat-ui.ts). Cards are drawn outside the
 * markdown so its list and heading styles do not reach them. `live` marks a
 * reply still arriving: the caret goes on its last words.
 */
function ReplyBody({ text, sources = [], live = false }: { text: string; sources?: CopilotMessage['sources']; live?: boolean }) {
  const parts = splitReply(text);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          <ChatMarkdown key={i} className={live && i === parts.length - 1 ? 'ai-typing' : undefined}>
            {linkCitations(part.text, sources)}
          </ChatMarkdown>
        ) : (
          <ChatWidget key={i} widget={part.complete ? widgetForDisplay(part.json) : null} />
        )
      )}
    </>
  );
}

/** A practice set the AI made: what it is, its best score, and Start. */
function PracticeCard({ practice }: { practice: StudySetSummary | null }) {
  if (!practice) {
    return <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">This practice was deleted.</p>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 flex flex-col gap-3 rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/25">
        <BrainCircuit className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{practice.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {practice.subject} · {practice.itemCount} questions
          {practice.attempts > 0 ? ` · ${practice.attempts} ${practice.attempts === 1 ? 'try' : 'tries'}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {practice.bestScore !== null && (
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums', scoreClass(practice.bestScore))}>Best {practice.bestScore}%</span>
        )}
        <Button asChild size="sm" className="gap-1.5 rounded-full">
          <Link href={practiceHref(practice.id)}>
            {practice.attempts > 0 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
            {practice.attempts > 0 ? 'Try again' : 'Start'}
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

function MessageView({
  message,
  onRetry,
  findPractice,
  readOnly,
}: {
  message: CopilotMessage;
  onRetry?: () => void;
  findPractice: (id: string) => StudySetSummary | null;
  readOnly: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25 }} className="flex flex-col items-end gap-1.5">
        <p
          className={cn(
            'max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg px-4 py-2.5 text-[15px] leading-relaxed shadow-sm',
            message.status === 'FAILED' ? 'border border-border bg-muted text-foreground' : 'bg-primary text-primary-foreground shadow-primary/20'
          )}
        >
          {message.content}
        </p>
        {message.status === 'FAILED' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Not answered
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-7 gap-1.5 rounded-full px-2.5 text-xs">
                <RotateCcw className="size-3.5" /> Retry
              </Button>
            )}
          </p>
        )}
      </motion.div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(widgetsForModel(message.content).replace(/\(A \w+ card was shown\.\)/g, '').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.3 }} className="group flex gap-3">
      <AiLogo size={32} className="mt-0.5" />
      <div className="min-w-0 flex-1 pt-0.5">
        <ReplyBody text={message.content} sources={message.sources} />
        {message.plan && <PlanCard messageId={message.id} stored={message.plan} disabled={readOnly} />}
        {message.practiceIds.map((id) => (
          <PracticeCard key={id} practice={findPractice(id)} />
        ))}
        {message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sources</span>
            {message.sources.map((s, i) => (
              <Link
                key={s.id}
                href={s.href}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="font-semibold tabular-nums text-primary">{i + 1}</span>
                <span className="truncate">{s.label}</span>
              </Link>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={copy} className="mt-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </motion.div>
  );
}

function EmptyChat({
  name,
  nextUp,
  suggestions,
  disabled,
  onPick,
}: {
  name: string | null;
  nextUp: string | null;
  suggestions: SuggestedPrompt[];
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const extra = suggestions.find((s) => s.label.startsWith('My '));
  const cards = [...QUICK, ...(extra ? [{ label: extra.label, prompt: extra.prompt, icon: Sparkles }] : [])].slice(0, 4);

  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center md:py-14">
      <motion.div initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6 }} className="space-y-4">
        <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }} className="mx-auto w-fit">
          <AiLogo size={64} className="drop-shadow-[0_12px_28px_color-mix(in_oklch,var(--primary)_40%,transparent)]" />
        </motion.div>
        <h2 className="font-heading text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {hello}
          {name ? `, ${name}` : ''}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          I know your schedule, exams, homework and marks. Ask me anything, have me quiz you, or tell me about an exam and I will plan it with you.
        </p>
        {nextUp && (
          <p className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <CalendarClock className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">Next up: {nextUp}</span>
          </p>
        )}
      </motion.div>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {cards.map((s) => (
          <motion.button
            key={s.label}
            variants={{ hidden: { opacity: 0, y: 10, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)' } }}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className="group flex items-start gap-3 rounded-3xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <s.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">{s.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{s.prompt}</span>
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
