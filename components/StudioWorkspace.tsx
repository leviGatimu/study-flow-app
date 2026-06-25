"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Maximize2,
  Minimize2,
  BrainCircuit,
  X,
  Loader2,
  Send,
  Zap,
  BookOpen,
  Save,
  Eye,
  Pencil,
  Columns2,
  PanelLeft,
  PanelRight,
  Play,
  Pause,
  RotateCcw,
  Sun,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveStudioNote } from "@/lib/studio-actions";
import { askAIBuddy } from "@/lib/ai-actions";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

interface StudioWorkspaceProps {
  subject: string;
  initialContent: string;
  resources: any[];
}

type LayoutMode = "split" | "pdf" | "notes";
type EditorMode = "write" | "preview";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export function StudioWorkspace({ subject, initialContent, resources }: StudioWorkspaceProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [activePdf, setActivePdf] = useState(resources[0]?.url || "");
  const [layout, setLayout] = useState<LayoutMode>(resources.length > 0 ? "split" : "notes");
  const [editorMode, setEditorMode] = useState<EditorMode>("write");
  const [invertPdf, setInvertPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pomodoro timer
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);

  // AI Chat State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // ---- Saving (debounced autosave + manual) ----
  const doSave = useCallback(async () => {
    setIsSaving(true);
    await saveStudioNote(subject, content);
    setIsSaving(false);
    setSavedAt(new Date());
  }, [subject, content]);

  useEffect(() => {
    if (content === initialContent) return;
    const timer = setTimeout(doSave, 1500);
    return () => clearTimeout(timer);
  }, [content, initialContent, doSave]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  // ---- Pomodoro tick ----
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          const nextMode = timerMode === "focus" ? "break" : "focus";
          setTimerMode(nextMode);
          return nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerMode]);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerMode("focus");
    setSecondsLeft(FOCUS_SECONDS);
  };
  const mmss = `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  // ---- Fullscreen ----
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  };

  // ---- Layout cycle ----
  const cycleLayout = () => {
    setLayout((l) => (l === "split" ? "notes" : l === "notes" ? "pdf" : "split"));
  };

  // ---- Resizer ----
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(80, Math.max(20, next)));
  }, []);
  useEffect(() => {
    if (!isResizing) return;
    const up = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", up);
    // Block text selection while dragging.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isResizing, handleMouseMove]);

  // ---- AI ----
  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiMessages, isAiLoading]);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;

    const q = aiQuery;
    setAiMessages((prev) => [...prev, { role: "user", parts: [{ text: q }] }]);
    setAiQuery("");
    setIsAiLoading(true);

    const systemContext = `You are a focused study assistant helping the student study "${subject}". Below are their current notes for context (may be empty). Use them when relevant, answer concisely, and format with Markdown.\n\nCURRENT NOTES:\n"""\n${content.slice(0, 4000)}\n"""`;

    try {
      const res = await askAIBuddy(q, aiMessages, undefined, undefined, systemContext);
      if (res.text) {
        setAiMessages((prev) => [...prev, { role: "model", parts: [{ text: res.text }] }]);
      }
    } catch (err) {
      console.error(err);
      setAiMessages((prev) => [...prev, { role: "model", parts: [{ text: "Something went wrong. Check your AI key in Settings." }] }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const insertIntoNotes = (text: string) => {
    setContent((c) => (c.trim() ? `${c}\n\n${text}` : text));
    setEditorMode("write");
  };

  return (
    <div ref={containerRef} className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-50 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/resources/${encodeURIComponent(subject)}`}>
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10 rounded-full h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 shrink-0">Studio</span>
            <h1 className="text-sm font-black tracking-wider uppercase truncate">{subject}</h1>
          </div>
        </div>

        {/* Pomodoro */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-4 pr-1.5 py-1.5">
          <span className={cn("text-[9px] font-black uppercase tracking-widest", timerMode === "focus" ? "text-primary" : "text-emerald-400")}>
            {timerMode}
          </span>
          <span className="text-base font-heading font-black tabular-nums tracking-wider w-[52px] text-center">{mmss}</span>
          <Button onClick={() => setTimerRunning((r) => !r)} variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10 text-white/80">
            {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button onClick={resetTimer} variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10 text-white/40">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {resources.length > 1 && layout !== "notes" && (
            <div className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {resources.map((res, i) => (
                <button
                  key={res.id}
                  onClick={() => setActivePdf(res.url)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activePdf === res.url ? "bg-primary text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  Source {i + 1}
                </button>
              ))}
            </div>
          )}

          <button onClick={doSave} className="flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-white/80 transition-colors">
            {isSaving ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
            ) : (
              <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {savedAt ? "Saved" : "Autosave on"}</>
            )}
          </button>

          <Button onClick={() => setIsAiOpen((o) => !o)} size="sm" className="rounded-full bg-white text-black hover:bg-white/90 gap-2 font-black text-[10px] tracking-widest uppercase h-9 px-4">
            <BrainCircuit className="w-3.5 h-3.5" />
            AI
          </Button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="flex-1 flex relative min-h-0">
        {/* Drag overlay — captures the cursor so the iframe can't swallow mousemove while resizing */}
        {isResizing && <div className="absolute inset-0 z-[95] cursor-col-resize" />}
        {/* PDF */}
        {layout !== "notes" && (
          <div
            style={{ width: layout === "split" ? `${leftWidth}%` : "100%" }}
            className="h-full bg-[#141414] relative overflow-hidden shrink-0"
          >
            {activePdf ? (
              <iframe
                src={`${activePdf}#toolbar=0&navpanes=0&view=FitH`}
                className={cn("w-full h-full border-none transition-all", invertPdf && "invert hue-rotate-180", isResizing && "pointer-events-none")}
                title="Study Material"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="p-8 bg-white/5 rounded-[40px] border border-white/10">
                  <BookOpen className="w-16 h-16 text-white/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-black">No source material</h3>
                  <p className="text-white/40 text-sm max-w-xs">Upload a PDF to this subject in Resources to view it side-by-side.</p>
                </div>
              </div>
            )}

            {activePdf && (
              <button
                onClick={() => setInvertPdf((v) => !v)}
                className={cn(
                  "absolute top-3 right-3 h-9 w-9 rounded-xl flex items-center justify-center border backdrop-blur-md transition-all",
                  invertPdf ? "bg-primary border-primary text-white" : "bg-black/50 border-white/10 text-white/50 hover:text-white"
                )}
                title="Toggle dark/night reading"
              >
                <Sun className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Divider */}
        {layout === "split" && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className={cn(
              "w-1.5 hover:w-2 bg-white/5 hover:bg-primary cursor-col-resize transition-all duration-200 relative z-20 shrink-0",
              isResizing && "bg-primary w-2"
            )}
          />
        )}

        {/* NOTES */}
        {layout !== "pdf" && (
          <div className="h-full bg-black relative flex flex-col flex-1 min-w-0">
            {/* Notes toolbar */}
            <div className="h-11 shrink-0 border-b border-white/5 flex items-center justify-between px-4 select-none">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => setEditorMode("write")}
                  className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                    editorMode === "write" ? "bg-primary text-white" : "text-white/40 hover:text-white")}
                >
                  <Pencil className="w-3 h-3" /> Write
                </button>
                <button
                  onClick={() => setEditorMode("preview")}
                  className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                    editorMode === "preview" ? "bg-primary text-white" : "text-white/40 hover:text-white")}
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                <span>{wordCount} words</span>
                <span>{content.length} chars</span>
              </div>
            </div>

            {editorMode === "write" ? (
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your notes here… Markdown supported (# headings, **bold**, - lists, `code`)."
                className="flex-1 w-full p-8 md:p-12 bg-transparent border-none focus-visible:ring-0 text-lg font-medium leading-relaxed text-white/85 resize-none custom-scrollbar placeholder:text-white/15 selection:bg-primary/40"
                spellCheck={false}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                {content.trim() ? (
                  <article className="prose prose-invert max-w-3xl prose-headings:font-heading prose-headings:font-black prose-p:text-white/80 prose-li:text-white/80 prose-strong:text-white prose-code:text-primary leading-relaxed">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-white/20 text-sm font-medium italic">Nothing to preview yet. Switch to Write and start typing.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI ASSISTANT */}
        <AnimatePresence>
          {isAiOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.97 }}
              className="absolute right-4 top-4 bottom-4 w-[380px] max-w-[calc(100vw-2rem)] z-[100] flex flex-col bg-[#0f0f0f]/95 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-2xl shadow-black/60 overflow-hidden"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-white text-black flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1 text-white">Study Assistant</p>
                    <p className="text-[10px] font-bold text-white/40">Knows your {subject} notes</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsAiOpen(false)} className="rounded-full hover:bg-white/10">
                  <X className="w-5 h-5 text-white/60" />
                </Button>
              </div>

              <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                {aiMessages.length === 0 && !isAiLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-3">
                    <Zap className="w-10 h-10" />
                    <p className="text-xs font-medium max-w-[220px]">Ask about your notes or the source material — answers can be inserted straight into your notes.</p>
                  </div>
                )}
                {aiMessages.map((m, i) => {
                  const text = m.parts[0].text as string;
                  const isUser = m.role === "user";
                  return (
                    <div key={i} className={cn("rounded-2xl text-sm leading-relaxed", isUser ? "bg-primary text-white ml-6 p-3.5 font-medium" : "bg-white/5 text-white/85 mr-2 p-3.5 border border-white/10")}>
                      {isUser ? (
                        text
                      ) : (
                        <>
                          <article className="prose prose-invert prose-sm max-w-none prose-p:text-white/85 prose-code:text-primary prose-headings:text-white">
                            <ReactMarkdown>{text}</ReactMarkdown>
                          </article>
                          <button
                            onClick={() => insertIntoNotes(text)}
                            className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                          >
                            <CornerDownLeft className="w-3 h-3" /> Insert into notes
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {isAiLoading && (
                  <div className="flex items-center gap-3 text-white/40 text-xs font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                  </div>
                )}
              </div>

              <form onSubmit={handleAiSubmit} className="p-4 bg-black/40 border-t border-white/5 shrink-0">
                <div className="relative">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Ask anything…"
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 pr-12 text-sm font-bold focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-white placeholder:text-white/20"
                  />
                  <button type="submit" disabled={isAiLoading} className="absolute right-1.5 top-1.5 h-9 w-9 bg-white rounded-xl flex items-center justify-center text-black hover:bg-primary hover:text-white transition-all disabled:opacity-40">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM HUD — now functional */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 select-none">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          {([
            { mode: "pdf" as LayoutMode, icon: PanelLeft, label: "PDF" },
            { mode: "split" as LayoutMode, icon: Columns2, label: "Split" },
            { mode: "notes" as LayoutMode, icon: PanelRight, label: "Notes" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              disabled={mode !== "notes" && !activePdf}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 h-9 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-25 disabled:cursor-not-allowed",
                layout === mode ? "bg-primary text-white" : "text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 rounded-full px-4 h-9 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullscreen ? "Exit" : "Full"}
          </button>
        </div>
      </div>
    </div>
  );
}
