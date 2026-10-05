'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import {
  ArrowUp,
  CalendarClock,
  Check,
  Copy,
  GraduationCap,
  History,
  KeyRound,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { useIsArchived } from '@/components/ArchiveContext';
import {
  askCopilot,
  deleteCopilotSession,
  stopCopilotTurn,
  type CopilotMessage,
  type CopilotPanel,
  type CopilotSession,
} from '@/lib/copilot-actions';
import type { SuggestedPrompt } from '@/lib/copilot-context';
import { linkCitations } from '@/lib/copilot-citations';
import { cn } from '@/lib/utils';

function sessionDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy');
}

const PANEL_KEY = 'ask-context-panel';
const draftKey = (sessionId: string | null) => `ask-draft:${sessionId ?? 'new'}`;

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

/**
 * The Study workspace (approved layout): past chats on the left, the
 * conversation in the middle with the composer pinned to its foot, and a
 * collapsible context panel on the right. Under xl the panel becomes a
 * drawer; under lg so do the chats.
 */
export function AskClient({
  sessions: initialSessions,
  initialMessages,
  activeSessionId,
  suggestions,
  panel,
  missingSession,
}: {
  sessions: CopilotSession[];
  initialMessages: CopilotMessage[];
  activeSessionId: string | null;
  suggestions: SuggestedPrompt[];
  panel: CopilotPanel;
  missingSession: boolean;
}) {
  const archived = useIsArchived();
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  // requestId of the turn being answered right now.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [toDelete, setToDelete] = useState<CopilotSession | null>(null);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [panelShown, setPanelShown] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canAsk = panel.provider.ready && !archived && !panel.isArchive;

  // Per-viewer conveniences from local storage: the panel's state and the
  // unsent draft for this chat. Read after mount; the page works without them.
  // Deferred one tick: storage exists only in the browser, and restoring it
  // during hydration would make the server and client renders disagree.
  useEffect(() => {
    const restore = setTimeout(() => {
      if (readStorage(PANEL_KEY) === 'hidden') setPanelShown(false);
      setDraft(readStorage(draftKey(activeSessionId)) ?? '');
    }, 0);
    return () => clearTimeout(restore);
  }, [activeSessionId]);

  useEffect(() => {
    if (missingSession) toast.error('That chat no longer exists. Starting a new one.');
  }, [missingSession]);

  useEffect(() => {
    const box = threadRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [messages, waitingFor, error]);

  const updateDraft = (value: string) => {
    setDraft(value);
    writeStorage(draftKey(sessionId), value);
  };

  const togglePanel = () => {
    setPanelShown((shown) => {
      writeStorage(PANEL_KEY, shown ? 'hidden' : null);
      return !shown;
    });
  };

  /** A truly new chat: clear everything in place (the URL was rewritten with
   * history.replaceState, so a link to /ask could be a no-op for the router). */
  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    setWaitingFor(null);
    setDraft(readStorage(draftKey(null)) ?? '');
    setChatsOpen(false);
    window.history.replaceState(null, '', '/ask');
    inputRef.current?.focus();
  };

  const send = useCallback(
    async (question: string, requestId: string) => {
      if (!question.trim() || waitingFor || !canAsk) return;
      setError(null);
      setWaitingFor(requestId);

      // Show the turn at once; a retry reuses the existing bubble.
      setMessages((prev) =>
        prev.some((m) => m.requestId === requestId)
          ? prev.map((m) => (m.requestId === requestId ? { ...m, status: 'PENDING' } : m))
          : [...prev, { id: `local-${requestId}`, role: 'user', content: question, status: 'PENDING', requestId, sources: [] }]
      );

      try {
        const res = await askCopilot({ sessionId, question, requestId });
        if (res.session) {
          const created = res.session;
          setSessions((prev) => [created, ...prev]);
          window.history.replaceState(null, '', `/ask?c=${created.id}`);
          // The draft was typed before the chat had an id.
          writeStorage(draftKey(null), null);
        } else {
          setSessions((prev) => {
            const current = prev.find((s) => s.id === res.sessionId);
            if (!current) return prev;
            return [{ ...current, updatedAt: new Date().toISOString() }, ...prev.filter((s) => s.id !== res.sessionId)];
          });
        }
        setSessionId(res.sessionId);
        setMessages((prev) => {
          const next = prev.map((m) => (m.requestId === requestId && res.userMessage ? res.userMessage : m));
          return res.reply && !next.some((m) => m.id === res.reply!.id) ? [...next, res.reply] : next;
        });
        if (res.error && res.error !== 'Stopped.') setError(res.error);
      } catch (err) {
        console.error('Ask AI:', err);
        setMessages((prev) => prev.map((m) => (m.requestId === requestId ? { ...m, status: 'FAILED' } : m)));
        setError('Could not reach the server. Check your connection, then retry.');
      } finally {
        setWaitingFor((current) => (current === requestId ? null : current));
        inputRef.current?.focus();
      }
    },
    [canAsk, sessionId, waitingFor]
  );

  const submitDraft = () => {
    const question = draft.trim();
    if (!question) return;
    updateDraft('');
    void send(question, newRequestId());
  };

  const stop = async () => {
    const requestId = waitingFor;
    if (!requestId) return;
    setWaitingFor(null);
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

  const sessionList = (
    <nav aria-label="Past chats" className="flex flex-col gap-0.5">
      {sessions.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Your chats will appear here.</p>
      ) : (
        sessions.map((s) => (
          <div
            key={s.id}
            className={cn('group flex items-center gap-1 rounded-lg transition-colors hover:bg-muted', s.id === sessionId && 'bg-muted')}
          >
            <Link
              href={`/ask?c=${s.id}`}
              onClick={() => setChatsOpen(false)}
              aria-current={s.id === sessionId ? 'page' : undefined}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className={cn('block truncate text-sm', s.id === sessionId ? 'font-semibold text-foreground' : 'text-foreground/85')}>
                {s.title}
              </span>
              <span className="block text-xs text-muted-foreground">{sessionDate(s.updatedAt)}</span>
            </Link>
            {!archived && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete chat "${s.title}"`}
                onClick={() => setToDelete(s)}
                className="mr-1 size-8 shrink-0 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))
      )}
    </nav>
  );

  const contextPanel = <ContextPanel panel={panel} />;
  const isEmpty = messages.length === 0 && !waitingFor;
  const statusDot = !panel.provider.ready ? 'bg-destructive' : panel.provider.offline ? 'bg-orange-500' : 'bg-success';

  return (
    <div className="flex h-full min-h-0">
      {/* Past chats: a rail from lg up, a drawer below. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 lg:flex">
        <div className="p-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={startNewChat}>
            <MessageSquarePlus className="size-4" /> New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{sessionList}</div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-base font-bold leading-tight text-foreground">Ask AI</h1>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {[panel.yearLabel, panel.termName].filter(Boolean).join(' · ') || 'No academic year'}
                {panel.isArchive && ' (finished, read-only)'}
                <span aria-hidden="true">·</span>
                <span className={cn('inline-block size-2 shrink-0 rounded-full', statusDot)} aria-hidden="true" />
                <span>
                  {panel.provider.label}
                  {panel.provider.ready && panel.provider.offline ? ' (offline)' : ''}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setChatsOpen(true)} className="gap-1.5 lg:hidden">
              <History className="size-4" /> Chats
            </Button>
            <Button variant="outline" size="sm" onClick={startNewChat} className="gap-1.5 lg:hidden" aria-label="New chat">
              <MessageSquarePlus className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setContextOpen(true)} className="gap-1.5 xl:hidden">
              <CalendarClock className="size-4" /> Context
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanel}
              aria-pressed={panelShown}
              aria-label={panelShown ? 'Hide context panel' : 'Show context panel'}
              className="hidden xl:inline-flex"
            >
              {panelShown ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </Button>
          </div>
        </header>

        <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto">
          <div aria-live="polite" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
            {isEmpty ? (
              <EmptyChat suggestions={suggestions} disabled={!canAsk} onPick={(p) => void send(p, newRequestId())} />
            ) : (
              messages.map((m) => (
                <MessageView
                  key={m.id}
                  message={m}
                  onRetry={m.role === 'user' && m.status === 'FAILED' && m.requestId && canAsk && !waitingFor ? () => void send(m.content, m.requestId!) : undefined}
                />
              ))
            )}

            {waitingFor && (
              <div className="flex items-center gap-3">
                <AiAvatar />
                <div className="flex items-center gap-1.5 pt-1" role="status" aria-label="Thinking">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="size-2 animate-bounce rounded-full bg-primary/60 motion-reduce:animate-none"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void stop()} className="ml-auto gap-1.5 text-muted-foreground">
                  <Square className="size-3.5" /> Stop
                </Button>
              </div>
            )}

            {error && (
              <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">{error}</p>
                {error.startsWith('No AI configured') && (
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href="/settings">Open settings</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/95 px-4 pb-4 pt-3 backdrop-blur md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {!panel.provider.ready ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="size-4 shrink-0 text-primary" />
                  Add an AI key, or start a local Ollama model, to ask questions.
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/settings">Set up AI</Link>
                </Button>
              </div>
            ) : archived || panel.isArchive ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                You are viewing a finished year. Its chats are read-only.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitDraft();
                }}
                className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
              >
                <label htmlFor="ask-input" className="sr-only">
                  Ask anything about your studies
                </label>
                <textarea
                  id="ask-input"
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => updateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submitDraft();
                    }
                  }}
                  rows={1}
                  maxLength={8000}
                  placeholder="Ask about a topic, your marks, a deadline, or what to study next…"
                  className="field-sizing-content max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
                <Button type="submit" size="icon" aria-label="Send" disabled={Boolean(waitingFor) || !draft.trim()} className="size-10 shrink-0 rounded-xl">
                  <ArrowUp className="size-5" />
                </Button>
              </form>
            )}
            <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
              Enter to send · Shift+Enter for a new line · Answers cite your records; AI can still be wrong.
            </p>
          </div>
        </div>
      </section>

      {/* Context: a collapsible column from xl up, a drawer below. */}
      {panelShown && (
        <aside aria-label="Your study context" className="hidden w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-card/40 xl:block">
          {contextPanel}
        </aside>
      )}

      <Dialog open={chatsOpen} onOpenChange={setChatsOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your chats</DialogTitle>
            <DialogDescription className="sr-only">Open a past conversation.</DialogDescription>
          </DialogHeader>
          {sessionList}
        </DialogContent>
      </Dialog>

      <Dialog open={contextOpen} onOpenChange={setContextOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Your study context</DialogTitle>
            <DialogDescription className="sr-only">What the assistant can see right now.</DialogDescription>
          </DialogHeader>
          {contextPanel}
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
  );
}

/** What the assistant can see right now: tonight, deadlines, marks vs goals. */
function ContextPanel({ panel }: { panel: CopilotPanel }) {
  return (
    <div className="space-y-6 p-5">
      <PanelSection title="Tonight" empty="No study blocks today." count={panel.tonight.length}>
        {panel.tonight.map((b) => (
          <li key={`${b.subject}-${b.time}`} className="flex items-baseline justify-between gap-2 text-sm">
            <span className={cn('min-w-0 truncate', b.status === 'done' && 'text-muted-foreground line-through')}>{b.subject}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{b.time}</span>
          </li>
        ))}
      </PanelSection>

      <PanelSection title="Due soon" empty="Nothing due in the next week." count={panel.dueSoon.length}>
        {panel.dueSoon.map((d) => (
          <li key={`${d.href}-${d.label}`}>
            <Link href={d.href} className="block rounded-lg px-2 py-1.5 -mx-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <span className="block truncate text-foreground">{d.label}</span>
              <span className={cn('block text-xs', d.overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{d.detail}</span>
            </Link>
          </li>
        ))}
      </PanelSection>

      <PanelSection title="Marks and goals" empty="No official marks recorded yet." count={panel.marks.length} href="/marks">
        {panel.marks.map((m) => (
          <li key={m.subject} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <GraduationCap aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              {m.subject}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {m.latest === null ? 'no mark' : m.percent === null ? m.latest : `${m.percent}%`}
              {m.goal !== null && <> → {m.goal}%</>}
            </span>
          </li>
        ))}
      </PanelSection>
    </div>
  );
}

function PanelSection({
  title,
  empty,
  count,
  href,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-primary hover:underline">
            Open
          </Link>
        )}
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-1.5">{children}</ul>}
    </section>
  );
}

function AiAvatar() {
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Sparkles className="size-4" />
    </span>
  );
}

function MessageView({ message, onRetry }: { message: CopilotMessage; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p
          className={cn(
            'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed',
            message.status === 'FAILED' ? 'border border-border bg-muted text-foreground' : 'bg-primary text-primary-foreground'
          )}
        >
          {message.content}
        </p>
        {message.status === 'FAILED' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Not answered
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-7 gap-1.5 px-2 text-xs">
                <RotateCcw className="size-3.5" /> Retry
              </Button>
            )}
          </p>
        )}
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy.');
    }
  };

  return (
    <div className="flex gap-3">
      <AiAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        <ChatMarkdown>{linkCitations(message.content, message.sources)}</ChatMarkdown>
        {message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sources</span>
            {message.sources.map((s, i) => (
              <Link
                key={s.id}
                href={s.href}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="font-semibold tabular-nums text-primary">{i + 1}</span>
                <span className="truncate">{s.label}</span>
              </Link>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={copy} className="mt-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function EmptyChat({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: SuggestedPrompt[];
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center md:py-12">
      <div className="space-y-3">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </span>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">What are we working on?</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          I can read your study blocks, deadlines, exams, official marks, goals, resources and practice results, and I
          link to the records I use. Ask about any of them, or about any topic you are stuck on.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-foreground">{s.label}</span>
            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
