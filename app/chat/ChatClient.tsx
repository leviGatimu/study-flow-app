'use client';

/**
 * Chat.
 *
 * Two panes on a wide screen, one at a time on a phone: the list of
 * conversations, and the thread you have open. Nothing clever - a chat that
 * surprises you is a chat you stop using.
 *
 * NEW MESSAGES ARRIVE BY POLLING, and that is a deliberate choice rather than a
 * shortcut. A websocket needs a server that holds connections; this app is
 * deployed as ordinary serverless routes and also runs as a desktop shell
 * against localhost. Polling every few seconds is unfashionable, survives both,
 * and costs one small indexed query. It only runs while the tab is actually
 * visible, so a forgotten background tab is not asking anything.
 *
 * The share cards are the reason this exists at all: a timetable or a note
 * arrives as something to READ, with an import button underneath. Nothing is
 * written into your account until you press it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  FileText,
  Loader2,
  LogOut,
  MessageSquarePlus,
  Search,
  Share2,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DAY_NAMES, weekdayOrder } from '@/lib/school';
import type { ChatMessageView, ChatPerson, ChatSummary } from '@/lib/chat-actions';
import {
  createGroupChat,
  getMessages,
  getShare,
  getShareables,
  importSharedNote,
  importSharedTimetable,
  leaveConversation,
  listConversations,
  markConversationRead,
  openDirectChat,
  sendMessage,
  shareNote,
  shareTimetable,
} from '@/lib/chat-actions';

/** How often an open thread asks for anything new. */
const POLL_MS = 4000;

export function ChatClient({
  me,
  initialConversations,
  people,
}: {
  me: { id: string; username: string };
  initialConversations: ChatSummary[];
  people: ChatPerson[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const active = conversations.find((c) => c.id === openId) ?? null;

  const refreshList = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  const open = useCallback(
    async (id: string) => {
      setOpenId(id);
      await markConversationRead(id);
      setConversations((current) =>
        current.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
      );
      router.refresh();
    },
    [router]
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col px-4 md:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-border/40 py-5">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight">Chat</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Everyone on Study Flow. Share a timetable or a set of notes without leaving the app.
          </p>
        </div>
        <Button size="sm" onClick={() => setNewChatOpen(true)}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 py-5 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* The list. Hidden on a phone once a thread is open. */}
        <aside className={cn('min-h-0 overflow-y-auto', active && 'hidden md:block')}>
          {conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
              <p className="text-sm font-bold">No conversations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start one with anybody on this deployment.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setNewChatOpen(true)}>
                Start a chat
              </Button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void open(c.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                      c.id === openId
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 bg-card hover:border-primary/30'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black',
                        c.kind === 'GROUP'
                          ? 'bg-violet-500/15 text-violet-500'
                          : 'bg-primary/15 text-primary'
                      )}
                    >
                      {c.kind === 'GROUP' ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        c.title.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{c.title}</span>
                        {c.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
                            {c.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {c.lastMessage
                          ? `${c.lastMessage.senderId === me.id ? 'You: ' : ''}${c.lastMessage.body}`
                          : 'No messages yet'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* The thread. */}
        <section className={cn('min-h-0', !active && 'hidden md:block')}>
          {active ? (
            <Thread
              key={active.id}
              me={me}
              conversation={active}
              onBack={() => setOpenId(null)}
              onChanged={refreshList}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60">
              <p className="text-sm text-muted-foreground">Pick a conversation.</p>
            </div>
          )}
        </section>
      </div>

      <NewChatDialog
        open={newChatOpen}
        people={people}
        onClose={() => setNewChatOpen(false)}
        onOpened={async (id) => {
          setNewChatOpen(false);
          await refreshList();
          void open(id);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- thread */

function Thread({
  me,
  conversation,
  onBack,
  onChanged,
}: {
  me: { id: string; username: string };
  conversation: ChatSummary;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (incremental: boolean) => {
      const rows = await getMessages(
        conversation.id,
        incremental ? lastIdRef.current : undefined
      );
      if (rows.length === 0 && incremental) return;

      setMessages((current) => {
        const next = incremental ? [...current, ...rows] : rows;
        lastIdRef.current = next[next.length - 1]?.id;
        return next;
      });
      if (!incremental) setLoading(false);
    },
    [conversation.id]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Poll only while the tab is on screen. A forgotten background tab should not
  // be asking the database anything.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const res = await sendMessage(conversation.id, text);
    setSending(false);
    if (res?.error) {
      toast.error(res.error);
      setDraft(text);
      return;
    }
    await load(true);
    await onChanged();
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card">
      <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button variant="ghost" size="icon-xs" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{conversation.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.kind === 'GROUP'
              ? conversation.members.map((m) => m.name).join(', ')
              : '@' + (conversation.members.find((m) => m.id !== me.id)?.username ?? '')}
          </p>
        </div>
        {conversation.kind === 'GROUP' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const res = await leaveConversation(conversation.id);
              if (res?.error) toast.error(res.error);
              else {
                toast.success('You left the group.');
                onBack();
                await onChanged();
                router.refresh();
              }
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </Button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing here yet. Say something.
          </p>
        ) : (
          messages.map((m, i) => (
            <MessageRow
              key={m.id}
              message={m}
              mine={m.senderId === me.id}
              showSender={
                conversation.kind === 'GROUP' &&
                m.senderId !== me.id &&
                messages[i - 1]?.senderId !== m.senderId
              }
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => setShareOpen(true)}
            aria-label="Share something"
            title="Share your timetable or a note"
          >
            <Share2 className="h-4 w-4" />
          </Button>
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
            placeholder="Message…"
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-border/60 bg-background px-4 py-2 text-sm outline-none transition-colors focus:border-primary/50"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full"
            disabled={sending || !draft.trim()}
            onClick={() => void send()}
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        conversationId={conversation.id}
        onClose={() => setShareOpen(false)}
        onSent={async () => {
          setShareOpen(false);
          await load(true);
          await onChanged();
        }}
      />
    </div>
  );
}

function MessageRow({
  message,
  mine,
  showSender,
}: {
  message: ChatMessageView;
  mine: boolean;
  showSender: boolean;
}) {
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {showSender && (
        <span className="mb-1 px-1 text-[11px] font-bold text-muted-foreground">
          {message.senderName}
        </span>
      )}
      {message.body && (
        <p
          className={cn(
            'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
            mine
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-muted text-foreground'
          )}
        >
          {message.body}
        </p>
      )}
      {message.share && <ShareCard message={message} mine={mine} />}
      <span className="mt-1 px-1 text-[10px] text-muted-foreground">
        {new Date(message.createdAt).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}

/**
 * A shared timetable or note: read it first, import it only if you want it.
 *
 * The preview is fetched on demand rather than shipped with every message,
 * because a thread with twenty shared notes in it would otherwise carry twenty
 * documents to the browser to render twenty collapsed cards.
 */
function ShareCard({ message, mine }: { message: ChatMessageView; mine: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const share = message.share!;
  const Icon = share.kind === 'TIMETABLE' ? CalendarDays : FileText;

  const expand = async () => {
    setExpanded((v) => !v);
    if (payload === null) {
      setLoading(true);
      const full = await getShare(message.id);
      setPayload(full?.payload ?? null);
      setLoading(false);
    }
  };

  const doImport = async () => {
    setImporting(true);
    const res =
      share.kind === 'TIMETABLE'
        ? await importSharedTimetable(message.id)
        : await importSharedNote(message.id);
    setImporting(false);

    if ('error' in res && res.error) {
      toast.error(res.error);
      return;
    }
    setImported(true);
    if (share.kind === 'TIMETABLE' && 'added' in res) {
      const added = res.added ?? 0;
      const skipped = res.skipped ?? 0;
      toast.success(
        added > 0
          ? `Added ${added} block${added === 1 ? '' : 's'} to your week.${
              skipped ? ` ${skipped} you already had.` : ''
            }`
          : 'You already had all of those blocks.'
      );
    } else if ('appended' in res) {
      toast.success(
        res.appended
          ? `Added to your existing ${res.subject} notes.`
          : `Saved as your ${res.subject} notes.`
      );
    }
    router.refresh();
  };

  return (
    <div
      className={cn(
        'mt-1 w-full max-w-[80%] overflow-hidden rounded-2xl border',
        mine ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background'
      )}
    >
      <button
        type="button"
        onClick={expand}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{share.title}</span>
          <span className="block text-xs text-muted-foreground">
            {share.kind === 'TIMETABLE' ? 'Weekly timetable' : 'Notes'}
            {share.summary ? ` · ${share.summary}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-primary">
          {expanded ? 'Hide' : 'View'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-3">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </p>
          ) : share.kind === 'TIMETABLE' ? (
            <TimetablePreview payload={payload} />
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {String((payload as { content?: string })?.content ?? '(empty)')}
            </pre>
          )}

          {!mine && (
            <Button
              size="sm"
              className="mt-3 w-full"
              disabled={importing || imported}
              onClick={() => void doImport()}
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : imported ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {imported
                ? 'Added'
                : share.kind === 'TIMETABLE'
                  ? 'Add these to my week'
                  : 'Save to my notes'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TimetablePreview({ payload }: { payload: unknown }) {
  const blocks = (payload as { blocks?: Record<string, unknown>[] })?.blocks ?? [];
  if (blocks.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing in it.</p>;
  }

  const byDay = new Map<number, Record<string, unknown>[]>();
  for (const b of blocks) {
    const day = Number(b.dayOfWeek);
    byDay.set(day, [...(byDay.get(day) ?? []), b]);
  }
  const days = [...byDay.keys()].sort((a, b) => weekdayOrder(a) - weekdayOrder(b));

  return (
    <div className="max-h-64 space-y-3 overflow-auto">
      {days.map((day) => (
        <div key={day}>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            {DAY_NAMES[day]}
          </p>
          <ul className="mt-1 space-y-1">
            {(byDay.get(day) ?? []).map((b, i) => (
              <li
                key={`${day}-${i}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border-l-2 bg-muted/40 px-2.5 py-1 text-xs',
                  b.type === 'REVISION' ? 'border-l-orange-500' : 'border-l-blue-500'
                )}
              >
                <span className="font-semibold">{String(b.subject)}</span>
                <span className="text-muted-foreground">
                  {String(b.startTime)}–{String(b.endTime)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ dialogs */

function ShareDialog({
  open,
  conversationId,
  onClose,
  onSent,
}: {
  open: boolean;
  conversationId: string;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getShareables>> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getShareables().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const run = async (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setNote('');
    await onSent();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share something</DialogTitle>
          <DialogDescription>
            They see a preview and choose whether to add it. Nothing lands in their account on its
            own.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Say something about it (optional)"
          className="h-10"
        />

        {!data ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking at what you have…
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Your weekly timetable
              </p>
              {data.timetable.count === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  You have not set one up yet.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => shareTimetable(conversationId, note))}
                  className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">My weekly timetable</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {data.timetable.count} blocks · {data.timetable.subjects.join(', ')}
                    </span>
                  </span>
                </button>
              )}
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Your notes
              </p>
              {data.notes.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  You have not written any subject notes yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.notes.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => shareNote(conversationId, n.id, note))}
                        className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/40 disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{n.subject}</span>
                          <span className="block text-xs text-muted-foreground">
                            {n.words} words
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewChatDialog({
  open,
  people,
  onClose,
  onOpened,
}: {
  open: boolean;
  people: ChatPerson[];
  onClose: () => void;
  onOpened: (conversationId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) => p.username.toLowerCase().includes(q) || (p.name ?? '').toLowerCase().includes(q)
    );
  }, [people, query]);

  const start = async (personId: string) => {
    setBusy(true);
    const res = await openDirectChat(personId);
    setBusy(false);
    if ('error' in res) {
      toast.error(res.error!);
      return;
    }
    await onOpened(res.conversationId!);
  };

  const createGroup = async () => {
    setBusy(true);
    const res = await createGroupChat({ title: groupName, memberIds: selected });
    setBusy(false);
    if ('error' in res) {
      toast.error(res.error!);
      return;
    }
    setGroupName('');
    setSelected([]);
    setGroupMode(false);
    await onOpened(res.conversationId!);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{groupMode ? 'New group' : 'New chat'}</DialogTitle>
          <DialogDescription>
            {groupMode
              ? 'Name it and pick who is in it.'
              : 'Everyone with an account on this deployment.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={groupMode ? 'outline' : 'default'}
            size="sm"
            onClick={() => setGroupMode(false)}
          >
            One person
          </Button>
          <Button
            variant={groupMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupMode(true)}
          >
            <Users className="h-3.5 w-3.5" />
            Group
          </Button>
        </div>

        {groupMode && (
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name — e.g. Physics revision"
            className="h-10"
          />
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="h-10 pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {people.length === 0 ? 'Nobody else has an account yet.' : 'No one by that name.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((p) => {
              const picked = selected.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      groupMode
                        ? setSelected((cur) =>
                            picked ? cur.filter((id) => id !== p.id) : [...cur, p.id]
                          )
                        : void start(p.id)
                    }
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
                      picked ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black">
                      {p.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{p.username}
                      </span>
                    </span>
                    {groupMode && picked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {groupMode && (
          <Button
            className="w-full"
            disabled={busy || !groupName.trim() || selected.length === 0}
            onClick={() => void createGroup()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create group with {selected.length} {selected.length === 1 ? 'person' : 'people'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
