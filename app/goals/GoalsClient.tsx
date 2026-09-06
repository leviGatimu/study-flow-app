'use client';

import { useState, useMemo, useTransition } from 'react';
import {
  Target,
  TrendingUp,
  Trash2,
  Edit2,
  ArrowUpRight,
  Award,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Info,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveGoal, deleteGoal } from '@/lib/goal-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type SubjectGradeType = {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
};

type ReportCardType = {
  id: string;
  term: string;
  overallAverage: number | null;
  aiSummary: string | null;
  fileUrl: string | null;
  createdAt: Date;
  grades: SubjectGradeType[];
};

type GoalType = {
  id: string;
  subject: string;
  targetGrade: number;
  createdAt: Date;
};

interface GoalsClientProps {
  initialReportCards: ReportCardType[];
  initialGoals: GoalType[];
  uniqueSubjects: string[];
}

export function GoalsClient({ initialReportCards, initialGoals, uniqueSubjects }: GoalsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [targetGrade, setTargetGrade] = useState<string>('85');

  // Edit mode tracking
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Compile unique subjects and their latest numeric grades from all sources
  const subjectList = useMemo(() => {
    const map = new Map<string, number>();
    
    // Clean helper to normalize raw and revision subject variants
    const clean = (s: string) => {
      if (!s) return '';
      return s
        .replace(/\s*\(revision\)\s*/gi, '')
        .replace(/'/g, '')
        .trim();
    };

    // 1. Load all unique subjects from timetable/mastery/resources/grades first
    uniqueSubjects.forEach(sub => {
      if (sub) map.set(clean(sub), NaN);
    });

    // 2. Sort report cards by date ascending so the most recent grades overwrite older ones
    const sortedCards = [...initialReportCards].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedCards.forEach(rc => {
      rc.grades.forEach(g => {
        const numGrade = parseFloat(g.grade.replace(/[^0-9.]/g, ''));
        if (!isNaN(numGrade)) {
          const cleanedName = clean(g.subject);
          // Normalize case insensitively to avoid duplicates
          let matchKey = cleanedName;
          for (const key of map.keys()) {
            if (key.toLowerCase() === cleanedName.toLowerCase()) {
              matchKey = key;
              break;
            }
          }
          map.set(matchKey, numGrade);
        }
      });
    });

    return Array.from(map.entries()).map(([subject, currentGrade]) => ({
      subject,
      currentGrade: isNaN(currentGrade) ? undefined : currentGrade
    })).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [initialReportCards, uniqueSubjects]);

  // Map of subject names to current grades for quick lookup
  const currentGradesMap = useMemo(() => {
    const map = new Map<string, number | undefined>();
    subjectList.forEach(s => map.set(s.subject, s.currentGrade));
    return map;
  }, [subjectList]);

  // Standing details of the subject currently selected in the form
  const selectedSubjectData = useMemo(() => {
    const activeSub = selectedSubject === 'custom' ? customSubject : selectedSubject;
    if (!activeSub) return null;
    return subjectList.find(s => s.subject.toLowerCase() === activeSub.toLowerCase()) || null;
  }, [selectedSubject, customSubject, subjectList]);

  // Overall current average
  const currentOverallAverage = useMemo(() => {
    const latestReportCard = [...initialReportCards].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (latestReportCard && latestReportCard.overallAverage) {
      return latestReportCard.overallAverage;
    }
    const validGrades = subjectList
      .map(s => s.currentGrade)
      .filter((g): g is number => g !== undefined);
      
    if (validGrades.length === 0) return 0;
    return parseFloat((validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(1));
  }, [initialReportCards, subjectList]);

  // Overall target average (average of all goals)
  const targetOverallAverage = useMemo(() => {
    if (initialGoals.length === 0) return 0;
    const sum = initialGoals.reduce((acc, goal) => acc + goal.targetGrade, 0);
    return parseFloat((sum / initialGoals.length).toFixed(1));
  }, [initialGoals]);

  // Count how many goals are met
  const goalsMetCount = useMemo(() => {
    return initialGoals.filter(goal => {
      const current = currentGradesMap.get(goal.subject);
      return current !== undefined && current !== null && current >= goal.targetGrade;
    }).length;
  }, [initialGoals, currentGradesMap]);

  // Form submission handler
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();

    const subjectName = selectedSubject === 'custom' ? customSubject.trim() : selectedSubject;
    const targetNum = parseFloat(targetGrade);

    if (!subjectName) {
      toast.error("Please select or enter a subject name.");
      return;
    }

    if (isNaN(targetNum) || targetNum < 0 || targetNum > 100) {
      toast.error("Target grade must be a number between 0 and 100.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveGoal(subjectName, targetNum);
        if (res.success) {
          toast.success(editingGoalId ? "Goal updated successfully!" : "Goal added successfully!");
          
          // Reset form
          setSelectedSubject('');
          setCustomSubject('');
          setTargetGrade('85');
          setEditingGoalId(null);
          
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err.message || "An error occurred while saving the goal.");
      }
    });
  };

  // Click edit handler
  const handleStartEdit = (goal: GoalType) => {
    setEditingGoalId(goal.id);
    
    // Check if subject is in report cards
    const exists = subjectList.some(s => s.subject === goal.subject);
    if (exists) {
      setSelectedSubject(goal.subject);
    } else {
      setSelectedSubject('custom');
      setCustomSubject(goal.subject);
    }
    setTargetGrade(goal.targetGrade.toString());
  };

  const handleCancelEdit = () => {
    setEditingGoalId(null);
    setSelectedSubject('');
    setCustomSubject('');
    setTargetGrade('85');
  };

  // Delete handler
  const handleDeleteGoal = (id: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    
    startTransition(async () => {
      try {
        const res = await deleteGoal(id);
        if (res.success) {
          toast.success("Goal removed.");
          router.refresh();
        }
      } catch (err: any) {
        toast.error("Failed to delete goal.");
      }
    });
  };

  // Subjects that don't have a goal set yet
  const availableSubjectsForNewGoal = useMemo(() => {
    return subjectList.filter(s => !initialGoals.some(g => g.subject === s.subject && g.id !== editingGoalId));
  }, [subjectList, initialGoals, editingGoalId]);

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">

      {/* Header */}
      <header className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" /> Academic Goals
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Set target grades for each subject, analyze performance gaps, and monitor your overall progress.
        </p>
      </header>

      <div className="px-4 md:px-8 space-y-8">
        {/* Top Summary Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Target vs Current Gauge Card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Overall target comparison</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>

            <div className="flex items-end justify-between mt-4">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {currentOverallAverage.toFixed(1)}%
                  <span className="text-xs text-muted-foreground font-medium ml-2">Current avg</span>
                </p>
                <p className="text-sm font-medium text-muted-foreground mt-1">
                  Goal: <span className="text-foreground font-semibold">{targetOverallAverage.toFixed(1)}%</span>
                </p>
              </div>

              {targetOverallAverage > 0 && (
                <div className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border",
                  currentOverallAverage >= targetOverallAverage
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                )}>
                  {currentOverallAverage >= targetOverallAverage ? (
                    <>On track <ArrowUpRight className="w-3.5 h-3.5" /></>
                  ) : (
                    <>-{(targetOverallAverage - currentOverallAverage).toFixed(1)}% gap</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Goals Set Card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total goals configured</span>
              <Award className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-foreground">{initialGoals.length} subjects</p>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                You have active grade targets configured for {initialGoals.length} courses.
              </p>
            </div>
          </div>

          {/* Goals Met Progress Card */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Goals achieved</span>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-3xl font-bold text-foreground">
                  {goalsMetCount} <span className="text-xs text-muted-foreground">/ {initialGoals.length} met</span>
                </p>
                <span className="text-xs font-semibold text-primary">
                  {initialGoals.length > 0 ? Math.round((goalsMetCount / initialGoals.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${initialGoals.length > 0 ? (goalsMetCount / initialGoals.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Dashboard Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Pane: Add/Edit Goal Form */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-6">
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">
                  {editingGoalId ? "Modify target goal" : "Add subject target"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingGoalId
                    ? "Update the target grade boundary for this course."
                    : "Create a target grade for your current semester subjects."
                  }
                </p>
              </div>

              <form onSubmit={handleSaveGoal} className="space-y-6">

                {/* Subject Selector */}
                <div className="space-y-2">
                  <Label htmlFor="goal-subject" className="text-xs font-medium text-muted-foreground">Subject name</Label>

                  {editingGoalId ? (
                    // In edit mode, lock the subject input name
                    <div id="goal-subject" className="h-12 rounded-xl bg-muted/40 border border-border/60 px-4 flex items-center font-semibold text-foreground">
                      {selectedSubject === 'custom' ? customSubject : selectedSubject}
                    </div>
                  ) : (
                    // In add mode, show standard selection dropdown
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger id="goal-subject" className="h-12 rounded-xl bg-muted/30 border-border/60 font-medium px-4">
                        <SelectValue placeholder="Select an academic course" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60">
                        {availableSubjectsForNewGoal.map(s => (
                          <SelectItem key={s.subject} value={s.subject} className="cursor-pointer">
                            {s.subject} {s.currentGrade !== undefined ? `(${s.currentGrade.toFixed(0)}% current)` : '(no grade yet)'}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="cursor-pointer text-primary font-medium">+ Type a custom subject…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Custom Subject Text Input */}
                {selectedSubject === 'custom' && !editingGoalId && (
                  <div className="space-y-2">
                    <Label htmlFor="goal-custom-subject" className="text-xs font-medium text-muted-foreground">Custom subject name</Label>
                    <Input
                      id="goal-custom-subject"
                      required
                      type="text"
                      value={customSubject}
                      onChange={e => setCustomSubject(e.target.value)}
                      placeholder="e.g. Advanced Chemistry"
                      className="h-12 rounded-xl bg-muted/30 border-border/60 px-4 font-medium"
                    />
                  </div>
                )}

                {/* Reference standing indicator */}
                {selectedSubjectData && (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Academic record reference</span>
                      <Info className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-sm font-semibold text-foreground">{selectedSubjectData.subject}</span>
                      <span className="text-base font-semibold text-primary">
                        {selectedSubjectData.currentGrade !== undefined
                          ? `${selectedSubjectData.currentGrade.toFixed(1)}% current`
                          : 'No grade logged'
                        }
                      </span>
                    </div>
                    {selectedSubjectData.currentGrade !== undefined && (
                      <div className="pt-2 border-t border-border/30 text-xs font-medium text-muted-foreground leading-normal">
                        {parseFloat(targetGrade) > selectedSubjectData.currentGrade ? (
                          <span>
                            Targeting a growth of <span className="text-success font-semibold">+{ (parseFloat(targetGrade) - selectedSubjectData.currentGrade).toFixed(1) }%</span> from your current standing.
                          </span>
                        ) : parseFloat(targetGrade) < selectedSubjectData.currentGrade ? (
                          <span className="text-orange-600 font-semibold">
                            Warning: target ({targetGrade}%) is below your current standing ({selectedSubjectData.currentGrade.toFixed(1)}%). Consider aiming higher!
                          </span>
                        ) : (
                          <span>Matches your current standing. Keep working hard to maintain consistency!</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Target Grade Input / Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="goal-target-grade" className="text-xs font-medium text-muted-foreground">Target grade goal</Label>
                    <span className="text-lg font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-0.5 rounded-lg">
                      {targetGrade}%
                    </span>
                  </div>

                  <input
                    id="goal-target-grade"
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={targetGrade}
                    onChange={e => setTargetGrade(e.target.value)}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary border border-border/40"
                  />

                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>Passing (50%)</span>
                    <span>Outstanding (90%+)</span>
                    <span>Perfect (100%)</span>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-2">
                  {editingGoalId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="flex-1 h-12 rounded-xl font-bold text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  )}

                  <Button
                    disabled={isPending}
                    type="submit"
                    className="flex-[2] h-12 rounded-xl font-heading font-bold text-sm shadow-sm transition-all"
                  >
                    {isPending
                      ? "Saving…"
                      : (editingGoalId ? "Update goal" : "Create target")
                    }
                  </Button>
                </div>

              </form>
            </div>
          </div>

          {/* Right Pane: Subject Comparison Cards Grid */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="font-heading font-bold text-lg text-foreground">Subject goals &amp; performance gaps</h3>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border/40">
                {initialGoals.length} active targets
              </span>
            </div>

            {initialGoals.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                No target grades set yet. Configure target percentages for your subjects in the form to track performance gaps.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {initialGoals.map(goal => {
                  const current = currentGradesMap.get(goal.subject);
                  const isGraded = current !== undefined;
                  const isMet = isGraded && current >= goal.targetGrade;
                  const gap = isGraded ? current - goal.targetGrade : 0;

                  return (
                    <div
                      key={goal.id}
                      className={cn(
                        "group relative bg-card border border-border/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[160px]",
                        isGraded
                          ? (isMet
                              ? "border-l-4 border-l-success"
                              : "border-l-4 border-l-orange-500"
                            )
                          : "border-l-4 border-l-muted-foreground/30"
                      )}
                    >
                      <div className="space-y-3">
                        {/* Title & Actions */}
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-heading font-bold text-base text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                            {goal.subject}
                          </h4>

                          <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit goal for ${goal.subject}`}
                              onClick={() => handleStartEdit(goal)}
                              className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete goal for ${goal.subject}`}
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Grade Metrics */}
                        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-2.5 rounded-xl border border-border/30 text-xs">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground leading-none block mb-1">Current standing</span>
                            <span className="font-semibold text-foreground text-sm">
                              {isGraded ? `${current.toFixed(1)}%` : "Not graded"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground leading-none block mb-1">Target goal</span>
                            <span className="font-semibold text-primary text-sm">
                              {goal.targetGrade}%
                            </span>
                          </div>
                        </div>

                        {/* Comparison Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="w-full bg-muted/65 rounded-full h-1.5 overflow-hidden border border-border/20 relative">
                            {isGraded && (
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  isMet ? "bg-success" : "bg-orange-500"
                                )}
                                style={{ width: `${Math.min(current, 100)}%` }}
                              />
                            )}
                            {/* Goal marker overlay */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-primary/80"
                              style={{ left: `${goal.targetGrade}%` }}
                              title={`Goal: ${goal.targetGrade}%`}
                            />
                          </div>

                          {/* Gap Status Message */}
                          <div className="flex items-center justify-between text-xs font-medium pt-1">
                            {isGraded ? (
                              isMet ? (
                                <span className="text-success flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Goal met (+{gap.toFixed(1)}%)
                                </span>
                              ) : (
                                <span className="text-orange-600 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Gap: {gap.toFixed(1)}%
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <HelpCircle className="w-3 h-3 text-muted-foreground/50" /> Pending first report card
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
