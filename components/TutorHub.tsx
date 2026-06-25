'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Trash2,
  History,
  XCircle,
  FileText,
  PenLine,
  ArrowRight,
  BrainCircuit,
  Loader2,
  Sparkles,
  Layers,
  Award,
  BookOpen,
  Maximize2,
  Minimize2,
  ArrowUp,
  ArrowDown,
  Link2,
  Check,
  X as XIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { deleteTutorModule, gradeQuizAttempt, generateMoreQuestions, getQuizHint, generateFlashcardsForModule, updateFlashcardsReview } from "@/lib/tutor-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  MULTIPLE_SELECT: 'Select All That Apply',
  TRUE_FALSE: 'True or False',
  FILL_IN_THE_BLANK: 'Fill in the Blank',
  SHORT_ANSWER: 'Short Answer',
  OPEN_ENDED: 'Paragraph',
  MATCHING: 'Matching',
  ORDERING: 'Put in Order',
};

export function TutorHub({ module }: { module: any }) {
  const questions = useMemo(() => {
    try {
      return JSON.parse(module.questions || "[]");
    } catch {
      return [];
    }
  }, [module.questions]);

  const attempts = module.attempts || [];

  const [mode, setMode] = useState<'history' | 'quiz' | 'grading' | 'results' | 'flashcard-review'>(
    attempts.length > 0 ? 'history' : 'quiz'
  );

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [latestFeedback, setLatestFeedback] = useState<any>(null);
  
  // Hint State
  const [hints, setHints] = useState<Record<string, string>>({});
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  // Flashcards State
  const [subTab, setSubTab] = useState<'quiz' | 'flashcards'>('quiz');
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [localFlashcards, setLocalFlashcards] = useState<any[]>([]);
  const [fcMode, setFcMode] = useState<'preview' | 'study' | 'complete'>('preview');
  const [currentFcIndex, setCurrentFcIndex] = useState(0);
  const [isFcCardFlipped, setIsFcCardFlipped] = useState(false);
  const [studyAll, setStudyAll] = useState(false);
  const [xpEarnedThisSession, setXpEarnedThisSession] = useState(0);

  // Fullscreen quiz + interactive matching / ordering state
  const quizRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [matchMap, setMatchMap] = useState<Record<string, Record<string, string>>>({});
  const [orderMap, setOrderMap] = useState<Record<string, string[]>>({});
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFs = useCallback(() => {
    const el = quizRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  const setAnswer = (id: string, val: string) => setAnswers((prev) => ({ ...prev, [id]: val }));

  const toggleMultiSelect = (id: string, opt: string) => {
    const cur = (answers[id] || '').split(' | ').filter(Boolean);
    const next = cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt];
    setAnswer(id, next.join(' | '));
  };

  const assignMatch = (qid: string, term: string, def: string, terms: string[]) => {
    const cur = { ...(matchMap[qid] || {}) };
    Object.keys(cur).forEach((t) => { if (cur[t] === def) delete cur[t]; });
    cur[term] = def;
    setMatchMap({ ...matchMap, [qid]: cur });
    setAnswer(qid, terms.map((t) => `${t}: ${cur[t] || '?'}`).join('; '));
    setSelectedTerm(null);
  };

  const clearMatchTerm = (qid: string, term: string, terms: string[]) => {
    const cur = { ...(matchMap[qid] || {}) };
    delete cur[term];
    setMatchMap({ ...matchMap, [qid]: cur });
    setAnswer(qid, terms.map((t) => `${t}: ${cur[t] || '?'}`).join('; '));
  };

  const moveOrderItem = (q: any, idx: number, dir: number) => {
    const arr = [...(orderMap[q.id] || q.items || [])];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setOrderMap({ ...orderMap, [q.id]: arr });
    setAnswer(q.id, arr.join(' | '));
  };

  // Initialize flashcards from module
  useEffect(() => {
    try {
      if (module.flashcards) {
        setLocalFlashcards(JSON.parse(module.flashcards));
      } else {
        setLocalFlashcards([]);
      }
    } catch (e) {
      setLocalFlashcards([]);
    }
  }, [module.flashcards]);

  // Compute active deck based on mode
  const activeReviewDeck = useMemo(() => {
    if (studyAll) return localFlashcards;
    const now = new Date();
    return localFlashcards.filter((fc: any) => !fc.nextReviewDate || new Date(fc.nextReviewDate) <= now);
  }, [localFlashcards, studyAll]);

  const handleGenerateFlashcards = async () => {
    setIsGeneratingFlashcards(true);
    try {
      const result = await generateFlashcardsForModule(module.id);
      if (result.success && result.flashcards) {
        setLocalFlashcards(result.flashcards);
        toast.success("Successfully generated flashcard deck!");
        setFcMode('preview');
      } else {
        toast.error(result.error || "Failed to generate flashcards.");
      }
    } catch (e) {
      toast.error("Failed to generate flashcards. Please check your AI key.");
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleRateFlashcard = async (quality: number) => {
    if (activeReviewDeck.length === 0) return;
    const currentCard = activeReviewDeck[currentFcIndex];
    
    // Leitner/SM-2 Logic
    let prevInterval = currentCard.interval || 0;
    let prevRepetition = currentCard.repetition || 0;
    let prevEfactor = currentCard.efactor || 2.5;

    let interval = 1;
    let repetition = prevRepetition;
    let efactor = prevEfactor;

    if (quality >= 3) {
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 4; // 4 days instead of 6 for faster early cycle
      } else {
        interval = Math.round(prevInterval * efactor);
      }
      repetition++;
    } else {
      repetition = 0;
      interval = 1;
    }

    // Ease factor adjustment
    efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (efactor < 1.3) efactor = 1.3;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    // Update the local list
    const updatedCards = localFlashcards.map((fc: any) => {
      if (fc.id === currentCard.id) {
        return {
          ...fc,
          interval,
          repetition,
          efactor,
          nextReviewDate: nextReviewDate.toISOString()
        };
      }
      return fc;
    });

    setLocalFlashcards(updatedCards);
    setXpEarnedThisSession(prev => prev + 5);

    // Save update to server immediately (non-blocking)
    updateFlashcardsReview(module.id, JSON.stringify(updatedCards), 0);

    // Animate transition to next card
    setIsFcCardFlipped(false);
    setTimeout(() => {
      if (currentFcIndex < activeReviewDeck.length - 1) {
        setCurrentFcIndex(currentFcIndex + 1);
      } else {
        // Finished deck! Save final progress and reward XP
        const xpToGrant = (activeReviewDeck.length * 5); // 5 XP per card reviewed
        updateFlashcardsReview(module.id, JSON.stringify(updatedCards), xpToGrant);
        setFcMode('complete');
      }
    }, 300);
  };

  const handleDontKnow = () => {
    setAnswers({ ...answers, [questions[currentQ].id]: "I don't know." });
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const handleRequestHint = async () => {
    const qId = questions[currentQ].id;
    if (hints[qId]) return; // Already have a hint

    setIsRequestingHint(true);
    const result = await getQuizHint(questions[currentQ].question, questions[currentQ].expectedAnswer || "");
    if (result.hint) {
      setHints({ ...hints, [qId]: result.hint });
    } else {
      alert(result.error || "Failed to get hint.");
    }
    setIsRequestingHint(false);
  };

  const handleGenerateMore = async () => {
    setIsGeneratingMore(true);
    try {
      const result = await generateMoreQuestions(module.id);
      if (result.success) {
        toast.success("5 new questions added to this quiz!");
        setMode('history'); // Go back to history to see updated quiz
      } else {
        toast.error(result.error || "Failed to generate more questions.");
      }
    } catch (e) {
      toast.error("An error occurred while generating more questions.");
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const startQuiz = () => {
    setAnswers({});
    setHints({});
    setMatchMap({});
    setOrderMap({});
    setSelectedTerm(null);
    setCurrentQ(0);
    setMode('quiz');
    // Best-effort: drop straight into a distraction-free fullscreen.
    setTimeout(() => quizRef.current?.requestFullscreen?.().catch(() => {}), 80);
  };

  const submitQuiz = async () => {
    setMode('grading');
    
    const submission = questions.map((q: any) => {
      let answer = answers[q.id] || "";
      // Fall back to current interactive state if the student never edited it.
      if (!answer && q.type === 'ORDERING') answer = (orderMap[q.id] || q.items || []).join(' | ');
      if (!answer && q.type === 'MATCHING') {
        const m = matchMap[q.id] || {};
        answer = (q.terms || []).map((t: string) => `${t}: ${m[t] || '?'}`).join('; ');
      }
      return { id: q.id, answer };
    });

    try {
      // Set a client-side "safety" timeout to inform the user if it's taking too long
      const gradingTimeout = setTimeout(() => {
        alert("The AI is taking longer than usual to grade your quiz. Please wait a bit more or refresh if it persists.");
      }, 45000);

      const result = await gradeQuizAttempt(module.id, submission);
      clearTimeout(gradingTimeout);
      
      if (result.success) {
        setLatestFeedback(result.data);
        setMode('results');
      } else {
        alert(result.error || "Failed to grade quiz. Please try again.");
        setMode('quiz');
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("An unexpected error occurred while grading. Please check your connection and try again.");
      setMode('quiz');
    }
  };

  const viewAttempt = (attempt: any) => {
    try {
      const parsedFeedback = JSON.parse(attempt.feedback);
      setLatestFeedback({
        overallScore: attempt.score,
        feedback: parsedFeedback
      });
      setMode('results');
    } catch (e) {
      alert("Could not load attempt data.");
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground space-y-6">
        <XCircle className="w-16 h-16 text-destructive opacity-80" />
        <h2 className="text-3xl font-bold tracking-tight">Invalid Quiz Data</h2>
        <p className="text-muted-foreground font-medium">This module does not contain valid questions.</p>
        <Button asChild variant="outline">
          <Link href="/tutor">Back to Quizzes</Link>
        </Button>
      </div>
    );
  }

  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      
      {/* Simple Header */}
      <header className="px-6 md:px-10 h-16 border-b border-border bg-card flex items-center justify-between sticky top-0 z-50">
         <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted transition-all">
               <Link href="/tutor"><ChevronLeft className="w-4 h-4" /></Link>
            </Button>
            <div className="h-4 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {module.subject}
               </span>
               <h1 className="text-sm font-bold tracking-tight truncate max-w-[200px] sm:max-w-md">{module.title}</h1>
            </div>
         </div>

         <form action={deleteTutorModule.bind(null, module.id)}>
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-8 px-3 text-xs font-medium">
               <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>
         </form>
      </header>

      <main className="flex-1 w-full bg-muted/10">
          
        {/* TABS SELECTOR (Only in History Mode) */}
        {mode === 'history' && (
          <div className="border-b border-border bg-card shadow-sm sticky top-16 z-40">
            <div className="max-w-4xl mx-auto flex gap-6 px-6 md:px-10">
              <button 
                onClick={() => setSubTab('quiz')}
                className={cn(
                  "py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                  subTab === 'quiz' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="w-4 h-4" /> Practice Quizzes
              </button>
              <button 
                onClick={() => { setSubTab('flashcards'); setFcMode('preview'); }}
                className={cn(
                  "py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                  subTab === 'flashcards' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-4 h-4" /> Spaced Flashcards
              </button>
            </div>
          </div>
        )}

        {/* FLASHCARDS OVERVIEW MODE */}
        {mode === 'history' && subTab === 'flashcards' && (
          <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8 animate-in fade-in duration-300">
            {/* Embedded styles for 3D flip card */}
            <style>{`
              .flip-card {
                perspective: 1000px;
              }
              .flip-card-inner {
                position: relative;
                width: 100%;
                height: 100%;
                transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                transform-style: preserve-3d;
              }
              .flip-card.flipped .flip-card-inner {
                transform: rotateY(180deg);
              }
              .flip-card-front, .flip-card-back {
                position: absolute;
                width: 100%;
                height: 100%;
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
              }
              .flip-card-back {
                transform: rotateY(180deg);
              }
            `}</style>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Spaced Repetition Flashcards</h2>
                <p className="text-sm text-muted-foreground mt-1">Study key concepts using a proven active recall schedule.</p>
              </div>
              
              {localFlashcards.length > 0 && (
                <Button onClick={handleGenerateFlashcards} disabled={isGeneratingFlashcards} variant="outline" className="font-bold border-primary text-primary hover:bg-primary/10">
                  {isGeneratingFlashcards ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Reset & Regenerate Deck
                </Button>
              )}
            </div>

            {isGeneratingFlashcards ? (
              <div className="text-center py-20 bg-card border border-dashed rounded-[32px] space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                <h3 className="text-xl font-bold">Generating Flashcard Deck...</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">AI is extracting core concepts and definitions from this module's quiz content.</p>
              </div>
            ) : localFlashcards.length === 0 ? (
              <div className="text-center py-20 bg-card border border-dashed rounded-[32px] p-8 space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary border border-primary/20">
                  <Layers className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">No Flashcards Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Generate a set of flashcards from your quiz content to study using spaced repetition.
                  </p>
                </div>
                <Button onClick={handleGenerateFlashcards} className="font-bold h-12 px-6 rounded-xl">
                  <Sparkles className="w-4 h-4 mr-2" /> Generate AI Flashcards
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <Card className="p-6 rounded-[24px] border-border/60 flex flex-col justify-between shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Cards</span>
                    <span className="text-4xl font-heading font-black mt-2 text-foreground">{localFlashcards.length}</span>
                  </Card>
                  
                  <Card className="p-6 rounded-[24px] border-border/60 flex flex-col justify-between bg-primary/5 border-primary/20 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary">Due for Review</span>
                    <span className="text-4xl font-heading font-black mt-2 text-primary">
                      {localFlashcards.filter((fc: any) => !fc.nextReviewDate || new Date(fc.nextReviewDate) <= new Date()).length}
                    </span>
                  </Card>

                  <Card className="p-6 rounded-[24px] border-border/60 flex flex-col justify-between shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Next Scheduled Review</span>
                    <span className="text-sm font-semibold mt-2 text-foreground truncate">
                      {(() => {
                        const sortedReviews = [...localFlashcards]
                          .map((fc: any) => fc.nextReviewDate ? new Date(fc.nextReviewDate) : new Date())
                          .sort((a, b) => a.getTime() - b.getTime());
                        return sortedReviews[0] ? format(sortedReviews[0], "MMM d, yyyy") : "No reviews scheduled";
                      })()}
                    </span>
                  </Card>
                </div>

                {/* Study Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center py-4 border-y border-border">
                  <Button 
                    onClick={() => {
                      setStudyAll(false);
                      setCurrentFcIndex(0);
                      setIsFcCardFlipped(false);
                      setXpEarnedThisSession(0);
                      setFcMode('study');
                      setMode('flashcard-review');
                    }}
                    disabled={localFlashcards.filter((fc: any) => !fc.nextReviewDate || new Date(fc.nextReviewDate) <= new Date()).length === 0}
                    className="h-14 px-8 rounded-2xl font-bold text-base gap-2 cursor-pointer shadow-md"
                  >
                    <Layers className="w-5 h-5" /> Study Due Cards
                  </Button>
                  <Button 
                    onClick={() => {
                      setStudyAll(true);
                      setCurrentFcIndex(0);
                      setIsFcCardFlipped(false);
                      setXpEarnedThisSession(0);
                      setFcMode('study');
                      setMode('flashcard-review');
                    }}
                    variant="outline"
                    className="h-14 px-8 rounded-2xl font-bold text-base gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-5 h-5" /> Study All Cards ({localFlashcards.length})
                  </Button>
                </div>

                {/* Deck Cards List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Deck Contents</h3>
                  <div className="grid gap-3">
                    {localFlashcards.map((fc: any, idx: number) => {
                      const isDue = !fc.nextReviewDate || new Date(fc.nextReviewDate) <= new Date();
                      return (
                        <div key={fc.id || idx} className="p-5 bg-card border border-border/60 rounded-2xl flex items-start justify-between gap-6 shadow-sm">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground leading-snug">{fc.front}</p>
                            <p className="text-xs text-muted-foreground/80 leading-relaxed italic">{fc.back}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                            {isDue ? (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full">Due</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-muted text-muted-foreground border rounded-full">
                                Review: {format(new Date(fc.nextReviewDate), "MMM d")}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-muted-foreground/60">Interval: {fc.interval || 0}d</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QUIZ HISTORY LISTING */}
        {mode === 'history' && subTab === 'quiz' && (
          <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Quiz History</h2>
                  <p className="text-sm text-muted-foreground mt-1">Review past attempts or start a new quiz.</p>
                </div>
                <Button onClick={startQuiz} className="font-bold">
                  <PenLine className="w-4 h-4 mr-2" /> Start New Quiz
                </Button>
            </div>

            <div className="grid gap-4">
                {attempts.length === 0 ? (
                   <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card">
                      <History className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="font-bold">No attempts yet</p>
                      <p className="text-sm text-muted-foreground mt-1">You haven't taken this quiz yet.</p>
                   </div>
                ) : (
                  attempts.map((attempt: any, i: number) => {
                    const isMastered = attempt.score >= 80;
                    const isIntermediate = attempt.score >= 50 && attempt.score < 80;
                    
                    return (
                      <Card key={attempt.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-6" onClick={() => viewAttempt(attempt)}>
                          <div className="flex items-center gap-6">
                            <div className={cn(
                                "flex flex-col items-center justify-center w-16 h-16 rounded-lg border",
                                isMastered ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                                isIntermediate ? "bg-orange-500/10 border-orange-500/20 text-orange-600" :
                                "bg-destructive/10 border-destructive/20 text-destructive"
                            )}>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Score</span>
                                <span className="text-xl font-black leading-none">{attempt.score}</span>
                            </div>
                            <div>
                                <h3 className="font-bold">Attempt #{attempts.length - i}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(attempt.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            View Feedback <ArrowRight className="w-4 h-4" />
                          </div>
                      </Card>
                    );
                  })
                )}
            </div>
          </div>
        )}

        {/* QUIZ MODE — fullscreen, big text, rich question types */}
        {mode === 'quiz' && (
          <div ref={quizRef} className={cn("flex flex-col bg-background text-foreground", isFs ? "h-screen" : "h-[calc(100vh-4rem)]")}>
            <Progress value={progress} className="h-1.5 rounded-none bg-muted" />

            {/* Quiz top bar */}
            <div className="flex items-center justify-between px-6 md:px-10 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted px-2.5 py-1 rounded-md truncate max-w-[180px]">{module.subject}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Question {currentQ + 1} / {questions.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={toggleFs} className="font-bold text-xs gap-2 text-muted-foreground hover:text-foreground">
                  {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isFs ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setMode('history'); }}
                  className="font-bold text-xs text-muted-foreground hover:text-destructive"
                >
                  Exit
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 flex flex-col items-center">
              <div className="w-full max-w-4xl space-y-10 py-4">
                {(() => {
                  const q = questions[currentQ];
                  const type = q.type || 'OPEN_ENDED';
                  const selected = (answers[q.id] || '').split(' | ').filter(Boolean);

                  return (
                    <>
                      <div className="space-y-5">
                        <span className="inline-flex text-[11px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                          {TYPE_LABEL[type] || 'Question'}
                        </span>
                        <h2 className="text-3xl md:text-5xl font-heading font-black tracking-tight leading-[1.08]">
                          {q.question}
                        </h2>
                        {hints[q.id] && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-primary text-sm font-semibold flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                            <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{hints[q.id]}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* SELECTION TYPES */}
                        {(type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') && (
                          <div className={cn("grid gap-4", type === 'TRUE_FALSE' ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2")}>
                            {(type === 'TRUE_FALSE' ? ['True', 'False'] : (q.options || [])).map((opt: string) => {
                              const active = answers[q.id] === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setAnswer(q.id, opt)}
                                  className={cn(
                                    "p-6 md:p-7 text-left border-2 rounded-2xl text-lg md:text-xl font-bold transition-all flex items-center gap-4",
                                    active ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                                  )}
                                >
                                  <span className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                                    {active && <Check className="w-4 h-4" />}
                                  </span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {type === 'MULTIPLE_SELECT' && (
                          <div className="space-y-4">
                            <p className="text-sm font-bold text-muted-foreground">Select all that apply.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(q.options || []).map((opt: string) => {
                                const active = selected.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => toggleMultiSelect(q.id, opt)}
                                    className={cn(
                                      "p-6 text-left border-2 rounded-2xl text-lg font-bold transition-all flex items-center gap-4",
                                      active ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                                    )}
                                  >
                                    <span className={cn("w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                                      {active && <Check className="w-4 h-4" />}
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* WRITTEN TYPES */}
                        {type === 'FILL_IN_THE_BLANK' && (
                          <Input
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            placeholder="Type the missing word(s)…"
                            className="h-16 md:h-20 text-xl md:text-2xl px-6 rounded-2xl bg-card border-2 focus:ring-2 focus:ring-primary/20"
                            autoFocus
                          />
                        )}

                        {type === 'SHORT_ANSWER' && (
                          <Textarea
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            placeholder="Answer in a sentence or two…"
                            className="min-h-[150px] text-xl p-6 rounded-2xl bg-card border-2 focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                            autoFocus
                          />
                        )}

                        {(type === 'OPEN_ENDED') && (
                          <Textarea
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            placeholder="Type your detailed answer here…"
                            className="min-h-[280px] text-lg md:text-xl p-6 rounded-2xl bg-card border-2 focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                            autoFocus
                          />
                        )}

                        {/* MATCHING — tap a term, then tap its definition */}
                        {type === 'MATCHING' && (() => {
                          const terms: string[] = q.terms || [];
                          const defs: string[] = q.definitions || [];
                          const map = matchMap[q.id] || {};
                          const usedDefs = new Set(Object.values(map));
                          return (
                            <div className="space-y-4">
                              <p className="text-sm font-bold text-muted-foreground">Tap a term, then tap its matching definition.</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div className="space-y-3">
                                  {terms.map((t) => {
                                    const isSel = selectedTerm === t;
                                    const paired = map[t];
                                    return (
                                      <button
                                        key={t}
                                        onClick={() => setSelectedTerm(isSel ? null : t)}
                                        className={cn(
                                          "w-full p-5 rounded-2xl border-2 text-left transition-all",
                                          isSel ? "border-primary bg-primary/10 ring-2 ring-primary/20" : paired ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card hover:border-primary/40"
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-lg font-black">{t}</span>
                                          {paired && (
                                            <span onClick={(e) => { e.stopPropagation(); clearMatchTerm(q.id, t, terms); }} className="text-muted-foreground hover:text-destructive cursor-pointer">
                                              <XIcon className="w-4 h-4" />
                                            </span>
                                          )}
                                        </div>
                                        {paired ? (
                                          <p className="text-sm font-semibold text-emerald-600 mt-1.5 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> {paired}</p>
                                        ) : (
                                          <p className="text-xs font-bold text-muted-foreground/60 mt-1.5">{isSel ? "Now pick a definition →" : "Tap to select"}</p>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="space-y-3">
                                  {defs.map((d) => {
                                    const used = usedDefs.has(d);
                                    return (
                                      <button
                                        key={d}
                                        disabled={!selectedTerm}
                                        onClick={() => { if (selectedTerm) assignMatch(q.id, selectedTerm, d, terms); }}
                                        className={cn(
                                          "w-full p-5 rounded-2xl border-2 text-left text-base font-bold transition-all",
                                          used ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground" : selectedTerm ? "border-border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer" : "border-border bg-card/50 text-muted-foreground/70 cursor-not-allowed"
                                        )}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* ORDERING — arrange with arrows */}
                        {type === 'ORDERING' && (() => {
                          const order: string[] = orderMap[q.id] || q.items || [];
                          return (
                            <div className="space-y-3">
                              <p className="text-sm font-bold text-muted-foreground">Arrange in the correct order (top = first).</p>
                              {order.map((it, idx) => (
                                <div key={it} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card">
                                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                                  <span className="flex-1 text-lg font-bold">{it}</span>
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => moveOrderItem(q, idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveOrderItem(q, idx, 1)} disabled={idx === order.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"><ArrowDown className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="p-4 md:px-10 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="font-bold rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Previous</span>
                </Button>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleDontKnow} className="font-bold rounded-xl hidden sm:inline-flex">
                    I don&apos;t know
                  </Button>
                  <Button variant="outline" onClick={handleRequestHint} disabled={isRequestingHint || !!hints[questions[currentQ].id]} className="font-bold rounded-xl text-primary hover:text-primary">
                    {isRequestingHint ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    <span className="hidden sm:inline">{hints[questions[currentQ].id] ? "Hint Revealed" : "Get Hint"}</span>
                  </Button>
                </div>

                {currentQ === questions.length - 1 ? (
                  <Button
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length === 0}
                    className="font-bold rounded-xl shadow-md shadow-primary/20"
                  >
                    Submit Quiz
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                    className="font-bold rounded-xl"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
            </div>
          </div>
        )}

        {/* GRADING MODE */}
        {mode === 'grading' && (
          <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Grading Quiz</h2>
                <p className="text-muted-foreground">The AI is reviewing your answers...</p>
              </div>
          </div>
        )}

        {/* RESULTS MODE */}
        {mode === 'results' && latestFeedback && (
          <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-12">
            
            {/* Score Overview */}
            <div className="flex flex-col items-center text-center space-y-6 py-8 border-b border-border">
                <div className={cn(
                  "w-32 h-32 rounded-full flex flex-col items-center justify-center border-4 bg-card",
                  latestFeedback.overallScore >= 80 ? "border-emerald-500 text-emerald-600" : 
                  latestFeedback.overallScore >= 50 ? "border-orange-500 text-orange-600" : 
                  "border-destructive text-destructive"
                )}>
                    <span className="text-[10px] font-bold uppercase tracking-wider mb-[-4px]">Score</span>
                    <span className="text-5xl font-black">{latestFeedback.overallScore}%</span>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Quiz Results</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                      Review the feedback below to see what you got right and what needs improvement.
                  </p>
                </div>

                <div className="flex gap-4 pt-2">
                  <Button onClick={startQuiz} className="font-bold">
                      <RotateCcw className="w-4 h-4 mr-2" /> Retake Quiz
                  </Button>
                  <Button variant="outline" onClick={handleGenerateMore} disabled={isGeneratingMore} className="font-bold border-primary text-primary hover:bg-primary/10">
                      {isGeneratingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Generate More Questions
                  </Button>
                  <Button variant="outline" onClick={() => setMode('history')} className="font-bold">
                      <History className="w-4 h-4 mr-2" /> View History
                  </Button>
                </div>
            </div>

            {/* Detailed Feedback */}
            <div className="space-y-8 pb-16">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" /> Question Breakdown
                </h3>
                
                <div className="space-y-8">
                  {latestFeedback.feedback.map((f: any, i: number) => {
                      const question = questions.find((q: any) => q.id === f.questionId);
                      return (
                        <Card key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                          {/* Header */}
                          <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <h4 className="font-bold text-base leading-snug">
                                <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                {question?.question}
                              </h4>
                              <div className={cn(
                                "px-3 py-1 rounded-md text-xs font-bold shrink-0 flex items-center gap-1.5 border",
                                f.isCorrect ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                              )}>
                                {f.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                Score: {f.score}/100
                              </div>
                          </div>

                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Student Answer */}
                              <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Answer</p>
                                <div className="p-4 bg-muted/40 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
                                    {f.studentAnswer || <span className="italic text-muted-foreground">No answer provided.</span>}
                                </div>
                              </div>
                              
                              {/* AI Feedback */}
                              <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                  <BrainCircuit className="w-3.5 h-3.5" /> AI Feedback
                                </p>
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm text-foreground/90 whitespace-pre-wrap">
                                    {f.aiFeedback}
                                </div>
                              </div>
                          </div>
                        </Card>
                      );
                  })}
                </div>
            </div>
          </div >
        )}

        {/* FLASHCARD REVIEW ACTIVE SESSION */}
        {mode === 'flashcard-review' && activeReviewDeck.length > 0 && (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            <Progress value={((currentFcIndex + 1) / activeReviewDeck.length) * 100} className="h-1 rounded-none bg-muted" />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 flex flex-col items-center justify-center">
              {fcMode === 'study' ? (
                <div className="w-full max-w-xl flex flex-col items-center space-y-8">
                  {/* Card count/progress indicator */}
                  <div className="text-center space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Flashcard {currentFcIndex + 1} of {activeReviewDeck.length}
                    </p>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{studyAll ? "Studying All Cards" : "Reviewing Due Cards"}</p>
                  </div>

                  {/* 3D Flip Card */}
                  <div 
                    onClick={() => setIsFcCardFlipped(!isFcCardFlipped)}
                    className={cn(
                      "flip-card w-full h-[320px] cursor-pointer relative",
                      isFcCardFlipped && "flipped"
                    )}
                  >
                    <div className="flip-card-inner w-full h-full shadow-xl rounded-3xl transition-transform duration-500">
                      {/* Front Side */}
                      <Card className="flip-card-front absolute inset-0 p-8 flex flex-col items-center justify-center text-center border-border/60 bg-card">
                        <div className="absolute top-4 left-4 text-[10px] font-bold text-muted-foreground/45 uppercase tracking-widest">Question / Concept</div>
                        <p className="text-xl font-heading font-bold text-foreground leading-snug max-w-md">
                          {activeReviewDeck[currentFcIndex]?.front}
                        </p>
                        <span className="absolute bottom-6 text-xs font-bold text-primary animate-pulse">Click to Reveal Answer</span>
                      </Card>

                      {/* Back Side */}
                      <Card className="flip-card-back absolute inset-0 p-8 flex flex-col items-center justify-center text-center border-primary/30 bg-primary/5">
                        <div className="absolute top-4 left-4 text-[10px] font-bold text-primary/45 uppercase tracking-widest">Answer / Definition</div>
                        <p className="text-lg font-medium text-foreground leading-relaxed max-w-md">
                          {activeReviewDeck[currentFcIndex]?.back}
                        </p>
                        <span className="absolute bottom-6 text-[10px] font-bold text-muted-foreground">Click to flip back</span>
                      </Card>
                    </div>
                  </div>

                  {/* Spacer or Buttons */}
                  <div className="w-full flex justify-center h-16">
                    {!isFcCardFlipped ? (
                      <Button 
                        onClick={() => setIsFcCardFlipped(true)}
                        className="h-14 px-8 rounded-2xl font-bold shadow-lg cursor-pointer"
                      >
                        Reveal Answer
                      </Button>
                    ) : (
                      <div className="grid grid-cols-4 gap-3 w-full">
                        <Button 
                          onClick={() => handleRateFlashcard(1)}
                          variant="destructive"
                          className="h-14 rounded-xl font-bold text-xs flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span>Again</span>
                          <span className="text-[9px] font-normal opacity-85">Forgot</span>
                        </Button>
                        <Button 
                          onClick={() => handleRateFlashcard(3)}
                          className="h-14 rounded-xl font-bold text-xs bg-orange-500 hover:bg-orange-600 text-white flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span>Hard</span>
                          <span className="text-[9px] font-normal opacity-85">Struggled</span>
                        </Button>
                        <Button 
                          onClick={() => handleRateFlashcard(4)}
                          className="h-14 rounded-xl font-bold text-xs bg-blue-500 hover:bg-blue-600 text-white flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span>Good</span>
                          <span className="text-[9px] font-normal opacity-85">Recalled</span>
                        </Button>
                        <Button 
                          onClick={() => handleRateFlashcard(5)}
                          className="h-14 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span>Easy</span>
                          <span className="text-[9px] font-normal opacity-85">Instant</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Session Complete Screen */
                <div className="w-full max-w-md text-center space-y-6 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
                    <Award className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-heading font-black tracking-tight text-foreground">Session Complete!</h2>
                    <p className="text-sm text-muted-foreground font-medium">You reviewed all target flashcards in this session.</p>
                  </div>
                  <Card className="p-6 border border-border/60 rounded-2xl bg-card shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">XP Awarded</span>
                      <span className="text-2xl font-black text-emerald-600">+{xpEarnedThisSession} XP</span>
                    </div>
                  </Card>
                  <Button 
                    onClick={() => {
                      setMode('history');
                      setSubTab('flashcards');
                    }}
                    className="w-full h-14 rounded-2xl font-bold text-base cursor-pointer shadow-md"
                  >
                    Return to Deck
                  </Button>
                </div>
              )}
            </div>

            {/* Footer Control: Exit study session */}
            <div className="p-4 border-t border-border bg-card flex justify-between items-center px-6 md:px-10">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setMode('history');
                  setSubTab('flashcards');
                }}
                className="font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Exit Session
              </Button>
              <div className="text-xs font-semibold text-muted-foreground">
                Earned: +{xpEarnedThisSession} XP
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
