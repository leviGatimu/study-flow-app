"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { BrainCircuit, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { askAIBuddy } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";
import { upcomingExams, type ExamEvent, type Homework, type MasteryItem } from "./subject-model";

const NOTE_CONTEXT_LIMIT = 8000;

type Message = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  { label: "Quiz me", prompt: "Quiz me with 5 active recall questions on my topics for this subject." },
  { label: "What should I revise next?", prompt: "Given my topics, homework and exams, what should I revise next and why?" },
  { label: "Explain a weak topic", prompt: "Pick a topic I have not mastered yet and explain it simply." },
];

/** Escape everything, then allow **bold** and *italics*. */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

/**
 * A chat that already knows this subject: its syllabus, open homework and
 * upcoming exams, rebuilt from live data on every question. Mount it with a
 * key per subject so switching subjects starts a new conversation.
 */
export function SubjectBuddy({
  subject,
  mastery,
  homeworks,
  exams,
  note,
}: {
  subject: string;
  mastery: MasteryItem[];
  homeworks: Homework[];
  exams: ExamEvent[];
  /** Notes written for this subject before the notes editor moved; context only. */
  note: string;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "model",
      text: `Hi! I'm your study buddy for **${subject}**. I can see its syllabus topics, open homework and upcoming exams. Ask me to explain something, quiz you, or plan what to revise next.`,
    },
  ]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
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
      const res = await askAIBuddy(text, history, undefined, undefined, buildPrompt());
      if (res.error) {
        console.error("Study buddy:", res.error);
        setMessages((prev) => [
          ...prev,
          { role: "model", text: "I could not answer that just now. Check your connection and ask again." },
        ]);
      } else if (res.text) {
        setMessages((prev) => [...prev, { role: "model", text: res.text }]);
      }
    } catch (err) {
      console.error("Study buddy:", err);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "I could not reach the study coach. Check your connection and ask again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel padded={false} className="flex h-[32rem] flex-col overflow-hidden">
      <div className="border-b border-border/40 px-6 pt-5">
        <PanelTitle icon={<BrainCircuit />}>Ask about {subject}</PanelTitle>
      </div>

      <div ref={scrollRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
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
            <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
          </div>
        ))}
        {loading && (
          <div className="flex max-w-[85%] shrink-0 items-center gap-2 self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Thinking...
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
    </Panel>
  );
}
