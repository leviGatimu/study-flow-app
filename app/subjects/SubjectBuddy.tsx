"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { AiLogo } from "@/components/ai/AiLogo";
import { useTypewriter } from "@/components/ai/useTypewriter";
import { askAIBuddy } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";
import { upcomingExams, type ExamEvent, type Homework, type MasteryItem } from "./subject-model";

const NOTE_CONTEXT_LIMIT = 8000;

export type BuddyMessage = { role: "user" | "model"; text: string };

/** The chat's opening line, before anything has been asked. */
export function buddyGreeting(subject: string): BuddyMessage[] {
  return [
    {
      role: "model",
      text: `Ask me anything about **${subject}**. I can see its syllabus topics, open homework and coming exams, so I can explain a topic, quiz you, or suggest what to revise next.`,
    },
  ];
}

const SUGGESTIONS = [
  { label: "Quiz me", prompt: "Quiz me with 5 active recall questions on my topics for this subject." },
  { label: "What should I revise next?", prompt: "Given my topics, homework and exams, what should I revise next and why?" },
  { label: "Explain a weak topic", prompt: "Pick a topic I have not mastered yet and explain it simply." },
];

/**
 * A chat that already knows this subject: its syllabus, open homework and
 * upcoming exams, rebuilt from live data on every question. The messages are
 * owned by the caller so the conversation survives the drawer closing.
 */
export function SubjectBuddy({
  subject,
  mastery,
  homeworks,
  exams,
  note,
  messages,
  setMessages,
}: {
  subject: string;
  messages: BuddyMessage[];
  setMessages: React.Dispatch<React.SetStateAction<BuddyMessage[]>>;
  mastery: MasteryItem[];
  homeworks: Homework[];
  exams: ExamEvent[];
  /** Notes written for this subject before the notes editor moved; context only. */
  note: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  // The reply that just arrived, typed out instead of appearing at once.
  const [typing, setTyping] = useState<BuddyMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view. Scrolls the chat box only - scrollIntoView
  // would also drag the whole page down to the chat.
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const buildPrompt = () => {
    const topics = mastery.length
      ? mastery.map((m) => `- [${m.isCompleted ? "x" : " "}] ${m.title}`).join("\n")
      : "(No syllabus topics listed yet.)";
    const pending = homeworks.filter((h) => !h.isCompleted);
    const homework = pending.length
      ? pending.map((h) => `- ${h.title} (due ${format(new Date(h.dueDate), "EEE d MMM yyyy")})`).join("\n")
      : "(No pending homework.)";
    const coming = upcomingExams(exams);
    const examList = coming.length
      ? coming.map((e) => `- ${e.title} on ${format(new Date(e.date), "EEE d MMM yyyy")}`).join("\n")
      : "(No upcoming exams.)";
    const notes = note.length > NOTE_CONTEXT_LIMIT ? `${note.slice(0, NOTE_CONTEXT_LIMIT)}\n[...notes truncated]` : note;

    return `You are an expert AI Study Coach helping the user pass their exams for the subject: ${subject}.
Today is ${format(new Date(), "EEEE d MMMM yyyy")}.

Syllabus topics ([x] = mastered, [ ] = not yet):
${topics}

Pending homework:
${homework}

Upcoming exams:
${examList}

The user's own notes for this subject:
"""
${notes || "(No notes.)"}
"""

Use this as context. Prioritise topics not yet mastered and anything due or examined soon.
Explain concepts in clear, direct English. Break down tasks into easy steps. Create quizzes, active recall questions, or summaries if asked.`;
  };

  const send = async (preset?: string) => {
    const text = (preset ?? query).trim();
    if (!text || loading) return;

    const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    setMessages((prev) => [...prev, { role: "user", text }]);
    if (!preset) setQuery("");
    setLoading(true);

    try {
      const res = await askAIBuddy(text, history, undefined, undefined, buildPrompt(), { tools: false, xp: false });
      if (res.error) {
        console.error("Study buddy:", res.error);
        setMessages((prev) => [
          ...prev,
          { role: "model", text: "I could not answer that just now. Check your connection and ask again." },
        ]);
      } else if (res.text) {
        const reply: BuddyMessage = { role: "model", text: res.text };
        setTyping(reply);
        setMessages((prev) => [...prev, reply]);
      }
    } catch (err) {
      console.error("Study buddy:", err);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "I could not reach the AI. Check your connection and ask again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">

      <div ref={scrollRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              msg.role === "user"
                ? "self-end rounded-br-md bg-primary text-primary-foreground"
                : "self-start rounded-bl-md bg-muted text-foreground"
            )}
          >
            {msg.role === "user" ? (
              <p className="whitespace-pre-wrap">{msg.text}</p>
            ) : (
              <BuddyReply
                text={msg.text}
                typing={msg === typing}
                onGrow={() => {
                  const box = scrollRef.current;
                  if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 120) box.scrollTop = box.scrollHeight;
                }}
              />
            )}
          </div>
        ))}
        {loading && (
          <div role="status" className="flex max-w-[85%] shrink-0 items-center gap-2 self-start rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <AiLogo size={22} thinking />
            Thinking…
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border/40 p-4">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s.label} type="button" variant="outline" size="sm" onClick={() => send(s.prompt)} disabled={loading}>
              {s.label}
            </Button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Ask about ${subject}`}
            placeholder={`Ask about ${subject}...`}
            disabled={loading}
            className="h-10 flex-1"
          />
          <Button type="submit" size="icon-lg" aria-label="Send" disabled={loading || !query.trim()} className="size-10 shrink-0">
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** A reply in the subject chat; a new one types itself out. */
function BuddyReply({ text, typing, onGrow }: { text: string; typing: boolean; onGrow: () => void }) {
  const { shown, done, finish } = useTypewriter(text, typing);
  useEffect(() => {
    if (typing && !done) onGrow();
  }, [shown, typing, done, onGrow]);

  if (done) return <ChatMarkdown className="text-sm leading-relaxed [&_p]:my-2">{text}</ChatMarkdown>;
  return (
    <div onClick={finish}>
      <span className="sr-only">{text}</span>
      <div aria-hidden="true">
        <ChatMarkdown className="ai-typing text-sm leading-relaxed [&_p]:my-2">{shown}</ChatMarkdown>
      </div>
    </div>
  );
}
