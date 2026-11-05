'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import {
  ArrowUp,
  BrainCircuit,
  Check,
  Copy,
  History,
  KeyRound,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { AiLogo } from '@/components/ai/AiLogo';
import { useTypewriter } from '@/components/ai/useTypewriter';
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
import type { StudySetSummary } from '@/lib/study-actions';
import { linkCitations } from '@/lib/copilot-citations';
import { cn } from '@/lib/utils';

function sessionDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy');
}

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

const practiceHref = (id: string) => `/ai/practices?set=${encodeURIComponent(id)}`;

/** A score as a coloured pill class: green when strong, orange when shaky. */
function scoreClass(score: number): string {
  if (score >= 80) return 'border-success/30 bg-success/10 text-success';
  if (score >= 50) return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}

/**
 * Study: the AI chat is the whole page. Past chats and the practice sets
 * (with their best scores) are in the rail on the left, the conversation in
 * the middle with the composer pinned to its foot. Asking to be tested makes
 * a practice set; its card opens the runner. Under lg the rail is a dialog.
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
  // requestId of the turn being answered right now.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [toDelete, setToDelete] = useState<CopilotSession | null>(null);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [practices, setPractices] = useState(initialPractices);
  // The reply that just arrived, typed out instead of appearing at once.
  const [typingId, setTypingId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canAsk = panel.provider.ready && !archived && !panel.isArchive;

  // The unsent draft for this chat, from local storage. Read after mount; the
  // page works without it. Deferred one tick: storage exists only in the
  // browser, and restoring it during hydration would make the renders disagree.
  useEffect(() => {
    const restore = setTimeout(() => {
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

  /** Keep the newest line in view while a reply types, unless the reader scrolled up. */
  const followThread = useCallback(() => {
    const box = threadRef.current;
    if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
  }, []);

  const updateDraft = (value: string) => {
    setDraft(value);
    writeStorage(draftKey(sessionId), value);
  };

  /** A truly new chat: clear everything in place (the URL was rewritten with
   * history.replaceState, so a link to /ai could be a no-op for the router). */
  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    setWaitingFor(null);
    setDraft(readStorage(draftKey(null)) ?? '');
    setChatsOpen(false);
    window.history.replaceState(null, '', '/ai');
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
          : [...prev, { id: `local-${requestId}`, role: 'user', content: question, status: 'PENDING', requestId, sources: [], practiceIds: [] }]
      );

      try {
        const res = await askCopilot({ sessionId, question, requestId });
        if (res.session) {
          const created = res.session;
          setSessions((prev) => [created, ...prev]);
          window.history.replaceState(null, '', `/ai?c=${created.id}`);
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
        if (res.reply) setTypingId(res.reply.id);
        const made = res.practice;
        if (made) setPractices((prev) => [made, ...prev.filter((p) => p.id !== made.id)]);
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
              href={`/ai?c=${s.id}`}
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

  const practiceList = (
    <nav aria-label="Your practices" className="flex flex-col gap-0.5">
      {practices.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Ask me to quiz you on a topic and the practice appears here.</p>
      ) : (
        practices.slice(0, 12).map((p) => (
          <Link
            key={p.id}
            href={practiceHref(p.id)}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground/85 group-hover:text-foreground">{p.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {p.itemCount} questions · {p.attempts ? `${p.attempts} ${p.attempts === 1 ? 'try' : 'tries'}` : 'not taken yet'}
              </span>
            </span>
            {p.bestScore !== null && (
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums', scoreClass(p.bestScore))}>
                {p.bestScore}%
              </span>
            )}
          </Link>
        ))
      )}
    </nav>
  );
  const findPractice = (id: string) => practices.find((p) => p.id === id) ?? null;
  const isEmpty = messages.length === 0 && !waitingFor;
  const statusDot = !panel.provider.ready ? 'bg-destructive' : panel.provider.offline ? 'bg-orange-500' : 'bg-success';

  return (
    <div className="flex h-full min-h-0">
      {/* Past chats and practices: a rail from lg up, a dialog below. */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/60 bg-card/40 lg:flex">
        <div className="p-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={startNewChat}>
            <MessageSquarePlus className="size-4" /> New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 pb-4">
          <section>
            <h2 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Chats</h2>
            {sessionList}
          </section>
          <section>
            <div className="flex items-center justify-between px-3 pb-1">
              <h2 className="text-xs font-semibold text-muted-foreground">Practices</h2>
              <Link href="/ai/practices" className="text-xs font-medium text-primary hover:underline">
                All and scores
              </Link>
            </div>
            {practiceList}
          </section>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header data-tour="ask-intro" className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <AiLogo size={32} thinking={Boolean(waitingFor) || Boolean(typingId)} />
            <div className="min-w-0">
              <h1 className="font-heading text-base font-bold leading-tight text-foreground">Study</h1>
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
              <History className="size-4" /> Chats & practices
            </Button>
            <Button variant="outline" size="sm" onClick={startNewChat} className="gap-1.5 lg:hidden" aria-label="New chat">
              <MessageSquarePlus className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden gap-1.5 lg:inline-flex">
              <Link href="/ai/practices">
                <BrainCircuit className="size-4" /> Practices and scores
              </Link>
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
                  findPractice={findPractice}
                  typing={m.id === typingId}
                  onTyped={() => setTypingId((current) => (current === m.id ? null : current))}
                  onGrow={followThread}
                  onRetry={m.role === 'user' && m.status === 'FAILED' && m.requestId && canAsk && !waitingFor ? () => void send(m.content, m.requestId!) : undefined}
                />
              ))
            )}

            {waitingFor && (
              <div className="flex items-center gap-3">
                <AiLogo size={32} thinking />
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
                  placeholder="Ask anything, or say “quiz me on …” to get a practice"
                  className="field-sizing-content max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
                <Button type="submit" size="icon" aria-label="Send" disabled={Boolean(waitingFor) || !draft.trim()} className="size-10 shrink-0 rounded-xl">
                  <ArrowUp className="size-5" />
                </Button>
              </form>
            )}
            <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
              Enter to send · Shift+Enter for a new line · AI can be wrong; check what matters.
            </p>
          </div>
        </div>
      </section>

      <Dialog open={chatsOpen} onOpenChange={setChatsOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chats and practices</DialogTitle>
            <DialogDescription className="sr-only">Open a past conversation or a practice.</DialogDescription>
          </DialogHeader>
          <section className="space-y-1">
            <h2 className="px-3 text-xs font-semibold text-muted-foreground">Chats</h2>
            {sessionList}
          </section>
          <section className="space-y-1">
            <div className="flex items-center justify-between px-3">
              <h2 className="text-xs font-semibold text-muted-foreground">Practices</h2>
              <Link href="/ai/practices" className="text-xs font-medium text-primary hover:underline">
                All and scores
              </Link>
            </div>
            {practiceList}
          </section>
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


/** A practice set the AI made: what it is, its best score, and Start. */
function PracticeCard({ practice }: { practice: StudySetSummary | null }) {
  if (!practice) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        This practice was deleted.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BrainCircuit className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{practice.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {practice.subject} · {practice.itemCount} questions
          {practice.attempts > 0 ? ` · ${practice.attempts} ${practice.attempts === 1 ? 'try' : 'tries'}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {practice.bestScore !== null && (
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums', scoreClass(practice.bestScore))}>
            Best {practice.bestScore}%
          </span>
        )}
        <Button asChild size="sm" className="gap-1.5">
          <Link href={practiceHref(practice.id)}>
            {practice.attempts > 0 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
            {practice.attempts > 0 ? 'Try again' : 'Start'}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MessageView({
  message,
  onRetry,
  findPractice,
  typing = false,
  onTyped,
  onGrow,
}: {
  message: CopilotMessage;
  onRetry?: () => void;
  findPractice: (id: string) => StudySetSummary | null;
  /** Type this reply out (it just arrived). */
  typing?: boolean;
  onTyped?: () => void;
  onGrow?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isReply = message.role !== 'user';
  const { shown, done, finish } = useTypewriter(message.content, typing && isReply);

  useEffect(() => {
    if (!typing || !isReply) return;
    if (done) onTyped?.();
    else onGrow?.();
  }, [shown, done, typing, isReply, onTyped, onGrow]);

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
      <AiLogo size={32} thinking={!done} className="mt-0.5" />
      <div className="min-w-0 flex-1 pt-0.5">
        {done ? (
          <ChatMarkdown>{linkCitations(message.content, message.sources)}</ChatMarkdown>
        ) : (
          // Click to show the rest at once. Screen readers get the whole
          // reply once instead of every step of the animation.
          <div onClick={finish} className="cursor-text">
            <span className="sr-only">{message.content}</span>
            <div aria-hidden="true">
              <ChatMarkdown className="ai-typing">{linkCitations(shown, message.sources)}</ChatMarkdown>
            </div>
          </div>
        )}
        {done && message.practiceIds.map((id) => (
          <PracticeCard key={id} practice={findPractice(id)} />
        ))}
        {done && message.sources.length > 0 && (
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
        {done && (
        <Button variant="ghost" size="sm" onClick={copy} className="mt-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        )}
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
        <AiLogo size={56} className="mx-auto drop-shadow-[0_10px_24px_color-mix(in_oklch,var(--primary)_35%,transparent)]" />
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">What are we working on?</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Ask about any topic, your marks or your deadlines. Say “quiz me on …” and I will make a practice you can
          take here, with your score saved.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { label: 'Make me a practice', prompt: 'Make me a 10-question practice on my weakest subject.' },
          ...suggestions.slice(0, 3),
        ].map((s) => (
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
