"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  BookOpen,
  Target,
  TrendingUp,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Link2,
  AlertTriangle,
  ChevronRight,
  BookOpenText,
  Bookmark,
  Layers,
  Sparkles,
  Trash,
  ArrowLeft,
  GraduationCap,
  BrainCircuit,
  Send,
  Save,
  Loader2,
  Split,
  CheckCircle2,
  FileCode,
  Notebook
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, normalizeSubject, isSubjectSimilar } from "@/lib/utils";
import {
  addSubject,
  renameSubject,
  deleteSubject
} from "@/lib/subject-actions";
import { saveGoal } from "@/lib/goal-actions";
import { addResource, deleteResource } from "@/lib/actions";
import { saveStudioNote } from "@/lib/studio-actions";
import { askAIBuddy } from "@/lib/ai-actions";

interface Subject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Resource {
  id: string;
  subject: string;
  title: string;
  type: string;
  url: string;
  createdAt: Date;
}

interface Homework {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  dueDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
  proofUrl: string | null;
}

interface SubjectGoal {
  id: string;
  subject: string;
  targetGrade: number;
}

interface SubjectGrade {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
}

interface ReportCard {
  id: string;
  term: string;
  overallAverage: number | null;
  createdAt: Date;
  grades: SubjectGrade[];
}

interface TutorModule {
  id: string;
  subject: string;
  title: string;
  understanding: string | null;
}

interface StudioNote {
  id: string;
  userId: string;
  subject: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SubjectsClientProps {
  initialSubjects: Subject[];
  initialResources: Resource[];
  initialHomeworks: Homework[];
  initialGoals: SubjectGoal[];
  initialReportCards: ReportCard[];
  initialTutorModules: TutorModule[];
  initialNotes: StudioNote[];
}

function parseGradeToPercentage(gradeStr: string): number {
  const parsed = parseFloat(gradeStr.replace(/[^0-9.]/g, ''));
  if (!isNaN(parsed)) return parsed;

  const upper = gradeStr.trim().toUpperCase();
  if (upper.startsWith('A+')) return 97;
  if (upper.startsWith('A')) return 93;
  if (upper.startsWith('A-')) return 90;
  if (upper.startsWith('B+')) return 87;
  if (upper.startsWith('B')) return 83;
  if (upper.startsWith('B-')) return 80;
  if (upper.startsWith('C+')) return 77;
  if (upper.startsWith('C')) return 73;
  if (upper.startsWith('C-')) return 70;
  if (upper.startsWith('D+')) return 67;
  if (upper.startsWith('D')) return 63;
  if (upper.startsWith('D-')) return 60;
  if (upper.startsWith('F')) return 50;

  return 0;
}

export function SubjectsClient({
  initialSubjects,
  initialResources,
  initialHomeworks,
  initialGoals,
  initialReportCards,
  initialTutorModules,
  initialNotes,
}: SubjectsClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  
  // Navigation states: null shows Grid landing view, otherwise shows specific subject workspace
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isGoalOpen, setIsGoalOpen] = useState(false);
  const [isResourceOpen, setIsResourceOpen] = useState(false);

  // Form states
  const [newSubjectName, setNewSubjectName] = useState("");
  const [renameSubjectName, setRenameSubjectName] = useState("");
  const [deleteCleanRelated, setDeleteCleanRelated] = useState(false);
  const [targetGoalGrade, setTargetGoalGrade] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceType, setResourceType] = useState<"LINK" | "FILE">("LINK");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  // Active targeted subject (used for card action shortcuts)
  const [targetSubject, setTargetSubject] = useState<Subject | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // DB Synced copies of other data tables (for local mutation / refresh after actions)
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [goals, setGoals] = useState<SubjectGoal[]>(initialGoals);

  // Workspace integration states
  const [notes, setNotes] = useState<StudioNote[]>(initialNotes);
  const [noteContent, setNoteContent] = useState("");
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"notes" | "resources" | "chat">("notes");
  
  // AI Coach chat states
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Filtered Subjects List
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subjects, searchQuery]);

  // Selected Subject Details
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  // Sync related entities to selected subject
  const subjectResources = useMemo(() => {
    if (!selectedSubject) return [];
    return resources.filter(
      (r) => isSubjectSimilar(r.subject, selectedSubject.name)
    );
  }, [resources, selectedSubject]);

  const subjectHomeworks = useMemo(() => {
    if (!selectedSubject) return [];
    return initialHomeworks.filter(
      (h) => isSubjectSimilar(h.subject, selectedSubject.name)
    );
  }, [initialHomeworks, selectedSubject]);

  const subjectGoal = useMemo(() => {
    if (!selectedSubject) return null;
    return goals.find((g) => isSubjectSimilar(g.subject, selectedSubject.name)) || null;
  }, [goals, selectedSubject]);

  const subjectTutorModules = useMemo(() => {
    if (!selectedSubject) return [];
    return initialTutorModules.filter(
      (t) => isSubjectSimilar(t.subject, selectedSubject.name)
    );
  }, [initialTutorModules, selectedSubject]);

  // Extract Growth Chart Data
  const chartData = useMemo(() => {
    if (!selectedSubject) return [];

    return initialReportCards
      .map((rc) => {
        const matchingGrade = rc.grades.find(
          (g) => isSubjectSimilar(g.subject, selectedSubject.name)
        );
        if (!matchingGrade) return null;
        return {
          term: rc.term,
          grade: parseGradeToPercentage(matchingGrade.grade),
          rawGrade: matchingGrade.grade,
          feedback: matchingGrade.aiFeedback,
        };
      })
      .filter((d) => d !== null) as {
      term: string;
      grade: number;
      rawGrade: string;
      feedback: string;
    }[];
  }, [initialReportCards, selectedSubject]);

  // Calculate current average grade across terms
  const currentAverage = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((acc, curr) => acc + curr.grade, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load notes content when selected subject changes
  useEffect(() => {
    if (selectedSubject) {
      const match = notes.find((n) => isSubjectSimilar(n.subject, selectedSubject.name));
      setNoteContent(match?.content || "");
      
      // Reset active workspace tab to notes
      setActiveWorkspaceTab("notes");
      
      // Initialize AI chat history with context
      setAiMessages([
        {
          role: "model",
          text: `Hi there! I am your AI Study Coach for **${selectedSubject.name}**. I have read your current course notes and stand ready to assist. Ask me any question, request a conceptual explanation, or ask for a study quiz!`,
        },
      ]);
    } else {
      setNoteContent("");
    }
  }, [selectedSubjectId]);

  // Debounced notes autosave
  useEffect(() => {
    if (!selectedSubject) return;

    // Compare with current local notes copy to prevent redundant saves
    const match = notes.find((n) => isSubjectSimilar(n.subject, selectedSubject.name));
    const currentSaved = match?.content || "";
    if (noteContent === currentSaved) return;

    setIsNoteSaving(true);
    const delay = setTimeout(async () => {
      try {
        const res = await saveStudioNote(selectedSubject.name, noteContent);
        if (res.success) {
          setNotes((prev) => {
            const exists = prev.some((n) => isSubjectSimilar(n.subject, selectedSubject.name));
            if (exists) {
              return prev.map((n) =>
                isSubjectSimilar(n.subject, selectedSubject.name)
                  ? { ...n, content: noteContent, updatedAt: new Date() }
                  : n
              );
            } else {
              return [
                ...prev,
                {
                  id: `note-${Date.now()}`,
                  userId: "",
                  subject: selectedSubject.name,
                  content: noteContent,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ];
            }
          });
        }
      } catch (err) {
        console.error("Autosave error:", err);
      } finally {
        setIsNoteSaving(false);
      }
    }, 1000);

    return () => clearTimeout(delay);
  }, [noteContent, selectedSubject, notes]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages]);

  // Handlers
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error("Subject name cannot be empty");
      return;
    }

    try {
      const res = await addSubject(newSubjectName);
      if (res.success && res.subject) {
        toast.success(`Subject "${res.subject.name}" added to master list.`);
        // Locally update subjects state
        setSubjects((prev) => [...prev, res.subject as Subject].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedSubjectId(res.subject.id);
        setNewSubjectName("");
        setIsAddOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add subject");
    }
  };

  const handleRenameSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeSub = targetSubject || selectedSubject;
    if (!activeSub) return;
    if (!renameSubjectName.trim()) {
      toast.error("Subject name cannot be empty");
      return;
    }

    try {
      const res = await renameSubject(activeSub.id, renameSubjectName);
      if (res.success) {
        toast.success(`Subject renamed to "${renameSubjectName}" and updated across all timelines.`);
        // Update subjects state locally
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === activeSub.id ? { ...s, name: renameSubjectName } : s
          ).sort((a, b) => a.name.localeCompare(b.name))
        );
        setIsRenameOpen(false);
        setTargetSubject(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rename subject");
    }
  };

  const handleDeleteSubject = async () => {
    const activeSub = targetSubject || selectedSubject;
    if (!activeSub) return;

    try {
      const res = await deleteSubject(activeSub.id, deleteCleanRelated);
      if (res.success) {
        toast.success(
          deleteCleanRelated
            ? `Subject "${activeSub.name}" and all its related records deleted.`
            : `Subject "${activeSub.name}" deleted from master list.`
        );
        // Remove from local subjects
        const updatedSubjects = subjects.filter((s) => s.id !== activeSub.id);
        setSubjects(updatedSubjects);
        if (selectedSubjectId === activeSub.id) {
          setSelectedSubjectId(null);
        }
        setIsDeleteOpen(false);
        setDeleteCleanRelated(false);
        setTargetSubject(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subject");
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    const val = parseFloat(targetGoalGrade);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error("Please enter a valid target grade percentage between 0 and 100.");
      return;
    }

    try {
      const res = await saveGoal(selectedSubject.name, val);
      if (res.success && res.goal) {
        toast.success(`Goal of ${val}% target saved for ${selectedSubject.name}.`);
        // Update goals locally
        setGoals((prev) => {
          const filtered = prev.filter((g) => g.subject !== selectedSubject.name);
          return [...filtered, res.goal as SubjectGoal];
        });
        setIsGoalOpen(false);
        setTargetGoalGrade("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save goal");
    }
  };

  const handleAddResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    if (!resourceTitle.trim()) {
      toast.error("Resource title is required");
      return;
    }

    const formData = new FormData();
    formData.append("subject", selectedSubject.name);
    formData.append("title", resourceTitle);
    formData.append("type", resourceType);

    if (resourceType === "LINK") {
      if (!resourceUrl.trim()) {
        toast.error("Please specify link URL");
        return;
      }
      formData.append("url", resourceUrl);
    } else {
      if (!resourceFile) {
        toast.error("Please select a resource file to upload");
        return;
      }
      formData.append("file", resourceFile);
    }

    try {
      toast.loading("Uploading study resource...", { id: "resource-upload" });
      await addResource(formData);
      toast.success("Study resource added!", { id: "resource-upload" });

      const mockResource: Resource = {
        id: `mock-${Date.now()}`,
        subject: selectedSubject.name,
        title: resourceTitle,
        type: resourceType,
        url: resourceType === "LINK" ? resourceUrl : `/uploads/${resourceFile?.name || "file"}`,
        createdAt: new Date(),
      };
      setResources((prev) => [mockResource, ...prev]);

      setResourceTitle("");
      setResourceUrl("");
      setResourceFile(null);
      setIsResourceOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add resource", { id: "resource-upload" });
    }
  };

  const handleDeleteResource = async (resId: string) => {
    if (!selectedSubject) return;
    try {
      await deleteResource(resId, selectedSubject.name);
      toast.success("Resource deleted.");
      setResources((prev) => prev.filter((r) => r.id !== resId));
    } catch (err: any) {
      toast.error("Failed to delete resource");
    }
  };

  const handleSendAiQuery = async (queryText?: string) => {
    if (!selectedSubject) return;
    const textToSend = queryText || aiQuery;
    if (!textToSend.trim()) return;

    // Add user message to chat state
    const newMsg = { role: "user" as const, text: textToSend };
    setAiMessages((prev) => [...prev, newMsg]);
    
    // Clear input if sending from input box
    if (!queryText) {
      setAiQuery("");
    }

    setIsAiLoading(true);

    try {
      const history = aiMessages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const systemPrompt = `You are an expert AI Study Coach helping the user pass their exams for the subject: ${selectedSubject.name}.
Here are the user's current notes for this course to use as primary context:
"""
${noteContent || "(No notes written yet. Tell the user to write notes in the 'Course Notes' editor to give you context.)"}
"""
Explain concepts in clear, direct English. Break down tasks into easy steps. Create quizzes, active recall questions, or summaries if asked.`;

      const res = await askAIBuddy(textToSend, history, undefined, undefined, systemPrompt);
      if (res.error) {
        setAiMessages((prev) => [
          ...prev,
          { role: "model", text: `I encountered an error: ${res.error}` },
        ]);
      } else if (res.text) {
        setAiMessages((prev) => [
          ...prev,
          { role: "model", text: res.text },
        ]);
      }
    } catch (err: any) {
      setAiMessages((prev) => [
        ...prev,
        { role: "model", text: `Error connecting to Study Coach: ${err.message || String(err)}` },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      
      {/* LANDING GRID VIEW (When selectedSubjectId is null) */}
      {!selectedSubjectId ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Dashboard Control Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 p-6 rounded-[32px] shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4.5 h-4.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-2xl h-11 bg-muted/30 border border-border/50 text-xs font-semibold"
                />
              </div>
              <span className="text-xs font-bold text-muted-foreground hidden sm:inline-block">
                Total Courses: <span className="text-primary font-black">{subjects.length}</span>
              </span>
            </div>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 active:scale-95 transition-transform shrink-0"
            >
              <Plus className="w-4.5 h-4.5" />
              Add Subject
            </Button>
          </div>

          {/* Subjects Grid (12 Columns, each subject card takes 3 columns = 4 per row on large screens) */}
          {filteredSubjects.length === 0 ? (
            <Card className="p-16 text-center border-dashed border-2 border-border/50 rounded-[32px] bg-card/40 backdrop-blur-md">
              <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 bg-muted/50 rounded-full inline-block">
                  <BookOpenText className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <h3 className="text-xl font-heading font-black">No Courses Registered</h3>
                <p className="text-muted-foreground text-sm font-semibold">
                  You haven't added any subjects to your workstation. Create one to start tracking your syllabus resources, grades, and goals.
                </p>
                <Button onClick={() => setIsAddOpen(true)} className="rounded-xl font-bold">
                  Create a Subject
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredSubjects.map((s) => {
                const normalizedName = normalizeSubject(s.name);
                
                // Fetch stats for this specific subject
                const hwPending = initialHomeworks.filter(
                  (h) => isSubjectSimilar(h.subject, s.name) && !h.isCompleted
                ).length;
                const resCount = resources.filter(
                  (r) => isSubjectSimilar(r.subject, s.name)
                ).length;
                const targetGoal = goals.find(
                  (g) => isSubjectSimilar(g.subject, s.name)
                );
                
                // Get latest grade for this subject
                const subjectGrades = initialReportCards
                  .map((rc) => rc.grades.find((g) => isSubjectSimilar(g.subject, s.name)))
                  .filter(Boolean) as SubjectGrade[];
                const latestGrade = subjectGrades.length > 0 ? subjectGrades[subjectGrades.length - 1].grade : null;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSubjectId(s.id);
                      setRenameSubjectName(s.name);
                    }}
                    className="group bg-card border border-border/60 rounded-[28px] p-6 shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetSubject(s);
                              setRenameSubjectName(s.name);
                              setIsRenameOpen(true);
                            }}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            title="Rename Subject"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetSubject(s);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subject Name */}
                      <div>
                        <h3 className="font-heading font-black text-lg text-foreground tracking-tight line-clamp-2 leading-snug">
                          {s.name}
                        </h3>
                      </div>
                    </div>

                    {/* Stats Metrics Grid */}
                    <div className="border-t border-border/40 pt-4 mt-4 grid grid-cols-2 gap-3 text-[11px] font-bold text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{hwPending} Homeworks</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Layers className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">{resCount} Assets</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span className="truncate">{targetGoal ? `Target ${targetGoal.targetGrade}%` : "No Goal"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingUp className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="truncate text-foreground font-black">{latestGrade ? `Grade: ${latestGrade}` : "Ungraded"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* DEDICATED WORKSPACE VIEW (When a subject is selected) */
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Breadcrumb Nav Control */}
          <div className="flex items-center">
            <Button
              onClick={() => setSelectedSubjectId(null)}
              variant="ghost"
              className="rounded-xl font-bold text-xs hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Course Grid
            </Button>
          </div>

          {/* Subject Control Header */}
          <div className="bg-card border border-border/60 p-8 rounded-[32px] shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider text-primary/60">Active Subject Workspace</p>
              <h2 className="text-2xl md:text-3xl font-heading font-black tracking-tight text-foreground mt-2 leading-tight select-all break-words">
                {selectedSubject?.name}
              </h2>
            </div>
            <div className="flex gap-2 shrink-0 md:mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRenameSubjectName(selectedSubject?.name || "");
                  setIsRenameOpen(true);
                }}
                className="rounded-xl font-bold hover:bg-muted/80 text-foreground flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Edit3 className="w-4 h-4" />
                Rename
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteOpen(true)}
                className="rounded-xl font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>

          {/* Split-Screen desktop-grade workstation grid (Left Span: 5, Right Span: 7) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Mastery & Performance Radar (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* 1. Academic Growth Curve (Recharts) */}
              <Card className="bg-card border border-border/60 p-6 rounded-[28px] shadow-sm flex flex-col justify-between min-h-[340px]">
                <div className="mb-4">
                  <h3 className="text-base font-heading font-black text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-primary" />
                    Academic Growth Curve
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    Historical standings from uploaded and manual term report cards.
                  </p>
                </div>

                <div className="flex-1 min-h-[180px] w-full flex items-center justify-center relative">
                  {isMounted && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary, #3b82f6)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-primary, #3b82f6)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
                        <XAxis
                          dataKey="term"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fontWeight: "bold", fill: "rgb(156, 163, 175)" }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fontWeight: "bold", fill: "rgb(156, 163, 175)" }}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "16px",
                            border: "none",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                            fontWeight: "bold",
                            fontSize: "10px",
                            background: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                          }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value}% (${props.payload.rawGrade})`,
                            "Grade"
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="grade"
                          stroke="var(--color-primary, #3b82f6)"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorGrade)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center space-y-2 p-6">
                      <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        No grade history found. Upload your report card or add scores on the <a href="/marks" className="text-primary hover:underline font-bold">Marks</a> page.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* 2. Target Goal & Gap Indicator Card */}
              <Card className="bg-card border border-border/60 p-6 rounded-[28px] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-heading font-black text-foreground flex items-center gap-2">
                    <Target className="w-4.5 h-4.5 text-orange-500" />
                    Target Goal & Gap Indicator
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    Benchmark standing gap analysis.
                  </p>
                </div>

                <div className="my-5 p-4 bg-muted/20 border border-border/30 rounded-2xl flex flex-col justify-center space-y-3">
                  {subjectGoal ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Goal Target</p>
                          <p className="text-2xl font-heading font-black text-orange-500 mt-1">{subjectGoal.targetGrade}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Current Average</p>
                          <p className="text-2xl font-heading font-black text-primary mt-1">
                            {currentAverage !== null ? `${currentAverage}%` : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Goal progress indicator bar */}
                      {currentAverage !== null && (
                        <div className="space-y-1.5">
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                currentAverage >= subjectGoal.targetGrade ? "bg-emerald-500" : "bg-primary"
                              )} 
                              style={{ width: `${Math.min(100, (currentAverage / subjectGoal.targetGrade) * 100)}%` }} 
                            />
                            {/* Target marker */}
                            <div className="absolute right-[5%] top-0 h-full w-[2px] bg-orange-500" title="Target goal line" />
                          </div>
                          
                          <p className="text-[10.5px] font-bold leading-normal">
                            {currentAverage >= subjectGoal.targetGrade ? (
                              <span className="text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Target achieved! You are {currentAverage - subjectGoal.targetGrade}% above benchmark.
                              </span>
                            ) : (
                              <span className="text-amber-500 flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> You need +{subjectGoal.targetGrade - currentAverage}% more to meet your targeted goal.
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-2">
                      <Target className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        Set a clear performance goal percentage for this course.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    setTargetGoalGrade(subjectGoal ? String(subjectGoal.targetGrade) : "");
                    setIsGoalOpen(true);
                  }}
                  variant={subjectGoal ? "outline" : "default"}
                  className="w-full rounded-xl font-bold text-xs h-10 active:scale-95 transition-transform"
                >
                  {subjectGoal ? "Modify Grade Goal" : "Set Target Goal"}
                </Button>
              </Card>

              {/* 3. Homework Assignments Tracker List */}
              <Card className="bg-card border border-border/60 p-6 rounded-[28px] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-heading font-black text-foreground flex items-center gap-2">
                    <BookOpen className="w-4.5 h-4.5 text-blue-500" />
                    Homework Tracker
                  </h3>
                  
                  {subjectHomeworks.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border/40 text-muted-foreground">
                      {subjectHomeworks.filter(h => h.isCompleted).length}/{subjectHomeworks.length} Done
                    </span>
                  )}
                </div>

                {subjectHomeworks.length > 0 && (
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500" 
                      style={{ 
                        width: `${(subjectHomeworks.filter(h => h.isCompleted).length / subjectHomeworks.length) * 100}%` 
                      }} 
                    />
                  </div>
                )}

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {subjectHomeworks.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground italic text-xs font-semibold border border-dashed border-border/40 rounded-xl">
                      No homework assignments found for this course.
                    </div>
                  ) : (
                    subjectHomeworks.map((hw) => (
                      <div
                        key={hw.id}
                        className={cn(
                          "p-3 rounded-2xl border flex items-center justify-between text-xs transition-all",
                          hw.isCompleted
                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted/20 border-border/40 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate leading-snug">{hw.title}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                            Due: {new Date(hw.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ml-3 shrink-0",
                          hw.isCompleted
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/10 text-amber-500"
                        )}>
                          {hw.isCompleted ? "Done" : "Pending"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

            </div>

            {/* RIGHT COLUMN: Unified Study Vault Workspace (lg:col-span-7) */}
            <Card className="lg:col-span-7 bg-card border border-border/60 rounded-[28px] overflow-hidden flex flex-col h-[750px] shadow-sm">
              
              {/* Tab Header Selector */}
              <div className="bg-muted/40 border-b border-border/50 p-4 shrink-0 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setActiveWorkspaceTab("notes")}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all",
                      activeWorkspaceTab === "notes"
                        ? "bg-background text-foreground shadow-sm border border-border/40 font-black"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    )}
                  >
                    <Notebook className="w-4 h-4" />
                    Course Notes
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("resources")}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all",
                      activeWorkspaceTab === "resources"
                        ? "bg-background text-foreground shadow-sm border border-border/40 font-black"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    )}
                  >
                    <Layers className="w-4 h-4" />
                    Study Vault
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab("chat")}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all",
                      activeWorkspaceTab === "chat"
                        ? "bg-background text-foreground shadow-sm border border-border/40 font-black"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    )}
                  >
                    <BrainCircuit className="w-4 h-4" />
                    AI Study Buddy
                  </button>
                </div>

                {/* Additional dynamic status indicators on header */}
                {activeWorkspaceTab === "notes" && (
                  <div className="flex items-center gap-2 text-[10.5px] font-bold text-muted-foreground">
                    {isNoteSaving ? (
                      <span className="flex items-center gap-1 text-amber-500 font-semibold animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Tab Content Body (Unified height & scroll control) */}
              <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                
                {/* TAB 1: Live Course Notes Editor */}
                {activeWorkspaceTab === "notes" && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-b border-border/20 pb-2">
                      <span>Live Note Editor (Auto-Saves)</span>
                      <span>Words: {noteContent.trim().split(/\s+/).filter(Boolean).length}</span>
                    </div>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Type your course syllabus details, key formulas, lecture definitions, and exam reminders here. The AI Study Buddy will automatically parse these notes and use them as instant reference context..."
                      className="w-full flex-1 bg-muted/10 border border-border/40 rounded-xl p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary overflow-y-auto"
                    />
                    <p className="text-[10px] text-muted-foreground/80 italic font-semibold leading-relaxed">
                      ✍️ Type freely. Autosave saves your notes locally in the background. Markdown headers (#, ##), bullet points, and code snippets are supported.
                    </p>
                  </div>
                )}

                {/* TAB 2: Study Vault resources with inline form */}
                {activeWorkspaceTab === "resources" && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-5">
                    {/* Inline add resource asset form */}
                    <form onSubmit={handleAddResourceSubmit} className="bg-muted/20 border border-border/40 p-4 rounded-2xl space-y-3.5">
                      <p className="text-xs font-black uppercase text-primary/75 tracking-wider">Quick Add Assets</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="inlineResTitle" className="text-[10px] font-black uppercase text-muted-foreground/80">Title</Label>
                          <Input
                            id="inlineResTitle"
                            placeholder="e.g. Lectures PDF / Git Repo"
                            value={resourceTitle}
                            onChange={(e) => setResourceTitle(e.target.value)}
                            className="rounded-xl border border-border bg-background font-bold h-9 text-xs"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground/80">Asset Type</Label>
                          <div className="grid grid-cols-2 gap-1 bg-background border border-border/40 p-0.5 rounded-lg h-9">
                            <button
                              type="button"
                              onClick={() => setResourceType("LINK")}
                              className={cn(
                                "text-[10.5px] font-bold rounded-md transition-all",
                                resourceType === "LINK" ? "bg-muted shadow text-foreground font-black" : "text-muted-foreground"
                              )}
                            >
                              URL Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setResourceType("FILE")}
                              className={cn(
                                "text-[10.5px] font-bold rounded-md transition-all",
                                resourceType === "FILE" ? "bg-muted shadow text-foreground font-black" : "text-muted-foreground"
                              )}
                            >
                              Local PDF
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex-1 min-w-0">
                          {resourceType === "LINK" ? (
                            <div className="space-y-1">
                              <Label htmlFor="inlineResUrl" className="text-[10px] font-black uppercase text-muted-foreground/80">Link URL</Label>
                              <Input
                                id="inlineResUrl"
                                placeholder="e.g. https://github.com/..."
                                value={resourceUrl}
                                onChange={(e) => setResourceUrl(e.target.value)}
                                className="rounded-xl border border-border bg-background font-bold h-9 text-xs"
                                required={resourceType === "LINK"}
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label htmlFor="inlineResFile" className="text-[10px] font-black uppercase text-muted-foreground/80">Select Local File</Label>
                              <Input
                                id="inlineResFile"
                                type="file"
                                onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                                className="rounded-xl border border-border bg-background font-bold h-9 text-xs pt-1.5 cursor-pointer"
                                required={resourceType === "FILE"}
                              />
                            </div>
                          )}
                        </div>

                        <Button 
                          type="submit" 
                          className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs h-9 px-4 active:scale-95 transition-transform"
                        >
                          Add Asset
                        </Button>
                      </div>
                    </form>

                    {/* Resources List */}
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Vault Inventory</p>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {subjectResources.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground italic text-xs font-semibold border border-dashed border-border/40 rounded-2xl">
                            Vault is empty. Add reference web links or course PDFs above.
                          </div>
                        ) : (
                          subjectResources.map((res) => (
                            <div
                              key={res.id}
                              className="p-3.5 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                {res.type === "LINK" ? (
                                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                                    <Link2 className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-foreground truncate" title={res.title}>
                                    {res.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">
                                    {res.url}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                <a href={res.url} target="_blank" rel="noopener noreferrer">
                                  <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </a>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteResource(res.id)}
                                  className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: AI Study Coach chat module */}
                {activeWorkspaceTab === "chat" && (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    
                    {/* Floating suggestions helper */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSendAiQuery("Summarize my current course notes.")}
                        disabled={isAiLoading}
                        className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-500/20 active:scale-95 transition-all"
                      >
                        📝 Summarize Notes
                      </button>
                      <button
                        onClick={() => handleSendAiQuery("Quiz me on 5 key active recall questions based on my notes.")}
                        disabled={isAiLoading}
                        className="px-2.5 py-1 text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 active:scale-95 transition-all"
                      >
                        ❓ Quiz Me
                      </button>
                      <button
                        onClick={() => handleSendAiQuery("Explain the most critical core concept in these notes.")}
                        disabled={isAiLoading}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 active:scale-95 transition-all"
                      >
                        💡 Explain Core Concept
                      </button>
                    </div>

                    {/* Chat Messages Frame */}
                    <div className="flex-1 overflow-y-auto border border-border/40 bg-muted/10 rounded-2xl p-4 space-y-4 min-h-0 flex flex-col">
                      {aiMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed break-words",
                            msg.role === "user"
                              ? "self-end bg-primary text-primary-foreground rounded-tr-none"
                              : "self-start bg-muted/40 border border-border/40 text-foreground rounded-tl-none"
                          )}
                        >
                          {/* Markdown rendering simulation (replaces bold markers) */}
                          <div
                            className="font-semibold whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: msg.text
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            }}
                          />
                        </div>
                      ))}
                      
                      {isAiLoading && (
                        <div className="self-start bg-muted/40 border border-border/40 rounded-2xl rounded-tl-none p-3 max-w-[85%] flex items-center gap-2 text-xs font-semibold text-muted-foreground animate-pulse shrink-0">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          Study Coach is reviewing notes...
                        </div>
                      )}
                      
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Chat input console */}
                    <div className="shrink-0 flex items-center gap-2">
                      <Input
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="Ask Study Buddy about course notes / explain concepts..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendAiQuery();
                          }
                        }}
                        disabled={isAiLoading}
                        className="rounded-xl border border-border bg-muted/20 font-bold text-xs h-10 flex-1"
                      />
                      <Button
                        onClick={() => handleSendAiQuery()}
                        disabled={isAiLoading || !aiQuery.trim()}
                        className="rounded-xl font-bold bg-primary text-primary-foreground h-10 w-10 p-0 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>

                  </div>
                )}

              </div>

            </Card>

          </div>

        </div>
      )}

      {/* Dialog: Add Subject */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <form onSubmit={handleAddSubject}>
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-2xl font-heading font-black tracking-tight">Add New Subject</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Register a new course in your master timetable workspace database.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-black uppercase text-muted-foreground/80">Subject Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Embedded Systems"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="rounded-xl border border-border bg-muted/20 font-bold h-11"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl font-bold flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Create Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Subject */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <form onSubmit={handleRenameSubject}>
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-2xl font-heading font-black tracking-tight">Rename Subject</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Updates this subject name across all existing tables, schedules, history, and goals.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="renameName" className="text-xs font-black uppercase text-muted-foreground/80">Subject Name</Label>
                <Input
                  id="renameName"
                  value={renameSubjectName}
                  onChange={(e) => setRenameSubjectName(e.target.value)}
                  className="rounded-xl border border-border bg-muted/20 font-bold h-11"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => {
                setIsRenameOpen(false);
                setTargetSubject(null);
              }} className="rounded-xl font-bold flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl font-bold flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Subject (Cascading choice modal) */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <DialogTitle className="text-2xl font-heading font-black tracking-tight flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Delete Subject?
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              Are you sure you want to remove <span className="font-bold text-foreground">"{targetSubject?.name || selectedSubject?.name}"</span>?
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <Checkbox
              id="cascade"
              checked={deleteCleanRelated}
              onCheckedChange={(checked) => setDeleteCleanRelated(!!checked)}
              className="mt-0.5 border-red-500/40 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
            />
            <Label htmlFor="cascade" className="text-xs text-muted-foreground/80 font-bold leading-relaxed cursor-pointer select-none">
              Cascade Delete: Completely delete all associated homeworks, resources, target goals, schedule templates, and report card grades for this subject.
            </Label>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => {
              setIsDeleteOpen(false);
              setTargetSubject(null);
            }} className="rounded-xl font-bold flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubject} className="rounded-xl font-bold flex-1">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Set Goal */}
      <Dialog open={isGoalOpen} onOpenChange={setIsGoalOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <form onSubmit={handleSaveGoal}>
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-2xl font-heading font-black tracking-tight">Set Academic Target</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Set a benchmark goal grade percentage for {selectedSubject?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="goalGrade" className="text-xs font-black uppercase text-muted-foreground/80">Target Percentage (%)</Label>
                <Input
                  id="goalGrade"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 85.0"
                  value={targetGoalGrade}
                  onChange={(e) => setTargetGoalGrade(e.target.value)}
                  className="rounded-xl border border-border bg-muted/20 font-bold h-11"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsGoalOpen(false)} className="rounded-xl font-bold flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl font-bold flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Save Goal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Resource */}
      <Dialog open={isResourceOpen} onOpenChange={setIsResourceOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <form onSubmit={handleAddResourceSubmit}>
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-2xl font-heading font-black tracking-tight">Add Resource</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Attach a bookmark URL link or upload a local syllabus file for {selectedSubject?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-black uppercase text-muted-foreground/80">Resource Type</Label>
                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setResourceType("LINK")}
                    className={cn(
                      "py-2 text-xs font-bold rounded-lg transition-all",
                      resourceType === "LINK" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                    )}
                  >
                    Link URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setResourceType("FILE")}
                    className={cn(
                      "py-2 text-xs font-bold rounded-lg transition-all",
                      resourceType === "FILE" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                    )}
                  >
                    Local File
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="resTitle" className="text-xs font-black uppercase text-muted-foreground/80">Title</Label>
                <Input
                  id="resTitle"
                  placeholder="e.g. Lectures PDF / Git Repository"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="rounded-xl border border-border bg-muted/20 font-bold h-11"
                  required
                />
              </div>

              {resourceType === "LINK" ? (
                <div className="space-y-1">
                  <Label htmlFor="resUrl" className="text-xs font-black uppercase text-muted-foreground/80">Link URL</Label>
                  <Input
                    id="resUrl"
                    placeholder="e.g. https://github.com/..."
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="rounded-xl border border-border bg-muted/20 font-bold h-11"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="resFile" className="text-xs font-black uppercase text-muted-foreground/80">Upload File</Label>
                  <Input
                    id="resFile"
                    type="file"
                    onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                    className="rounded-xl border border-border bg-muted/20 font-bold h-11 cursor-pointer pt-2"
                    required
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsResourceOpen(false)} className="rounded-xl font-bold flex-1">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl font-bold flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                Add Resource
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hide ugly scrollbars globally in workspace */}
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
          display: none !important;
        }
      `}} />
    </div>
  );
}
