"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, LifeBuoy, Trash2, X } from "lucide-react";

import { CALM_STORAGE, loadJson, saveJson } from "@/lib/calm-tools";
import { mentionsCrisis, quickTalkReply, type TalkMessage } from "@/lib/talk";
import { cn } from "@/lib/utils";

const MAX_KEPT = 40;

function savedChat(): TalkMessage[] {
  const raw = loadJson<unknown>(CALM_STORAGE.talk, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is TalkMessage => !!m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .slice(-MAX_KEPT);
}

/**
 * A listening chat for when the head is too full. Replies stream in word by
 * word from /api/calm/talk; plain greetings are answered at once. The chat is
 * kept on this device only.
 */
export function TalkItOut() {
  // Only mounted after a click, so reading storage while rendering is safe.
  const [messages, setMessages] = useState<TalkMessage[]>(savedChat);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(() => messages.some((m) => m.role === "user" && mentionsCrisis(m.text)));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, waiting]);

  const keep = (next: TalkMessage[]) => saveJson(CALM_STORAGE.talk, next.slice(-MAX_KEPT));

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft("");
    setError(null);
    if (mentionsCrisis(text)) setShowHelp(true);

    const asked: TalkMessage[] = [...messages, { role: "user", text }];
    const quick = quickTalkReply(text, messages.length);
    if (quick) {
      const next: TalkMessage[] = [...asked, { role: "model", text: quick }];
      setMessages(next);
      keep(next);
      return;
    }

    setMessages(asked);
    keep(asked);
    setWaiting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let reply = "";
    try {
      const response = await fetch("/api/calm/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: asked }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The AI is not answering right now. Try again in a minute.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const shown = reply;
        setWaiting(false);
        setMessages([...asked, { role: "model", text: shown }]);
      }
      reply = reply.trim();
      if (!reply) throw new Error("No answer came back. Try again.");
      const next: TalkMessage[] = [...asked, { role: "model", text: reply }];
      setMessages(next);
      keep(next);
    } catch (e) {
      if (controller.signal.aborted) return;
      // Keep whatever arrived before the line dropped.
      if (reply.trim()) keep([...asked, { role: "model", text: reply.trim() }]);
      else setMessages(asked);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setWaiting(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setShowHelp(false);
    setError(null);
    keep([]);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-[min(26rem,calc(100dvh-12rem))] flex-col">
      <div ref={listRef} className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1 pb-2" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="text-sm font-medium">What&apos;s on your mind?</p>
            <p className="text-xs text-muted-foreground">
              Type anything, even just &quot;wassup&quot;. It listens. It&apos;s an AI, not a doctor, and this chat stays on
              this device.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {waiting && (
          <div className="flex justify-start" aria-label="Writing a reply">
            <span className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-3 py-3">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      {showHelp && (
        <div className="mb-2 flex gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100" role="alert">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">
            If you might hurt yourself, please reach out to a real person right now: call your local emergency number, tell
            someone you trust nearby, or find a free helpline at{" "}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="font-medium underline">
              findahelpline.com
            </a>
            . You don&apos;t have to carry this alone.
          </p>
          <button type="button" onClick={() => setShowHelp(false)} aria-label="Hide" className="self-start opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {error && (
        <p className="mb-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:ring-3 focus-within:ring-ring/50"
      >
        <textarea
          ref={inputRef}
          autoFocus
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type how you feel…"
          aria-label="Message"
          className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none field-sizing-content placeholder:text-muted-foreground"
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the chat"
            title="Clear the chat"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!draft.trim() || waiting}
          aria-label="Send"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
