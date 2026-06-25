'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Sparkles, Loader2, FileText, File as FileIcon, Image as ImageIcon,
  ChevronRight, RotateCw, Clock, Check, Send, Save, MessageSquare, Wand2,
  ArrowLeft, BookOpen, ListChecks, CheckCircle2, XCircle, Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import * as mammoth from 'mammoth';
import { generateFlowNotes, askFlowTutor, generateFlowQuiz, createAiNote } from '@/lib/ai-actions';

// PDF.js worker setup (mirrors the AI chat interface)
import * as pdfjsLib from 'pdfjs-dist';
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

type QuizQuestion = { question: string; options: string[]; answer: number; explanation: string };
type ChatMsg = { role: 'user' | 'model'; text: string };
type AttachedFile = {
  name: string;
  kind: 'image' | 'pdf' | 'docx';
  text?: string;
  image?: { data: string; mimeType: string };
};
type Stage = 'INPUT' | 'STUDY' | 'QUIZ';

const TUTOR_SUGGESTIONS = [
  'Explain this more simply',
  'Give me a real-world example',
  'What should I memorise?',
  'Quiz me on one thing',
];

async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => ('str' in item ? (item as { str: string }).str : '')).join(' ') + '\n\n';
  }
  return fullText;
}

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FlowAIPanel({
  subject,
  timerLabel,
  onClose,
}: {
  subject: string;
  timerLabel: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('INPUT');

  // Input
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [notes, setNotes] = useState('');
  const [notesTitle, setNotesTitle] = useState(subject);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Tutor chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quiz
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [isBuildingQuiz, setIsBuildingQuiz] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTutorThinking]);

  const processFile = useCallback(async (file: File) => {
    try {
      if (file.type.startsWith('image/')) {
        const dataUrl = await readAsDataUrl(file);
        setFiles((prev) => [...prev, { name: file.name, kind: 'image', image: { data: dataUrl, mimeType: file.type } }]);
      } else if (file.type === 'application/pdf') {
        const text = await extractPdf(file);
        setFiles((prev) => [...prev, { name: file.name, kind: 'pdf', text }]);
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const text = await extractDocx(file);
        setFiles((prev) => [...prev, { name: file.name, kind: 'docx', text }]);
      } else {
        setError(`Unsupported file: ${file.name}. Use images, PDF, or .docx.`);
      }
    } catch (e) {
      console.error('Failed to process file', e);
      setError(`Could not read ${file.name}.`);
    }
  }, []);

  const handleFiles = useCallback(async (list: FileList | File[]) => {
    setError(null);
    setIsProcessing(true);
    for (const file of Array.from(list)) await processFile(file);
    setIsProcessing(false);
  }, [processFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const hasMaterial = files.length > 0 || pastedText.trim().length > 0;

  const collectMaterial = () => {
    const docText = files
      .filter((f) => f.kind !== 'image' && f.text)
      .map((f) => `--- ${f.name} ---\n${f.text}`)
      .join('\n\n');
    return {
      material: [pastedText.trim(), docText].filter(Boolean).join('\n\n'),
      image: files.find((f) => f.kind === 'image')?.image,
    };
  };

  const handleGenerateNotes = async () => {
    if (!hasMaterial || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    const { material, image } = collectMaterial();
    try {
      const res = await generateFlowNotes(material, subject, image);
      if ('error' in res) {
        setError(res.error);
      } else {
        setNotes(res.notes);
        setNotesTitle(res.title);
        setMessages([]);
        setSaveState('idle');
        setQuiz([]);
        setStage('STUDY');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong generating your notes.');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendTutor = async (text: string) => {
    const q = text.trim();
    if (!q || isTutorThinking) return;
    setChatInput('');
    const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setIsTutorThinking(true);
    try {
      const res = await askFlowTutor(q, notes, history);
      if ('error' in res) setMessages((prev) => [...prev, { role: 'model', text: `⚠️ ${res.error}` }]);
      else setMessages((prev) => [...prev, { role: 'model', text: res.text }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'model', text: `⚠️ ${e?.message || 'Tutor failed to respond.'}` }]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  const handleSaveNotes = async () => {
    if (saveState !== 'idle' || !notes) return;
    setSaveState('saving');
    try {
      const sourceName = files.map((f) => f.name).join(', ') || 'Focus session';
      await createAiNote(notesTitle || subject, notes, sourceName, 'Flow AI');
      setSaveState('saved');
    } catch (e) {
      console.error('Failed to save note', e);
      setSaveState('idle');
      setError('Could not save these notes.');
    }
  };

  const resetQuizProgress = () => { setQIndex(0); setSelected(null); setScore(0); setQuizDone(false); };

  const handleMakeQuiz = async (regenerate = false) => {
    setStage('QUIZ');
    resetQuizProgress();
    if (quiz.length > 0 && !regenerate) return;
    setIsBuildingQuiz(true);
    setError(null);
    try {
      const res = await generateFlowQuiz(notes, subject);
      if ('error' in res) setError(res.error);
      else setQuiz(res.questions);
    } catch (e: any) {
      setError(e?.message || 'Could not build a quiz.');
    } finally {
      setIsBuildingQuiz(false);
    }
  };

  const selectOption = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === quiz[qIndex].answer) setScore((s) => s + 1);
  };
  const nextQuestion = () => {
    if (qIndex < quiz.length - 1) { setQIndex((i) => i + 1); setSelected(null); }
    else setQuizDone(true);
  };

  // Shared floating header — no bordered box, lives directly in the focus scene.
  const Header = (
    <div className="shrink-0 flex items-center justify-between gap-3 px-6 md:px-12 pt-1 pb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
          <Wand2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-heading font-black tracking-tight flex items-center gap-2">
            Flow AI
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              {stage === 'QUIZ' ? 'Quiz' : stage === 'STUDY' ? 'Study' : 'Setup'}
            </span>
          </h2>
          <p className="text-[11px] font-bold text-white/40 truncate">{notesTitle || subject}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-black tabular-nums">{timerLabel}</span>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 backdrop-blur-md"
          title="Back to timer"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );

  // ---------- INPUT STAGE ----------
  if (stage === 'INPUT') {
    return (
      <div
        className="flex-1 min-h-0 relative z-10 flex flex-col"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
        onDrop={handleDrop}
      >
        {Header}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-12 pb-8 relative">
          {isDragging && (
            <div className="absolute inset-3 z-20 rounded-[28px] border-2 border-dashed border-primary/60 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
              <Upload className="w-12 h-12 text-primary" />
              <p className="text-lg font-heading font-black">Drop material to study</p>
            </div>
          )}
          <div className="max-w-2xl mx-auto space-y-7">
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-heading font-black tracking-tight">Feed Flow your material</h3>
              <p className="text-sm font-semibold text-white/45 leading-relaxed max-w-lg mx-auto">
                Upload your notes, slides, or a photo of the board — or paste text. Flow writes you clear,
                well-explained notes, sits beside them to answer anything, and can quiz you when you're ready.
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-[28px] border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/[0.03] hover:bg-white/[0.06] transition-all p-10 flex flex-col items-center gap-4 group backdrop-blur-md"
            >
              <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                {isProcessing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              </div>
              <div className="text-center">
                <p className="font-black text-base">{isProcessing ? 'Reading files…' : 'Upload material'}</p>
                <p className="text-xs font-semibold text-white/35 mt-1">Images, PDF, or Word (.docx) — or drag & drop</p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.docx"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
            />

            <AnimatePresence>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-3 justify-center">
                  {files.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative group flex items-center gap-2.5 pl-3 pr-9 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
                    >
                      {f.kind === 'image' ? <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                        : f.kind === 'pdf' ? <FileText className="w-4 h-4 text-primary shrink-0" />
                        : <FileIcon className="w-4 h-4 text-primary shrink-0" />}
                      <span className="text-xs font-bold truncate max-w-[160px]">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-white/40">Or paste text</label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste a passage, lecture notes, or a topic to revise…"
                className="min-h-[110px] rounded-2xl bg-white/5 border-white/10 font-medium placeholder:text-white/25 text-white backdrop-blur-md"
              />
            </div>

            {error && <p className="text-sm font-bold text-red-400 text-center">{error}</p>}

            <Button
              onClick={handleGenerateNotes}
              disabled={!hasMaterial || isGenerating}
              className="w-full h-16 rounded-[24px] bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-black text-lg gap-3 shadow-2xl shadow-primary/20 disabled:opacity-40"
            >
              {isGenerating ? <><Loader2 className="w-6 h-6 animate-spin" /> Flow is writing your notes…</>
                : <><Sparkles className="w-6 h-6" /> Generate Notes</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- QUIZ STAGE ----------
  if (stage === 'QUIZ') {
    const q = quiz[qIndex];
    const answered = selected !== null;
    const pct = quiz.length ? Math.round((score / quiz.length) * 100) : 0;

    return (
      <div className="flex-1 min-h-0 relative z-10 flex flex-col">
        {Header}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-12 pb-8">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setStage('STUDY')}
              className="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/45 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to notes
            </button>

            {isBuildingQuiz ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="font-bold text-white/60">Flow is writing your quiz…</p>
              </div>
            ) : quiz.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <p className="text-white/40 font-bold">{error || 'No quiz yet.'}</p>
                <Button onClick={() => handleMakeQuiz(true)} className="rounded-2xl bg-primary text-primary-foreground font-black gap-2">
                  <RotateCw className="w-4 h-4" /> Try again
                </Button>
              </div>
            ) : quizDone ? (
              /* ----- Results ----- */
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 space-y-7"
              >
                <div className="w-24 h-24 mx-auto rounded-[32px] bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                  <Trophy className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/40">You scored</p>
                  <p className="text-6xl font-heading font-black tracking-tighter">
                    {score}<span className="text-white/30">/{quiz.length}</span>
                  </p>
                  <p className="text-lg font-bold text-primary">{pct}%</p>
                </div>
                <p className="text-sm font-semibold text-white/55 max-w-sm mx-auto">
                  {pct >= 80 ? 'Excellent — you really know this material.'
                    : pct >= 50 ? 'Solid effort. Review the notes and run it again to lock it in.'
                    : 'Worth another pass through the notes — then retake to level up.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button onClick={resetQuizProgress} className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-black gap-2">
                    <RotateCw className="w-4 h-4" /> Retake
                  </Button>
                  <Button onClick={() => handleMakeQuiz(true)} variant="ghost" className="h-12 px-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold gap-2">
                    <Sparkles className="w-4 h-4" /> New questions
                  </Button>
                  <Button onClick={() => setStage('STUDY')} variant="ghost" className="h-12 px-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold gap-2">
                    <BookOpen className="w-4 h-4" /> Back to notes
                  </Button>
                </div>
              </motion.div>
            ) : (
              /* ----- Active question ----- */
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/40">
                    <span>Question {qIndex + 1} of {quiz.length}</span>
                    <span>Score {score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      animate={{ width: `${((qIndex + (answered ? 1 : 0)) / quiz.length) * 100}%` }}
                    />
                  </div>
                </div>

                <motion.div key={qIndex} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-xl md:text-2xl font-heading font-black leading-snug mb-6">{q.question}</h3>

                  <div className="space-y-3">
                    {q.options.map((opt, i) => {
                      const isCorrect = i === q.answer;
                      const isPicked = i === selected;
                      let cls = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20';
                      if (answered) {
                        if (isCorrect) cls = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100';
                        else if (isPicked) cls = 'bg-red-500/15 border-red-500/50 text-red-100';
                        else cls = 'bg-white/5 border-white/10 opacity-50';
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => selectOption(i)}
                          disabled={answered}
                          className={cn(
                            'w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all backdrop-blur-md',
                            cls,
                            !answered && 'cursor-pointer'
                          )}
                        >
                          <span className={cn(
                            'w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black text-sm border',
                            answered && isCorrect ? 'bg-emerald-500/30 border-emerald-500/50 text-white'
                              : answered && isPicked ? 'bg-red-500/30 border-red-500/50 text-white'
                              : 'bg-white/5 border-white/10 text-white/60'
                          )}>
                            {answered && isCorrect ? <CheckCircle2 className="w-4.5 h-4.5" />
                              : answered && isPicked ? <XCircle className="w-4.5 h-4.5" />
                              : String.fromCharCode(65 + i)}
                          </span>
                          <span className="font-bold text-sm md:text-base">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {answered && q.explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Why
                          </p>
                          <p className="text-sm font-medium text-white/75 leading-relaxed">{q.explanation}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {answered && (
                    <Button
                      onClick={nextQuestion}
                      className="mt-6 w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base gap-2 shadow-lg shadow-primary/20"
                    >
                      {qIndex < quiz.length - 1 ? <>Next question <ChevronRight className="w-5 h-5" /></> : <>See results <Trophy className="w-5 h-5" /></>}
                    </Button>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- STUDY STAGE (notes + tutor) ----------
  return (
    <div className="flex-1 min-h-0 relative z-10 flex flex-col">
      {Header}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 px-6 md:px-12 pb-6 overflow-hidden">
        {/* Notes — open, readable, floating in the scene */}
        <div className="min-h-0 flex flex-col rounded-[28px] bg-black/25 backdrop-blur-md overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 px-6 md:px-8 pt-6 pb-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Your Notes
            </h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveNotes}
                disabled={saveState !== 'idle'}
                variant="ghost"
                className={cn(
                  'rounded-xl font-bold text-[11px] gap-1.5 h-9 px-3 border',
                  saveState === 'saved'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                )}
              >
                {saveState === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : saveState === 'saved' ? <Check className="w-3.5 h-3.5" />
                  : <Save className="w-3.5 h-3.5" />}
                {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving' : 'Save'}
              </Button>
              <Button
                onClick={() => handleMakeQuiz(false)}
                className="rounded-xl font-black text-[11px] gap-1.5 h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                <ListChecks className="w-3.5 h-3.5" /> Quiz me
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-10 pb-10">
            <article className="flow-notes max-w-[720px]">
              <ReactMarkdown>{notes}</ReactMarkdown>
            </article>
          </div>
        </div>

        {/* Tutor */}
        <div className="min-h-0 flex flex-col rounded-[28px] bg-white/[0.05] backdrop-blur-xl overflow-hidden">
          <div className="shrink-0 px-6 pt-6 pb-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Ask Flow about these notes
            </h3>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-3 space-y-4">
            {messages.length === 0 && !isTutorThinking ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 px-4">
                <div className="w-14 h-14 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                  <Sparkles className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-white/50 leading-relaxed max-w-[260px]">
                  Stuck on something? Ask me to explain it, give examples, or test you.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {TUTOR_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendTutor(s)}
                      className="text-[11px] font-bold px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 text-white/70 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[90%] rounded-2xl px-4 py-3 text-sm',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground font-semibold rounded-br-md'
                          : 'bg-white/5 border border-white/10 text-white/85 rounded-bl-md'
                      )}
                    >
                      {m.role === 'user'
                        ? <p className="whitespace-pre-wrap">{m.text}</p>
                        : <div className="flow-notes flow-chat leading-relaxed"><ReactMarkdown>{m.text}</ReactMarkdown></div>}
                    </div>
                  </div>
                ))}
                {isTutorThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="shrink-0 p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); sendTutor(chatInput); }}
              className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-2"
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutor(chatInput); } }}
                placeholder="Ask about your notes…"
                rows={1}
                className="flex-1 resize-none bg-transparent outline-none text-sm font-medium text-white placeholder:text-white/30 px-2 py-2 max-h-32 custom-scrollbar"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isTutorThinking || !chatInput.trim()}
                className="w-10 h-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
