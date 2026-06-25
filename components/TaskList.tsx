'use client';

import { useState } from 'react';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { Clock, BellRing, FileEdit, ExternalLink, CheckCircle2, X, Save, Upload, FileText, Sparkles, Zap, Pause } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateTaskProof } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/FocusContext';
import { motion } from 'framer-motion';
import { DeleteTaskButton } from '@/components/DeleteTaskButton';

type TaskType = {
  id: string;
  subject: string;
  isDone: boolean;
  isMissed: boolean;
  type: string;
  startTime: string;
  endTime: string;
  isUrgent?: boolean;
  workDescription?: string | null;
  proofPdfUrl?: string | null;
  template: {
    startTime: string;
    endTime: string;
    deadlineDay: string;
  } | null;
};

function formatDuration(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60; // crosses midnight (e.g. 22:30 — 00:00)
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function TaskList({ tasks }: { tasks: TaskType[] }) {
  const { activeTask, isPaused, step } = useFocus();
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleOpenEdit = (task: TaskType) => {
    setEditingTask(task);
    setDescription(task.workDescription || '');
    setSelectedFile(null);
  };

  const handleSaveProof = async () => {
    if (!editingTask) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append('taskId', editingTask.id);
    formData.append('description', description);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    const res = await updateTaskProof(formData);
    
    setIsSaving(false);
    if (res.success) {
      setEditingTask(null);
    } else {
      alert(res.error || "Failed to save proof.");
    }
  };

  const navigateToSubject = (subject: string) => {
    const cleanSubject = subject.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').trim();
    router.push(`/resources/${encodeURIComponent(cleanSubject)}`);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-muted-foreground bg-card border p-6 rounded-2xl text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        No scheduled tasks for today. Rest up or get ahead!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => {
        const isHomework = task.type === 'HOMEWORK';
        const isUrgent = task.isUrgent;
        const isActiveSession = activeTask?.id === task.id && step === 'FOCUS';
        const duration = formatDuration(task.startTime, task.endTime);

        return (
          <motion.div 
            layout
            key={task.id} 
            transition={{ type: "spring", stiffness: 250, damping: 30 }}
            className={cn(
              "relative overflow-hidden bg-card border border-l-4 shadow-sm p-5 rounded-[28px] transition-all duration-300 hover:shadow-md active:scale-[0.99] group cursor-pointer",
              task.isDone ? "bg-success/5 border-border border-l-success opacity-80" :
              task.isMissed ? "bg-destructive/5 border-border border-l-destructive opacity-70" :
              isActiveSession ? "border-border border-l-primary bg-primary/[0.01]" :
              isUrgent ? "border-border border-l-orange-500 bg-orange-500/[0.02]" : "border-border border-l-transparent"
            )}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
            onClick={() => navigateToSubject(task.subject)}
          >
            <div className="flex items-center justify-between relative z-10 flex-wrap gap-4">
              <div className="flex items-start sm:items-center space-x-5 flex-1 min-w-0">
                <div 
                  className="transition-transform active:scale-90 mt-1 sm:mt-0 shrink-0"
                  onClick={(e) => e.stopPropagation()} // Prevent navigation when clicking checkbox
                >
                  <TaskCheckbox 
                    taskId={task.id} 
                    isDone={task.isDone} 
                    isMissed={task.isMissed} 
                    hasProof={!!task.workDescription || !!task.proofPdfUrl}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="group/title flex items-center gap-2">
                      <p className={cn(
                        "font-heading font-black text-2xl transition-all duration-300 group-hover/title:text-primary decoration-primary/30 underline-offset-4",
                        task.isDone ? "line-through text-success/60" : task.isMissed ? "line-through text-destructive/60" : "text-foreground group-hover/title:underline"
                      )}>
                        {task.subject}
                      </p>
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                    </div>

                    {isUrgent && !task.isDone && !task.isMissed && !isActiveSession && (
                      <div className="flex items-center gap-1.5 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-in zoom-in duration-500">
                        <BellRing className="w-3 h-3 animate-bounce" /> SMART ALARM
                      </div>
                    )}

                    {isActiveSession && (
                      <div className={cn(
                        "flex items-center gap-1.5 text-white text-[10px] font-black px-3 py-1 rounded-full animate-in zoom-in duration-500",
                        isPaused ? "bg-amber-500" : "bg-primary"
                      )}>
                        {isPaused ? <Pause className="w-3 h-3" /> : <Zap className="w-3 h-3 fill-current animate-pulse" />}
                        {isPaused ? 'SESSION PAUSED' : 'SESSION ACTIVE'}
                      </div>
                    )}
                  </div>
                  
                  {/* Highly Visible Time Range */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className={cn(
                      "flex items-center space-x-2 px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm border transition-colors",
                      task.isDone ? "bg-success/10 text-success border-success/20" : 
                      task.isMissed ? "bg-destructive/10 text-destructive border-destructive/20" :
                      isActiveSession ? "bg-primary text-white border-primary/20" :
                      isUrgent ? "bg-orange-500 text-white border-orange-600" : "bg-primary/5 text-primary border-primary/20"
                    )}>
                      <Clock className="w-4 h-4" />
                      <span>{task.startTime} — {task.endTime}</span>
                    </div>

                    {duration && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-xl border transition-colors",
                        task.isDone ? "bg-success/10 text-success border-success/20" :
                        task.isMissed ? "bg-destructive/10 text-destructive border-destructive/20" :
                        isActiveSession ? "bg-white/20 border-white/20 text-white" :
                        isUrgent ? "bg-orange-500/10 text-orange-700 border-orange-500/20" : "bg-muted text-muted-foreground border-transparent"
                      )}>
                        {duration}
                      </span>
                    )}

                    {task.template && (
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-colors",
                        isActiveSession ? "bg-white/20 border-white/20 text-white" :
                        isUrgent && !task.isDone && !task.isMissed ? "bg-orange-500/10 border-orange-500/20 text-orange-700" : "bg-muted border-transparent text-muted-foreground"
                      )}>
                        DUE: {task.template.deadlineDay}
                      </span>
                    )}

                    {(task.workDescription || task.proofPdfUrl) && (
                       <div className={cn(
                         "flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border",
                         isActiveSession ? "text-white/80 bg-white/10 border-white/20" : "text-success/70 bg-success/5 border-success/10"
                       )}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Proof Attached
                       </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                {/* Resume Focus Button */}
                {isActiveSession && (
                  <Link href={`/focus/${task.id}`}>
                    <Button 
                      size="sm" 
                      className={cn(
                        "rounded-xl gap-2 font-black transition-all hover:scale-105 active:scale-95",
                        isPaused ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90"
                      )}
                    >
                      <Zap className={cn("w-4 h-4 fill-current", !isPaused && "animate-pulse")} />
                      {isPaused ? 'RESUME' : 'OPEN'}
                    </Button>
                  </Link>
                )}

                {/* Proof of Work Button */}
                {!task.isMissed && !isActiveSession && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEdit(task)}
                    className={cn(
                      "rounded-xl gap-2 font-bold transition-all border border-transparent",
                      (task.workDescription || task.proofPdfUrl)
                        ? "text-success hover:bg-success/10 border-success/10" 
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/10"
                    )}
                  >
                    <FileEdit className="w-4 h-4" />
                    <span className="hidden sm:inline">{(task.workDescription || task.proofPdfUrl) ? 'Edit Proof' : 'Attach Proof'}</span>
                  </Button>
                )}

                <div className={cn(
                  "text-[10px] font-black px-4 py-2 rounded-full tracking-[0.1em] uppercase transition-all shrink-0",
                  task.isDone ? "bg-success text-white" :
                  task.isMissed ? "bg-destructive text-white" :
                  isActiveSession ? "bg-white text-primary border border-primary/20" :
                  isUrgent ? "bg-orange-500 text-white" :
                  isHomework ? "bg-primary/10 text-primary border border-primary/20" : "bg-orange-500/10 text-orange-600 border border-orange-200 dark:border-orange-900/30"
                )}>
                  {task.isDone ? 'DONE' : task.isMissed ? 'MISSED' : task.type}
                </div>

                <DeleteTaskButton taskId={task.id} className="h-10 w-10" />

                <Link href={`/studio/${encodeURIComponent(task.subject.replace(/\s*\(revision\)\s*/gi, '').replace(/'/g, '').trim())}`} onClick={(e) => e.stopPropagation()}>
                   <Button variant="ghost" size="sm" className="rounded-xl h-10 w-10 p-0 text-primary hover:bg-primary/10 transition-all border border-primary/10 shadow-sm">
                      <Sparkles className="w-4 h-4" />
                   </Button>
                </Link>
              </div>
            </div>

            {/* Inline Preview of Proof */}
            {(task.workDescription || task.proofPdfUrl) && (
              <div className={cn(
                "mt-4 pt-4 border-t pl-14 flex flex-col gap-3",
                isActiveSession ? "border-white/10" : "border-border/40"
              )}>
                {task.workDescription && (
                  <p className={cn(
                    "text-sm font-medium italic leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all",
                    isActiveSession ? "text-white/60" : "text-muted-foreground"
                  )}>
                    &quot;{task.workDescription}&quot;
                  </p>
                )}
                {task.proofPdfUrl && (
                  <div className={cn(
                    "flex items-center gap-3 hover:underline",
                    isActiveSession ? "text-white" : "text-primary"
                  )} onClick={(e) => e.stopPropagation()}>
                    <FileText className="w-4 h-4" />
                    <a href={task.proofPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-black uppercase tracking-widest">
                      View Attached PDF
                    </a>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Proof of Work Modal */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="rounded-[40px] sm:max-w-xl border-2 p-0 overflow-hidden bg-card/95 backdrop-blur-xl">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-3xl font-heading font-black flex items-center gap-4 text-foreground">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20">
                  <FileEdit className="w-8 h-8" />
                </div>
                Proof of Work
              </DialogTitle>
              <DialogDescription className="font-bold text-muted-foreground text-lg pt-2">
                Document your accomplishments for <span className="text-foreground">{editingTask?.subject}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-8">
              {/* Text Description */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 px-1">Accomplishments</label>
                <Textarea
                  placeholder="What exactly did you finish? (e.g. Completed page 42 exercises...)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[140px] rounded-3xl border-2 font-medium focus-visible:ring-primary/20 resize-none p-6 text-lg bg-background text-foreground"
                  autoFocus
                />
              </div>

              {/* PDF Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 px-1">Supplementary Evidence (PDF)</label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    id="proof-upload"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <label 
                    htmlFor="proof-upload"
                    className={cn(
                      "flex items-center gap-4 w-full p-6 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300",
                      selectedFile 
                        ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" 
                        : "bg-muted/30 border-border/60 hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl transition-colors",
                      selectedFile ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-black text-sm uppercase tracking-wider text-foreground">
                        {selectedFile ? selectedFile.name : 'Upload PDF Proof'}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready` : 'Max capacity: 10MB'}
                      </p>
                    </div>
                    {selectedFile && (
                       <button 
                         onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                         className="p-2 hover:bg-destructive/10 rounded-full text-destructive transition-colors"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    )}
                  </label>
                </div>
              </div>

              {editingTask?.proofPdfUrl && !selectedFile && (
                <div className="p-4 bg-success/5 border border-success/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-success" />
                    <span className="text-xs font-bold text-success uppercase tracking-widest">Existing PDF Attached</span>
                  </div>
                  <a href={editingTask.proofPdfUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black underline text-success">VIEW</a>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button 
                onClick={handleSaveProof}
                disabled={isSaving || (!description.trim() && !selectedFile && !editingTask?.proofPdfUrl)}
                className="w-full h-16 rounded-[24px] font-black text-xl gap-3 shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                {isSaving ? <span className="animate-pulse">SAVING PROTOCOL...</span> : (
                  <>
                    <Save className="w-6 h-6" /> SAVE PROOF
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
