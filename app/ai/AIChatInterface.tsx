"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
  Image as ImageIcon,
  X,
  FileText,
  File as FileIcon,
  Flame,
  CheckCircle2,
  Circle,
  Layout,
  Award,
  Compass,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAIBuddy, createChatSession, deleteChatSession, getChatMessages, saveAIKey, getAIConnectivity } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ReactMarkdown from 'react-markdown';
import { toggleTaskDone } from "@/lib/actions";
import { extractTextFromPdf, extractTextFromDocx } from "@/lib/file-extract";

const PRESET_PROMPTS = [
  { icon: Zap, label: "Deep Focus Study", text: "Create a 2-hour study schedule for Calculus with 5-minute breaks." },
  { icon: BookOpen, label: "Summarize Material", text: "Summarize the key concepts of Networking Fundamentals." },
  { icon: Sparkles, label: "Explain Simply", text: "Explain how a CPU cache works using simple analogies." },
  { icon: Trophy, label: "Quiz Me", text: "Generate 5 multiple-choice questions on Basic Database Design." },
];

const PERSONAS = [
  {
    id: "default",
    name: "Planner",
    title: "Study Planner",
    desc: "Helps plan schedules, structure study time, and organize files.",
    gradient: "from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border-blue-500/30",
    activeBorder: "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    color: "#3b82f6",
    avatarBg: "bg-blue-500",
  },
  {
    id: "socratic",
    name: "Guide",
    title: "Socratic Guide",
    desc: "Helps you learn by asking guiding questions instead of giving answers.",
    gradient: "from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border-purple-500/30",
    activeBorder: "border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]",
    color: "#8b5cf6",
    avatarBg: "bg-purple-500",
  },
  {
    id: "coach",
    name: "Coach",
    title: "Study Coach",
    desc: "Focuses on deadlines, clear feedback, and study discipline.",
    gradient: "from-rose-500/10 to-orange-500/10 hover:from-rose-500/20 hover:to-orange-500/20 border-rose-500/30",
    activeBorder: "border-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    color: "#f43f5e",
    avatarBg: "bg-rose-500",
  },
  {
    id: "encourager",
    name: "Supporter",
    title: "Study Supporter",
    desc: "A warm helper that supports your progress and celebrates finished tasks.",
    gradient: "from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border-emerald-500/30",
    activeBorder: "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    color: "#10b981",
    avatarBg: "bg-emerald-500",
  },
  {
    id: "rpg",
    name: "Tracker",
    title: "Progress Tracker",
    desc: "Tracks study levels, rank progression, and XP milestones.",
    gradient: "from-amber-500/10 to-yellow-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 border-amber-500/30",
    activeBorder: "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    color: "#f59e0b",
    avatarBg: "bg-amber-500",
  }
];

const getRank = (level: number) => {
  if (level <= 10) return { name: "Bronze Rank", color: "text-orange-400" };
  if (level <= 30) return { name: "Silver Rank", color: "text-slate-300" };
  if (level <= 60) return { name: "Gold Rank", color: "text-amber-400" };
  if (level <= 100) return { name: "Platinum Rank", color: "text-cyan-400" };
  return { name: "Diamond Rank", color: "text-indigo-400" };
};

type Session = {
  id: string;
  title: string;
};

type ChatMessage = {
  role: "user" | "model";
  text: string;
  image?: string;
  isTyping?: boolean;
};

type PendingFile = {
  name: string;
  type: 'image' | 'pdf' | 'docx';
  data: string; // base64 for image, extracted text for docs
  preview?: string; // base64 for image preview
};

export function AIChatInterface({
  userName,
  userProgress: initialProgress,
  initialSessions = [],
  initialTasks = [],
  initialPrompt = "",
}: {
  userName: string;
  userProgress: any;
  initialSessions: Session[];
  initialTasks: any[];
  initialPrompt?: string;
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt || "");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState("AI Buddy Ready");
  const [isOffline, setIsOffline] = useState(false);

  // Reflect online/offline state in the status pill. Routing itself is decided
  // server-side in askAIBuddy; this is just a live indicator for the user.
  useEffect(() => {
    let cancelled = false;

    const refreshConnectivity = async () => {
      try {
        const info = await getAIConnectivity();
        if (cancelled) return;
        setIsOffline(!info.online);
        if (info.activeMode === 'ollama') {
          setAiStatus(`Offline • Ollama${info.ollamaModel ? ` (${info.ollamaModel})` : ''}`);
        } else if (info.activeMode === 'cloud') {
          setAiStatus(info.online ? "Online • Cloud AI" : "Cloud AI");
        } else if (!info.online) {
          setAiStatus("Offline • No local model");
        }
      } catch {
        /* leave status as-is */
      }
    };

    refreshConnectivity();
    const onOnline = () => { setIsOffline(false); refreshConnectivity(); };
    const onOffline = () => { setIsOffline(true); refreshConnectivity(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialPrompt]);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upgrade state
  const [userProgress, setUserProgress] = useState(initialProgress);
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [persona, setPersona] = useState<string>("default");
  const [floatingXps, setFloatingXps] = useState<{ id: number; amount: number }[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  // Sync persona configuration on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPersona = localStorage.getItem("study-flow-ai-persona");
      if (savedPersona) setPersona(savedPersona);
    }
  }, []);

  const handlePersonaChange = (newPersona: string) => {
    setPersona(newPersona);
    if (typeof window !== "undefined") {
      localStorage.setItem("study-flow-ai-persona", newPersona);
    }
  };

  useEffect(() => {
    if (!activeSessionId) return;

    const loadMessages = async () => {
      const loaded = await getChatMessages(activeSessionId);
      setMessages(
        loaded.map((message) => ({
          role: message.role === "user" ? "user" : "model",
          text: message.content,
        }))
      );
    };

    loadMessages();
  }, [activeSessionId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleUpdateKey = async (formData: FormData) => {
    const key = formData.get("key") as string;
    if (!key) return;

    const result = await saveAIKey(key);
    if (!result.success) {
      setSettingsError(result.error ?? "Unable to validate this API key.");
      return;
    }

    setAiStatus(`${result.provider} • ${result.model}`);
    setSettingsError(null);
    setIsSettingsOpen(false);
  };

  const handleNewChat = async () => {
    const session = await createChatSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setMessages([]);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleDeleteSession = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    await deleteChatSession(id);
    setSessions((current) => current.filter((session) => session.id !== id));

    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const startTypingAnimation = (fullText: string) => {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
    }

    setMessages((current) => [...current, { role: "model", text: "", isTyping: true }]);

    let currentIndex = 0;
    const step = fullText.length > 500 ? 8 : fullText.length > 200 ? 5 : 3;

    typingTimerRef.current = window.setInterval(() => {
      currentIndex = Math.min(currentIndex + step, fullText.length);

      setMessages((current) => {
        const newMessages = [...current];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.role === 'model') {
          lastMsg.text = fullText.slice(0, currentIndex);
          lastMsg.isTyping = currentIndex < fullText.length;
        }
        return newMessages;
      });

      if (currentIndex >= fullText.length && typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }, 15);
  };

  const processFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPendingFiles(prev => [...prev, { name: file.name, type: 'image', data: base64, preview: base64 }]);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      try {
        const text = await extractTextFromPdf(file);
        setPendingFiles(prev => [...prev, { name: file.name, type: 'pdf', data: text }]);
      } catch (e) {
        console.error("PDF Extraction failed", e);
      }
    } else if (file.name.endsWith('.docx')) {
      try {
        const text = await extractTextFromDocx(file);
        setPendingFiles(prev => [...prev, { name: file.name, type: 'docx', data: text }]);
      } catch (e) {
        console.error("DOCX Extraction failed", e);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await processFile(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) await processFile(file);
      }
    }
  };

  const handleToggleTask = async (taskId: string, isDone: boolean) => {
    // Optimistic toggle
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isDone } : t));
    try {
      await toggleTaskDone(taskId, isDone);
    } catch (e) {
      console.error("Failed to toggle task completion:", e);
      // Revert if database save failed
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isDone: !isDone } : t));
    }
  };

  const seedPromptForTask = (task: any) => {
    const mode = task.type === "REVISION" ? "REVISION" : "HOMEWORK";
    const template = `I'm starting my ${mode} block for ${task.subject} (${task.startTime} - ${task.endTime}). What are the key milestones I should achieve, and can you prepare a custom quiz for me on this subject?`;
    setInput(template);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input.trim();
    if ((!textToSend && pendingFiles.length === 0) || isLoading) return;

    // Combine document text
    let fullPrompt = textToSend;
    const docContext = pendingFiles
      .filter(f => f.type === 'pdf' || f.type === 'docx')
      .map(f => `--- ATTACHED DOCUMENT: ${f.name} ---\n${f.data}`)
      .join('\n\n');
    
    if (docContext) {
      fullPrompt = `${textToSend}\n\n[USER ATTACHED DOCUMENTS]:\n${docContext}`;
    }

    const firstImageFile = pendingFiles.find(f => f.type === 'image');
    const firstImage = firstImageFile ? {
      data: firstImageFile.data,
      mimeType: firstImageFile.data.match(/^data:([^;]+);/)?.[1] || 'image/jpeg'
    } : undefined;
    
    setInput("");
    setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const session = await createChatSession(`${textToSend.slice(0, 30) || "Document Analysis"}...`);
      setSessions((current) => [session, ...current]);
      currentSessionId = session.id;
      setActiveSessionId(session.id);
    }

    const currentMessages = [...messages, { 
      role: "user" as const, 
      text: textToSend || (pendingFiles.length > 0 ? "Analyzed attached documents." : ""), 
      image: firstImageFile?.data 
    }];
    setMessages(currentMessages);
    setIsLoading(true);

    const historyForAPI = messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
      file: message.image ? {
        data: message.image,
        mimeType: message.image.match(/^data:([^;]+);/)?.[1] || 'image/jpeg'
      } : undefined,
    }));

    const PERSONA_PROMPTS: Record<string, string> = {
      default: `You are a helpful study buddy. Help the user plan study time, understand workload, and stay consistent.
Keep your answers in clear, simple, and direct English. Break down tasks into easy steps.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`,

      socratic: `You are a helpful Socratic guide. Do not give direct answers immediately. Instead, ask simple guiding questions to help the user understand and think through the topic themselves.
Keep your tone friendly, simple, and clear.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`,

      coach: `You are a direct, practical study coach. Give straightforward, direct study advice to help the user focus, meet deadlines, and avoid distractions. Keep your answers brief and in plain English.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`,

      encourager: `You are a warm, encouraging study helper. Support the user, celebrate completed tasks, and offer friendly advice to build their confidence. Keep your answers in clear, positive, and simple English.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`,

      rpg: `You are a helpful study buddy who tracks progress. Remind the user that completing tasks helps them gain XP and level up their study level.
Keep your language simple, clean, and focus on steady progress and study habits. Do not use high-fantasy or complex gaming terms.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`
    };

    const systemPromptOverride = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.default;

    const result = await askAIBuddy(fullPrompt, historyForAPI, currentSessionId, firstImage, systemPromptOverride);
    setIsLoading(false);

    if (result.error) {
      setMessages((current) => [...current, { role: "model", text: `Error: ${result.error}` }]);
      return;
    }

    if (result.provider && result.model) {
      setAiStatus(`${result.provider} • ${result.model}`);
    }

    if (result.text) {
      startTypingAnimation(result.text);
    }

    // Trigger gamification update
    if (result.xpInfo) {
      const { xp, newLevel, xpGained } = result.xpInfo;
      setUserProgress((prev: any) => ({
        ...prev,
        xp: xp,
        level: newLevel,
      }));

      // Add a floating bubble
      if (xpGained) {
        const id = Date.now();
        setFloatingXps(prev => [...prev, { id, amount: xpGained }]);
        setTimeout(() => {
          setFloatingXps(prev => prev.filter(item => item.id !== id));
        }, 1800);
      }
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const hasMessages = messages.length > 0;
  const xpNeeded = (userProgress?.level || 1) * 1000;
  const xpPercent = Math.min(((userProgress?.xp || 0) / xpNeeded) * 100, 100);
  const activePersonaObj = PERSONAS.find(p => p.id === persona) || PERSONAS[0];

  return (
    <div 
      className="flex h-full w-full bg-background relative overflow-hidden font-sans text-foreground"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 m-4 rounded-[40px]">
          <div className="text-center pointer-events-none">
            <div className="p-6 bg-primary/10 rounded-full inline-block mb-4 shadow-lg shadow-primary/20">
              <ImageIcon className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-heading font-black tracking-tight text-foreground">Drop files to analyze</h3>
            <p className="text-muted-foreground mt-2 font-medium">Supports Images, PDFs, and Word Documents</p>
          </div>
        </div>
      )}

      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[6000ms]" />
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*,.pdf,.docx" 
        multiple
        className="hidden" 
      />

      {/* Collapsible Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarExpanded ? 280 : 80 }}
        className="relative z-20 h-full shrink-0 border-r border-border/40 bg-card/50 backdrop-blur-xl flex flex-col transition-all duration-300"
      >
        <div className="p-4 flex items-center justify-between h-20 border-b border-border/40 shrink-0">
          {isSidebarExpanded ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 overflow-hidden">
              <div className={cn("p-2 text-white rounded-xl shadow-lg transition-colors duration-500", activePersonaObj.avatarBg)}>
                <BrainCircuit className="h-5 w-5" />
              </div>
              <h2 className="font-heading font-black tracking-tight whitespace-nowrap text-lg">AI Companion</h2>
            </motion.div>
          ) : (
            <div className="w-full flex justify-center">
              <div className={cn("p-2 text-white rounded-xl shadow-lg transition-colors duration-500", activePersonaObj.avatarBg)}>
                <BrainCircuit className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4">
             <Button 
                onClick={handleNewChat} 
                variant={isSidebarExpanded ? "default" : "ghost"}
                className={cn(
                  "w-full rounded-2xl transition-all font-bold shadow-none",
                  isSidebarExpanded ? "justify-start px-4 h-12" : "justify-center px-0 h-12 w-12"
                )}
              >
                <Plus className={cn("h-5 w-5", isSidebarExpanded && "mr-2")} />
                {isSidebarExpanded && "New Thread"}
              </Button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
            {isSidebarExpanded && sessions.length > 0 && (
              <h3 className="mb-2 mt-4 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Chat History</h3>
            )}
            <AnimatePresence>
              {sessions.map((session) => (
                <motion.button
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  title={!isSidebarExpanded ? session.title : undefined}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-xl transition-all duration-200",
                    isSidebarExpanded ? "px-3 py-3" : "justify-center p-3 h-12 w-12 mx-auto",
                    activeSessionId === session.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    {isSidebarExpanded && <span className="truncate text-sm font-semibold">{session.title}</span>}
                  </div>
                  {isSidebarExpanded && (
                    <Trash2
                      className="h-4 w-4 shrink-0 opacity-0 transition-all duration-200 hover:text-destructive group-hover:opacity-100"
                      onClick={(event) => handleDeleteSession(event, session.id)}
                    />
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-border/40 mt-auto flex flex-col gap-2 shrink-0">
             <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className={cn("w-full rounded-xl text-muted-foreground hover:text-foreground", isSidebarExpanded ? "justify-start px-3" : "justify-center px-0")}>
                  <Settings className={cn("h-5 w-5", isSidebarExpanded && "mr-3")} />
                  {isSidebarExpanded && "AI API Key"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-[32px] border-border bg-card p-8 shadow-2xl">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-heading font-black">API Key Settings</DialogTitle>
                </DialogHeader>
                <form action={handleUpdateKey} className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">API Key</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input name="key" type="password" placeholder="Enter your API key..." className="h-14 pl-12 rounded-2xl bg-muted/30 border-border/40 font-mono focus:border-primary" required />
                    </div>
                    {settingsError ? <p className="text-sm text-destructive font-bold">{settingsError}</p> : null}
                  </div>
                  <Button type="submit" className="h-14 w-full rounded-2xl font-black text-lg shadow-lg">Save Settings</Button>
                </form>
              </DialogContent>
             </Dialog>

            <Button 
              variant="ghost" 
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className={cn("w-full rounded-xl text-muted-foreground hover:text-foreground", isSidebarExpanded ? "justify-start px-3" : "justify-center px-0")}
            >
               {isSidebarExpanded ? <ChevronLeft className="h-5 w-5 mr-3" /> : <ChevronRight className="h-5 w-5" />}
               {isSidebarExpanded && "Collapse Panel"}
            </Button>
          </div>
        </div>
      </motion.aside>

      {/* Main Container */}
      <LayoutGroup>
        <main className="relative z-10 flex h-full flex-1 flex-row overflow-hidden">
          
          {/* Central Convo workspace */}
          <div className="flex-1 flex flex-col relative overflow-hidden h-full">
            {/* Header Status */}
            <header className="absolute top-0 w-full h-20 flex items-center justify-between px-6 pointer-events-none z-30">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/40 backdrop-blur-xl border border-border/40 shadow-sm pointer-events-auto">
                 <div className={cn("w-2.5 h-2.5 rounded-full transition-colors duration-500 animate-pulse", isOffline ? "bg-amber-500" : activePersonaObj.avatarBg)} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{aiStatus}</span>
              </div>
              
              <div className="flex items-center gap-2 pointer-events-auto">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  className={cn(
                    "rounded-xl border border-border/40 bg-background/40 backdrop-blur-xl shadow-sm text-muted-foreground hover:text-foreground transition-all duration-300",
                    isSidebarExpanded ? "text-primary border-primary/20" : ""
                  )}
                  title="Toggle Chat Sessions"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                  className={cn(
                    "rounded-xl border border-border/40 bg-background/40 backdrop-blur-xl shadow-sm text-muted-foreground hover:text-foreground transition-all duration-300",
                    isRightPanelOpen ? "text-primary border-primary/20" : ""
                  )}
                  title="Toggle Companion Dashboard"
                >
                  <Layout className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className={cn(
              "flex-1 overflow-y-auto px-4 md:px-10 scroll-smooth custom-scrollbar",
              hasMessages ? "pt-24 pb-32" : "hidden"
            )}>
               <div className="mx-auto w-full max-w-4xl space-y-8">
                  <AnimatePresence initial={false}>
                    {messages.map((message, index) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        key={`${message.role}-${index}`} 
                        className={cn(
                          "flex w-full gap-4 md:gap-6",
                          message.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {/* Avatar */}
                        <div className="shrink-0 mt-1">
                           {message.role === "user" ? (
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background font-black text-xs shadow-md">
                                {userName.slice(0, 1).toUpperCase()}
                              </div>
                           ) : (
                              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg transition-colors duration-500", activePersonaObj.avatarBg)}>
                                <Sparkles className="h-4.5 w-4.5" />
                              </div>
                           )}
                        </div>

                        {/* Text container (No bubble) */}
                        <div className={cn(
                          "max-w-[85%] flex flex-col gap-2",
                          message.role === "user" ? "items-end" : "items-start"
                        )}>
                          {message.image && (
                            <div className={cn("mb-2 flex", message.role === "user" ? "justify-end" : "justify-start")}>
                               <img src={message.image} alt="Analyzed content" className="max-w-[300px] max-h-[300px] rounded-2xl border border-border/40 shadow-md" />
                            </div>
                          )}
                          <div className={cn(
                            "ai-response-bubble text-left leading-relaxed w-full py-1",
                            message.role === "user" 
                              ? "text-foreground font-medium" 
                              : "text-foreground/90"
                          )}>
                            <ReactMarkdown>{message.text}</ReactMarkdown>
                            {message.isTyping && (
                              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && !messages[messages.length - 1]?.isTyping && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex w-full gap-4 md:gap-6 flex-row"
                      >
                        <div className="shrink-0 mt-1">
                           <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg transition-colors duration-500", activePersonaObj.avatarBg)}>
                             <Loader2 className="h-4 w-4 animate-spin" />
                           </div>
                        </div>
                        <div className="flex items-center gap-2 py-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                           <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                           <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} className="h-4" />
               </div>
            </div>

            {/* Empty greeting and Prompt Area */}
            <div className={cn(
              "absolute left-0 right-0 z-30 flex flex-col items-center justify-center pointer-events-none px-4 md:px-10",
              hasMessages ? "bottom-8" : "inset-0"
            )}>
              <motion.div 
                layout
                className="w-full max-w-3xl pointer-events-auto flex flex-col items-center"
              >
                {/* Floating XP Reward Indicator */}
                <AnimatePresence>
                  {floatingXps.map((xp) => (
                    <motion.div
                      key={xp.id}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -40, scale: 1.1 }}
                      exit={{ opacity: 0, y: -80, scale: 0.9 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="absolute z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500 text-black font-black text-xs shadow-xl shadow-yellow-500/20"
                    >
                      <Award className="w-3.5 h-3.5" />
                      +{xp.amount} XP
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty State Greeting */}
                {!hasMessages && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10 w-full"
                  >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tighter mb-4 text-foreground">
                      Hello, <span className="text-primary">{userName}</span>.
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
                      Study buddy persona: <span className="text-foreground font-bold">{activePersonaObj.title}</span>. Let's study!
                    </p>
                  </motion.div>
                )}

                {/* Main input layout */}
                <div className="w-full flex flex-col gap-2">
                  <AnimatePresence>
                    {pendingFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-2 px-2">
                        {pendingFiles.map((file, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="relative group h-20 w-24 rounded-2xl bg-card border border-border/60 overflow-hidden shadow-md flex items-center justify-center"
                          >
                             {file.type === 'image' ? (
                               <img src={file.preview} className="w-full h-full object-cover" alt="Preview" />
                             ) : (
                               <div className="flex flex-col items-center gap-1 p-2 text-center">
                                 {file.type === 'pdf' ? <FileText className="w-6 h-6 text-primary" /> : <FileIcon className="w-6 h-6 text-primary" />}
                                 <span className="text-[10px] font-bold truncate w-full px-1">{file.name}</span>
                                </div>
                             )}
                             <button 
                                type="button"
                                onClick={() => removePendingFile(i)}
                                className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                <X className="w-3 h-3" />
                             </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                  
                  <motion.div 
                    layoutId="input-container"
                    className={cn(
                      "w-full bg-background/80 backdrop-blur-2xl border border-border/60 shadow-2xl relative transition-all duration-300",
                      hasMessages ? "rounded-[24px] p-1.5" : "rounded-[32px] p-3 md:p-4"
                    )}
                  >
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSend();
                      }}
                      className="relative flex items-end gap-3"
                    >
                      <div className="shrink-0 p-1">
                         <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-2xl h-10 w-10 text-muted-foreground hover:text-foreground"
                         >
                            <ImageIcon className="h-5 w-5" />
                         </Button>
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onPaste={handlePaste}
                        placeholder={`Message your ${activePersonaObj.title}...`}
                        className={cn(
                          "flex-1 resize-none border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground custom-scrollbar",
                          hasMessages ? "px-2 py-2.5 min-h-[44px] text-base" : "px-2 py-3 min-h-[56px] text-lg font-medium"
                        )}
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        disabled={isLoading}
                      />
                      <div className="shrink-0 p-1">
                        <Button 
                          type="submit" 
                          size="icon" 
                          className={cn(
                            "rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 duration-200",
                            hasMessages ? "h-10 w-10 bg-foreground text-background" : "h-12 w-12 bg-primary text-primary-foreground shadow-primary/20",
                            activePersonaObj.id !== 'default' && activePersonaObj.avatarBg
                          )}
                          disabled={isLoading || (input.trim().length === 0 && pendingFiles.length === 0)}
                        >
                          <Send className="h-5 w-5" />
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                </div>

                {/* Empty State Prompts */}
                {!hasMessages && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid w-full gap-4 grid-cols-1 md:grid-cols-2 mt-8"
                  >
                    {PRESET_PROMPTS.map((prompt) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={prompt.label}
                          onClick={() => handleSend(prompt.text)}
                          className="group relative overflow-hidden rounded-[20px] border border-border/40 bg-card/60 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground">
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="font-heading font-black text-foreground mb-1 group-hover:text-primary transition-colors text-sm">{prompt.label}</p>
                              <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2">{prompt.text}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Right Companion Dashboard Sidebar */}
          <AnimatePresence>
            {isRightPanelOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="relative z-20 h-full shrink-0 border-l border-border/40 bg-card/30 backdrop-blur-2xl flex flex-col overflow-hidden"
              >
                {/* Stats Dashboard header */}
                <div className="p-4 h-20 border-b border-border/40 shrink-0 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="font-heading font-black tracking-tight text-sm uppercase text-muted-foreground">Study Dashboard</h3>
                    <span className="text-[10px] text-muted-foreground/70">Real-time status sync</span>
                  </div>
                  {/* Streak widget */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black text-xs animate-pulse">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>{userProgress?.currentStreak || 0}d Streak</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                  {/* Gamified Level Card */}
                  <div className="p-4 rounded-2xl border border-border/40 bg-card/60 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Trophy className="w-20 h-20 text-white" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 text-white rounded-xl shadow-lg", activePersonaObj.avatarBg)}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Study Level</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-heading font-black text-foreground">Level {userProgress?.level || 1}</span>
                          <span className={cn("text-xs font-semibold", getRank(userProgress?.level || 1).color)}>
                            {getRank(userProgress?.level || 1).name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        <span>XP Progress</span>
                        <span>{userProgress?.xp || 0} / {xpNeeded} XP</span>
                      </div>
                      <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden relative border border-border/20">
                        <motion.div 
                          className={cn("h-full bg-gradient-to-r shadow-md transition-colors duration-500", 
                            persona === 'rpg' ? "from-yellow-500 to-amber-500 shadow-yellow-500/20" :
                            persona === 'coach' ? "from-rose-500 to-orange-500 shadow-rose-500/20" :
                            persona === 'socratic' ? "from-purple-500 to-indigo-500 shadow-purple-500/20" :
                            persona === 'encourager' ? "from-emerald-500 to-teal-500 shadow-emerald-500/20" :
                            "from-primary to-blue-500 shadow-primary/20"
                          )}
                          animate={{ width: `${xpPercent}%` }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Persona Selector Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Select Study Persona</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {PERSONAS.map((p) => {
                        const isActive = p.id === persona;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handlePersonaChange(p.id)}
                            className={cn(
                              "w-full rounded-2xl border text-left p-3.5 transition-all duration-300 flex items-start gap-3",
                              "bg-card/40 border-border/40",
                              p.gradient,
                              isActive && p.activeBorder
                            )}
                          >
                            <div className={cn("p-2 rounded-xl text-white shrink-0 mt-0.5", p.avatarBg)}>
                              {p.id === 'rpg' ? <Compass className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-foreground">{p.name}</span>
                                {isActive && (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-black">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-normal mt-0.5 font-medium line-clamp-2">{p.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Today's Tasks List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Today's Tasks</h4>
                      <span className="text-[10px] font-semibold text-muted-foreground/80">
                        {tasks.filter(t => t.isDone).length}/{tasks.length} Completed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {tasks.length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-border/40 rounded-2xl bg-card/20">
                          <p className="text-xs text-muted-foreground font-medium">No tasks scheduled for today.</p>
                          <Button variant="link" onClick={() => handleSend("Suggest a study plan for today.")} className="text-xs text-primary font-black mt-2 p-0 h-auto">Ask for a plan</Button>
                        </div>
                      ) : (
                        tasks.map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 group bg-card/40 border-border/40",
                              task.isDone ? "opacity-60 border-border/20" : "",
                              !task.isDone && task.type === "HOMEWORK" ? "border-l-4 border-l-blue-500 pl-2.5" : "",
                              !task.isDone && task.type === "REVISION" ? "border-l-4 border-l-orange-500 border-dashed pl-2.5" : ""
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task.id, !task.isDone)}
                              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                            >
                              {task.isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-primary fill-primary/10" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/50 hover:text-primary" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "text-xs font-black block truncate text-foreground",
                                task.isDone ? "line-through text-muted-foreground" : ""
                              )}>
                                {task.subject}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium block">
                                {task.startTime} - {task.endTime} • {task.type === "REVISION" ? "Revision" : "Homework"}
                              </span>
                            </div>

                            {!task.isDone && (
                              <button
                                type="button"
                                onClick={() => seedPromptForTask(task)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                title="Import target into chat"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </motion.aside>
            )}
          </AnimatePresence>

        </main>
      </LayoutGroup>
    </div>
  );
}
