'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  Loader2,
  CalendarDays,
  GraduationCap,
  BrainCircuit,
  Trash2,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { analyzeTimetable, commitTimetablePlan, type TimetablePlan } from '@/lib/ai-actions';
import { readTimetableFile } from '@/lib/file-extract';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Step = 'idle' | 'analyzing' | 'preview' | 'committing';

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEE, MMM d, yyyy');
}

export function UploadTimetableDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [plan, setPlan] = useState<TimetablePlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('idle');
    setError(null);
    setNoKey(false);
    setPlan(null);
    setFileName('');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setNoKey(false);
    setFileName(file.name);
    setStep('analyzing');
    try {
      const read = await readTimetableFile(file);
      const res = await analyzeTimetable(
        read.kind === 'image' ? { image: read.image } : { text: read.text }
      );
      if ('error' in res) {
        if (res.error.toLowerCase().includes('no ai api key')) setNoKey(true);
        setError(res.error);
        setStep('idle');
        return;
      }
      if (res.plan.exams.length === 0) {
        setError("Couldn't find any exam dates in that file. Try a clearer photo or a different file.");
        setStep('idle');
        return;
      }
      setPlan(res.plan);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read that file.');
      setStep('idle');
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const removeExam = (idx: number) => {
    if (!plan) return;
    const exam = plan.exams[idx];
    setPlan({
      exams: plan.exams.filter((_, i) => i !== idx),
      // Drop revision blocks tied to the removed subject.
      revision: plan.revision.filter((r) => r.subject.toLowerCase() !== exam.subject.toLowerCase()),
    });
  };

  const removeRevision = (idx: number) => {
    if (!plan) return;
    setPlan({ ...plan, revision: plan.revision.filter((_, i) => i !== idx) });
  };

  const handleCommit = async () => {
    if (!plan) return;
    setStep('committing');
    setError(null);
    const res = await commitTimetablePlan(plan);
    if ('error' in res) {
      setError(res.error);
      setStep('preview');
      return;
    }
    handleOpenChange(false);
    router.refresh();
  };

  // Group revision blocks under their exam subject for display.
  const revisionBySubject = (plan?.revision ?? []).reduce<Record<string, number[]>>((acc, r, i) => {
    const key = r.subject;
    (acc[key] ||= []).push(i);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 px-6 rounded-xl border-border bg-card hover:bg-muted font-bold text-sm gap-2 shadow-sm hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" /> Upload Timetable
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border border-border bg-card p-0 overflow-hidden w-[95vw] max-w-5xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-8 pb-4 relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10" />
          <DialogHeader className="relative z-10">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-heading font-black text-foreground uppercase tracking-tight">
              Upload Timetable
            </DialogTitle>
            <p className="text-muted-foreground font-semibold text-xs mt-1">
              Upload a photo, PDF, or Word file. AI will schedule your exams and plan revision around your week.
            </p>
          </DialogHeader>
        </div>

        <div className="px-8 pb-8 overflow-y-auto relative z-10">
          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-semibold">
                {error}
                {noKey && (
                  <Link href="/settings" className="block mt-1 underline font-black">
                    Add an AI key in Settings →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Idle: file picker */}
          {(step === 'idle' || step === 'analyzing') && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              onClick={() => step === 'idle' && inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center',
                isDragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
                step === 'analyzing' && 'pointer-events-none opacity-90'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={onPick}
              />
              {step === 'analyzing' ? (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <div>
                    <p className="font-black text-foreground uppercase tracking-wide text-sm">Reading your timetable…</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1 truncate max-w-xs">{fileName}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-foreground uppercase tracking-wide text-sm">Drop a file or click to browse</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">Image · PDF · Word · max 25 MB</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {(step === 'preview' || step === 'committing') && plan && (
            <div className="space-y-7">
              {/* Exams */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Exams Found ({plan.exams.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {plan.exams.map((exam, i) => (
                    <div
                      key={`${exam.subject}-${exam.date}-${i}`}
                      className="group flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-foreground truncate uppercase tracking-tight text-sm">
                          🚀 {exam.subject}
                        </p>
                        <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <CalendarDays className="w-3 h-3" /> {fmtDate(exam.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border',
                            exam.priority === 'HIGH'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          )}
                        >
                          {exam.priority}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeExam(i)}
                          disabled={step === 'committing'}
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Revision */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Revision Plan ({plan.revision.length} sessions)
                  </h3>
                </div>
                {plan.revision.length === 0 ? (
                  <p className="text-xs font-semibold text-muted-foreground italic p-4 bg-muted/20 rounded-xl border border-dashed border-border/50">
                    No revision sessions proposed.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(revisionBySubject).map(([subject, indexes]) => (
                      <div key={subject} className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-foreground/80 px-1">
                          {subject}
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                          {indexes.map((i) => {
                            const r = plan.revision[i];
                            return (
                              <div
                                key={`${r.date}-${r.startTime}-${i}`}
                                className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground">
                                    {fmtDate(r.date)} · {r.startTime}–{r.endTime}
                                  </p>
                                  {r.focus && (
                                    <p className="text-[11px] font-medium text-muted-foreground truncate mt-0.5">{r.focus}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRevision(i)}
                                  disabled={step === 'committing'}
                                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={step === 'committing'}
                  className="h-11 px-5 rounded-xl font-bold text-sm cursor-pointer"
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleCommit}
                  disabled={step === 'committing' || plan.exams.length === 0}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer gap-2"
                >
                  {step === 'committing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Adding…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Add to Calendar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
