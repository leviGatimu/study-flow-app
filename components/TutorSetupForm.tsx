"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTutorModule } from "@/lib/tutor-actions";
import { Loader2, Upload, Sparkles, FileText, X, Shuffle, ListChecks, AlignLeft, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const QUIZ_TYPES = [
  { id: 'MIX', label: 'Mixed', desc: 'A bit of everything', icon: Shuffle },
  { id: 'MULTIPLE_CHOICE', label: 'Multiple Choice', desc: 'Pick / select answers', icon: ListChecks },
  { id: 'OPEN_ENDED', label: 'Paragraph', desc: 'Write it out', icon: AlignLeft },
  { id: 'MATCHING', label: 'Matching', desc: 'Pair & order', icon: Link2 },
];

export function TutorSetupForm({ subjects }: { subjects: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [quizType, setQuizType] = useState('MIX');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createTutorModule(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.moduleId) {
        router.push(`/tutor/${res.moduleId}`);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="quizType" value={quizType} />

      {/* Question Style chooser */}
      <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Question Style</Label>
        <div className="grid grid-cols-2 gap-3">
          {QUIZ_TYPES.map((t) => {
            const Icon = t.icon;
            const active = quizType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setQuizType(t.id)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-black leading-tight", active ? "text-primary" : "text-foreground")}>{t.label}</p>
                  <p className="text-[10px] font-bold text-muted-foreground truncate">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject Selection */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Target Subject</Label>
        <Select name="subject" required>
          <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg focus:ring-primary/20 transition-all hover:border-primary/30">
            <SelectValue placeholder="Select subject..." />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-2 p-2">
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject} className="font-bold py-3 rounded-xl focus:bg-primary/10 cursor-pointer">
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Question Count Selection */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Number of Questions</Label>
        <Select name="questionCount" required defaultValue="10">
          <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg focus:ring-primary/20 transition-all hover:border-primary/30">
            <SelectValue placeholder="Select number of questions..." />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-2 p-2">
            <SelectItem value="5" className="font-bold py-3 rounded-xl focus:bg-primary/10 cursor-pointer">5 Questions (Quick Quiz)</SelectItem>
            <SelectItem value="10" className="font-bold py-3 rounded-xl focus:bg-primary/10 cursor-pointer">10 Questions (Standard Quiz)</SelectItem>
            <SelectItem value="15" className="font-bold py-3 rounded-xl focus:bg-primary/10 cursor-pointer">15 Questions (Deep Dive)</SelectItem>
            <SelectItem value="20" className="font-bold py-3 rounded-xl focus:bg-primary/10 cursor-pointer">20 Questions (Mastery Check)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* File Upload Zone */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Lecture Document</Label>
        <div className="relative">
          <input 
            name="file" 
            type="file" 
            accept=".pdf,.txt,.docx" 
            required 
            className="hidden" 
            id="pdf-upload-notion"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          <label 
            htmlFor="pdf-upload-notion"
            className={cn(
              "flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed rounded-[32px] cursor-pointer transition-all duration-300",
              selectedFile 
                ? "bg-primary/5 border-primary shadow-sm" 
                : "bg-muted/10 border-border hover:bg-muted/30 hover:border-primary/30"
            )}
          >
            {selectedFile ? (
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="flex items-center gap-4 p-6"
               >
                  <div className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
                     <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground max-w-[180px] truncate">{selectedFile.name}</p>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ready for analysis</p>
                  </div>
               </motion.div>
            ) : (
               <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="h-12 w-12 rounded-xl bg-background border flex items-center justify-center mb-3">
                     <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Upload Document</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 font-bold">PDF OR TEXT UP TO 10MB</p>
               </div>
            )}
          </label>
        </div>
      </div>

      {/* Custom Focus Instructions */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Study Focus / Instructions (Optional)</Label>
        <textarea 
          name="instructions"
          placeholder="e.g. Focus on technical definitions, ask about the history section, or make it extra challenging."
          className="w-full min-h-[100px] rounded-2xl border-2 bg-transparent p-4 font-bold text-sm focus:ring-primary/20 transition-all hover:border-primary/30 outline-none resize-none"
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-xs font-bold text-destructive bg-destructive/5 p-4 rounded-2xl border border-destructive/20 flex items-center gap-2">
              <X className="w-4 h-4" /> {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button 
        type="submit" 
        disabled={loading || !selectedFile}
        className={cn(
          "w-full h-16 rounded-[24px] font-black text-xl shadow-xl transition-all",
          loading 
            ? "bg-muted cursor-wait" 
            : "bg-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Generating Quiz...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-6 w-6" />
            Generate Interactive Quiz
          </>
        )}
      </Button>

      <p className="text-[9px] font-black text-center text-muted-foreground uppercase tracking-[0.2em] opacity-40">
        AI-Powered Academic Workspace
      </p>
    </form>
  );
}
