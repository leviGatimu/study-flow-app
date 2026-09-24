"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Wand2,
  Search,
  Trash2,
  Edit3,
  BookOpen,
  BookOpenText,
  Target,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Send,
  Loader2,
  CheckCircle2,
  FolderOpen,
  CalendarClock,
  ListChecks,
  NotebookPen,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { HubTile } from "@/components/ui/hub-tile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, normalizeSubject, isSubjectSimilar } from "@/lib/utils";
import { useIsArchived } from "@/components/ArchiveContext";
import {
  addSubject,
  renameSubject,
  deleteSubject,
  repairSubjects
} from "@/lib/subject-actions";
import { saveGoal } from "@/lib/goal-actions";
import { askAIBuddy } from "@/lib/ai-actions";
import { AddMasteryForm } from "@/components/AddMasteryForm";
import { MasteryList } from "@/components/MasteryList";

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

interface StudioNote {
  id: string;
  userId: string;
  subject: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExamEvent {
  id: string;
  title: string;
  date: Date;
  subject: { name: string } | null;
}

interface MasteryItem {
  id: string;
  subject: string;
  title: string;
  isCompleted: boolean;
}

interface SubjectsClientProps {
  initialSubjects: Subject[];
  initialResources: Resource[];
  initialHomeworks: Homework[];
  initialGoals: SubjectGoal[];
  initialReportCards: ReportCard[];
  initialNotes: StudioNote[];
  initialExams: ExamEvent[];
  initialMastery: MasteryItem[];
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

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Exams from today on, soonest first. */
function upcomingExams(exams: ExamEvent[]): ExamEvent[] {
  const today = startOfToday();
  return exams
    .filter((e) => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** "Today", "Tomorrow", "In 5 days" - or "None coming" when there is no exam. */
function examCountdown(exam: ExamEvent | null): string {
  if (!exam) return "None coming";
  const days = differenceInCalendarDays(new Date(exam.date), startOfToday());
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function shortDate(date: Date): string {
  return format(new Date(date), "EEE d MMM");
}

function isOverdue(hw: Homework): boolean {
  return !hw.isCompleted && new Date(hw.dueDate) < startOfToday();
}

/** Up to two letters that stand in for a subject's icon: "C programming" -> "CP". */
function subjectInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Percentage points, without float noise ("7.1", not "7.099999"). */
function points(value: number): string {
  return String(Math.round(value * 10) / 10);
}

const NOTE_CONTEXT_LIMIT = 8000;

export function SubjectsClient({
  initialSubjects,
  initialResources,
  initialHomeworks,
  initialGoals,
  initialReportCards,
  initialNotes,
  initialExams,
  initialMastery,
}: SubjectsClientProps) {
  const router = useRouter();
  const archived = useIsArchived();
  const [isMounted, setIsMounted] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isGoalOpen, setIsGoalOpen] = useState(false);

  // Form states
  const [newSubjectName, setNewSubjectName] = useState("");
  const [renameSubjectName, setRenameSubjectName] = useState("");
  const [deleteCleanRelated, setDeleteCleanRelated] = useState(false);
  const [targetGoalGrade, setTargetGoalGrade] = useState("");

  // Active targeted subject (used for card action shortcuts)
  const [targetSubject, setTargetSubject] = useState<Subject | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const resources = initialResources;
  const [goals, setGoals] = useState<SubjectGoal[]>(initialGoals);

  // AI study buddy chat
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Filtered Subjects List
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subjects, searchQuery]);

  // The open subject lives in the URL (/subjects?subject=Math), so other
  // pages can link straight to it and the browser's Back returns to the grid.
  // An exact name wins; the similarity match catches "Maths" for "Math".
  const subjectParam = useSearchParams().get("subject");
  const selectedSubject = useMemo(() => {
    if (!subjectParam) return null;
    return (
      subjects.find((s) => s.name === subjectParam) ??
      subjects.find((s) => isSubjectSimilar(s.name, subjectParam)) ??
      null
    );
  }, [subjects, subjectParam]);
  const selectedSubjectId = selectedSubject?.id ?? null;

  const subjectUrl = (name: string | null) =>
    name ? `/subjects?subject=${encodeURIComponent(name)}` : "/subjects";
  const openSubject = (name: string | null) => window.history.pushState(null, "", subjectUrl(name));

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

  const subjectExams = useMemo(() => {
    if (!selectedSubject) return [];
    return initialExams.filter((e) => isSubjectSimilar(e.subject?.name ?? e.title, selectedSubject.name));
  }, [initialExams, selectedSubject]);

  // Mirrors getMasteryItems: syllabus topics are filed under the normalized name.
  const subjectMastery = useMemo(() => {
    if (!selectedSubject) return [];
    const key = normalizeSubject(selectedSubject.name);
    return initialMastery.filter((m) => m.subject === key);
  }, [initialMastery, selectedSubject]);

  const subjectGoal = useMemo(() => {
    if (!selectedSubject) return null;
    return goals.find((g) => isSubjectSimilar(g.subject, selectedSubject.name)) || null;
  }, [goals, selectedSubject]);

  // Notes are written in the Deep work studio; here they are only context for the AI.
  const subjectNote = useMemo(() => {
    if (!selectedSubject) return "";
    return initialNotes.find((n) => isSubjectSimilar(n.subject, selectedSubject.name))?.content.trim() ?? "";
  }, [initialNotes, selectedSubject]);

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

  // A new subject starts a new conversation.
  useEffect(() => {
    if (!selectedSubject) return;
    setAiMessages([
      {
        role: "model",
        text: `Hi! I'm your study buddy for **${selectedSubject.name}**. I can see its syllabus topics, pending homework and upcoming exams${subjectNote ? ", plus your notes from the studio" : ""}. Ask me to explain something, quiz you, or plan what to revise next.`,
      },
    ]);
  }, [selectedSubjectId]);

  // Keep the newest message in view. Scrolls the chat box only - scrollIntoView
  // would also drag the whole page down to the chat on every subject open.
  useEffect(() => {
    const box = chatScrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [aiMessages, isAiLoading]);

  // Handlers
  const handleRepair = async () => {
    setIsRepairing(true);
    try {
      const res = await repairSubjects();
      const removed = res.removedRevision + res.removedDuplicates;
      if (removed === 0) {
        toast.success("Nothing to tidy - your subject list is already clean.");
      } else {
        toast.success(
          `Tidied up: removed ${res.removedRevision} revision entr${res.removedRevision === 1 ? "y" : "ies"} and ${res.removedDuplicates} duplicate${res.removedDuplicates === 1 ? "" : "s"}.`
        );
        // Refetch rather than filter locally: which rows the duplicate pass
        // collapsed is decided on the server, so the client cannot reproduce
        // the result without guessing.
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Could not tidy the subject list");
    } finally {
      setIsRepairing(false);
    }
  };

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
        openSubject(res.subject.name);
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
        if (activeSub.id === selectedSubjectId) {
          window.history.replaceState(null, "", subjectUrl(renameSubjectName));
        }
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
          window.history.replaceState(null, "", subjectUrl(null));
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

  /** What the AI knows about the open subject, rebuilt from live data on every question. */
  const buildBuddyPrompt = (subjectName: string) => {
    const topics = subjectMastery.length
      ? subjectMastery.map((m) => `- [${m.isCompleted ? "x" : " "}] ${m.title}`).join("\n")
      : "(No syllabus topics listed yet.)";
    const pending = subjectHomeworks.filter((h) => !h.isCompleted);
    const homework = pending.length
      ? pending.map((h) => `- ${h.title} (due ${format(new Date(h.dueDate), "EEE d MMM yyyy")})`).join("\n")
      : "(No pending homework.)";
    const exams = upcomingExams(subjectExams);
    const examList = exams.length
      ? exams.map((e) => `- ${e.title} on ${format(new Date(e.date), "EEE d MMM yyyy")}`).join("\n")
      : "(No upcoming exams.)";
    const note = subjectNote.length > NOTE_CONTEXT_LIMIT
      ? `${subjectNote.slice(0, NOTE_CONTEXT_LIMIT)}\n[...notes truncated]`
      : subjectNote;

    return `You are an expert AI Study Coach helping the user pass their exams for the subject: ${subjectName}.
Today is ${format(new Date(), "EEEE d MMMM yyyy")}.

Syllabus topics ([x] = mastered, [ ] = not yet):
${topics}

Pending homework:
${homework}

Upcoming exams:
${examList}

The user's own notes for this subject (written in the Deep work studio):
"""
${note || "(No notes written yet.)"}
"""

Use this as context. Prioritise topics not yet mastered and anything due or examined soon.
Explain concepts in clear, direct English. Break down tasks into easy steps. Create quizzes, active recall questions, or summaries if asked.`;
  };

  const handleSendAiQuery = async (queryText?: string) => {
    if (!selectedSubject) return;
    const textToSend = queryText || aiQuery;
    if (!textToSend.trim()) return;

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

      const systemPrompt = buildBuddyPrompt(selectedSubject.name);

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

  // Section-wide facts for the hub tiles on the grid view.
  const allUpcomingExams = upcomingExams(initialExams);
  const nextExamOverall = allUpcomingExams[0] ?? null;
  const allPendingHomework = initialHomeworks.filter((h) => !h.isCompleted);
  const overdueCount = allPendingHomework.filter(isOverdue).length;
  const nextDueOverall = allPendingHomework
    .filter((h) => !isOverdue(h))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null;
  const resourceSubjectCount = new Set(resources.map((r) => normalizeSubject(r.subject))).size;

  const suggestions = [
    { label: "Quiz me", prompt: "Quiz me with 5 active recall questions on my topics for this subject." },
    { label: "What should I revise next?", prompt: "Given my topics, homework and exams, what should I revise next and why?" },
    { label: "Explain a weak topic", prompt: "Pick a topic I have not mastered yet and explain it simply." },
    ...(subjectNote ? [{ label: "Summarize my notes", prompt: "Summarize my notes for this subject." }] : []),
  ];

  return (
    <div>
      {!selectedSubjectId ? (
        /* GRID VIEW - the Subjects section's hub */
        <div className="space-y-6">
          <div data-tour="subjects-hero">
            <PageHeader
              className="pb-0"
              title="Subjects"
              description="Open a subject to see its homework, exams, marks, files and syllabus together."
              actions={
                !archived && (
                  <>
                    {/* Tidying up used to happen invisibly on every page that listed
                        subjects. It is a deliberate action now, and only here. */}
                    <Button
                      variant="outline"
                      onClick={handleRepair}
                      disabled={isRepairing}
                      title="Remove '(revision)' entries and merge duplicate subjects"
                    >
                      <Wand2 />
                      {isRepairing ? "Tidying..." : "Tidy up"}
                    </Button>
                    <Button onClick={() => setIsAddOpen(true)}>
                      <Plus />
                      Add subject
                    </Button>
                  </>
                )
              }
            />
          </div>

          <nav aria-label="Across all subjects" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HubTile
              href="/exams"
              icon={<CalendarClock />}
              tone="orange"
              label="Exams"
              value={examCountdown(nextExamOverall)}
              detail={
                nextExamOverall
                  ? `${nextExamOverall.title} · ${shortDate(nextExamOverall.date)}`
                  : "Nothing scheduled"
              }
            />
            <HubTile
              href="/homeworks"
              icon={<BookOpen />}
              tone="blue"
              label="Homework"
              value={`${allPendingHomework.length} pending`}
              detail={
                overdueCount > 0
                  ? `${overdueCount} overdue`
                  : nextDueOverall
                    ? `Next: ${nextDueOverall.title} · ${shortDate(nextDueOverall.dueDate)}`
                    : "All caught up"
              }
            />
            <HubTile
              href="/resources"
              icon={<FolderOpen />}
              tone="teal"
              label="Resources"
              value={`${resources.length} ${resources.length === 1 ? "file" : "files"}`}
              detail={
                resources.length
                  ? `Across ${resourceSubjectCount} ${resourceSubjectCount === 1 ? "subject" : "subjects"}`
                  : "Nothing filed yet"
              }
            />
          </nav>

          <section aria-labelledby="subjects-list-heading" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="subjects-list-heading" className="font-heading text-base font-semibold text-foreground">
                Your subjects <span className="font-normal text-muted-foreground">({subjects.length})</span>
              </h2>
              {subjects.length > 0 && (
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search subjects"
                    placeholder="Search subjects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
              )}
            </div>

            {subjects.length === 0 ? (
              <EmptyState
                icon={<BookOpenText />}
                title="No subjects yet"
                description="Add your first course to start tracking its homework, exams, files and grades."
                action={!archived && <Button onClick={() => setIsAddOpen(true)}><Plus />Add a subject</Button>}
              />
            ) : filteredSubjects.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No subjects match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSubjects.map((s) => {
                  const hwPending = initialHomeworks.filter(
                    (h) => isSubjectSimilar(h.subject, s.name) && !h.isCompleted
                  ).length;
                  const resCount = resources.filter(
                    (r) => isSubjectSimilar(r.subject, s.name)
                  ).length;
                  const targetGoal = goals.find(
                    (g) => isSubjectSimilar(g.subject, s.name)
                  );

                  const subjectGrades = initialReportCards
                    .map((rc) => rc.grades.find((g) => isSubjectSimilar(g.subject, s.name)))
                    .filter(Boolean) as SubjectGrade[];
                  const latestGrade = subjectGrades.length > 0 ? subjectGrades[subjectGrades.length - 1].grade : null;

                  const openCard = () => {
                    openSubject(s.name);
                    setRenameSubjectName(s.name);
                  };

                  const facts: Array<[string, string, boolean]> = [
                    ["Homework", hwPending ? `${hwPending} pending` : "None pending", hwPending > 0],
                    ["Files", String(resCount), resCount > 0],
                    ["Target", targetGoal ? `${targetGoal.targetGrade}%` : "Not set", !!targetGoal],
                    ["Latest grade", latestGrade ?? "None yet", !!latestGrade],
                  ];

                  return (
                    <li
                      key={s.id}
                      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                    >
                      {/* The whole card opens the subject; the rename/delete
                          buttons sit above this layer so they stay separate. */}
                      <button
                        type="button"
                        onClick={openCard}
                        aria-label={`Open ${s.name}`}
                        className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-sm font-semibold text-primary"
                          >
                            {subjectInitials(s.name)}
                          </span>
                          <h3 className="line-clamp-2 min-w-0 font-heading text-base font-semibold leading-snug text-foreground">
                            {s.name}
                          </h3>
                        </div>
                        {!archived && (
                          <div className="relative z-10 -mr-1.5 -mt-1.5 flex shrink-0 items-center transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setTargetSubject(s);
                                setRenameSubjectName(s.name);
                                setIsRenameOpen(true);
                              }}
                              aria-label={`Rename ${s.name}`}
                              title="Rename subject"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Edit3 />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setTargetSubject(s);
                                setIsDeleteOpen(true);
                              }}
                              aria-label={`Delete ${s.name}`}
                              title="Delete subject"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>

                      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border pt-4 text-xs">
                        {facts.map(([label, value, present]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className={cn("truncate font-medium", present ? "text-foreground" : "text-muted-foreground")}>
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        /* SUBJECT WORKSPACE */
        <div className="space-y-6">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => openSubject(null)}
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ArrowLeft className="size-4" />
              All subjects
            </button>
            <div data-tour="subjects-hero">
              <PageHeader
                className="pb-0"
                title={<span className="break-words">{selectedSubject?.name}</span>}
                description="Its homework, exams, files, marks and syllabus in one place."
                actions={
                  !archived && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRenameSubjectName(selectedSubject?.name || "");
                          setIsRenameOpen(true);
                        }}
                      >
                        <Edit3 />
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsDeleteOpen(true)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </>
                  )
                }
              />
            </div>
          </div>

          {/* Everything else about this subject lives on its own page. These
              are the ways there, each landing already narrowed to it. */}
          {selectedSubject && (
            <SubjectLinks
              subject={selectedSubject.name}
              resourceCount={subjectResources.length}
              homeworks={subjectHomeworks}
              exams={subjectExams}
            />
          )}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">

            {/* LEFT COLUMN: grades, target, homework, syllabus */}
            <div className="space-y-6 lg:col-span-5">

              <Panel className="space-y-4">
                <PanelHeading
                  icon={<TrendingUp />}
                  title="Grade history"
                  aside={
                    currentAverage !== null && (
                      <span>
                        Average <span className="font-semibold text-foreground">{currentAverage}%</span>
                      </span>
                    )
                  }
                />
                {chartData.length > 0 ? (
                  <div className="h-52 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                          <XAxis
                            dataKey="term"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                            unit="%"
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid var(--color-border)",
                              fontSize: "12px",
                              background: "var(--color-popover)",
                              color: "var(--color-popover-foreground)",
                            }}
                            formatter={(value: any, _name: any, props: any) => [
                              `${value}% (${props.payload.rawGrade})`,
                              "Grade"
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="grade"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorGrade)"
                            dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No marks yet. Add a report card or scores on{" "}
                    <Link href="/marks" className="font-medium text-primary hover:underline">Marks</Link>
                    {" "}and they will chart here.
                  </p>
                )}
              </Panel>

              <Panel className="space-y-4">
                <PanelHeading
                  icon={<Target />}
                  title="Target"
                  aside={
                    !archived && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetGoalGrade(subjectGoal ? String(subjectGoal.targetGrade) : "");
                          setIsGoalOpen(true);
                        }}
                      >
                        {subjectGoal ? "Change" : "Set target"}
                      </Button>
                    )
                  }
                />
                {subjectGoal ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Stat label="Target" value={`${subjectGoal.targetGrade}%`} />
                      <Stat
                        label="Current average"
                        value={currentAverage !== null ? `${currentAverage}%` : "No marks yet"}
                        tone={currentAverage === null ? "default" : currentAverage >= subjectGoal.targetGrade ? "success" : "primary"}
                      />
                    </div>
                    {currentAverage !== null && (
                      <div className="space-y-2.5">
                        {/* 0-100 scale: the fill is the average, the tick is the target. */}
                        <div
                          role="img"
                          aria-label={`Average ${currentAverage}% against a target of ${subjectGoal.targetGrade}%`}
                          className="relative h-2 w-full rounded-full bg-muted"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              currentAverage >= subjectGoal.targetGrade ? "bg-success" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, currentAverage))}%` }}
                          />
                          <div
                            aria-hidden
                            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                            style={{ left: `${Math.min(100, Math.max(0, subjectGoal.targetGrade))}%` }}
                          />
                        </div>
                        {currentAverage >= subjectGoal.targetGrade ? (
                          <p className="flex items-center gap-1.5 text-sm text-success">
                            <CheckCircle2 className="size-4 shrink-0" />
                            On target, {points(currentAverage - subjectGoal.targetGrade)} points above.
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                            {points(subjectGoal.targetGrade - currentAverage)} points below your target.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No target yet. Set one to see how far your average is from it.
                  </p>
                )}
              </Panel>

              <Panel className="space-y-4">
                <PanelHeading
                  icon={<BookOpen />}
                  title="Homework"
                  aside={
                    <>
                      {subjectHomeworks.length > 0 && (
                        <span>{subjectHomeworks.filter((h) => h.isCompleted).length}/{subjectHomeworks.length} done</span>
                      )}
                      {selectedSubject && (
                        <Link
                          href={`/homeworks?subject=${encodeURIComponent(selectedSubject.name)}`}
                          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          See all
                        </Link>
                      )}
                    </>
                  }
                />
                {subjectHomeworks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No homework for this subject yet.</p>
                ) : (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${(subjectHomeworks.filter((h) => h.isCompleted).length / subjectHomeworks.length) * 100}%`
                        }}
                      />
                    </div>
                    <ul className="-mx-1 max-h-64 divide-y divide-border overflow-y-auto px-1">
                      {[...subjectHomeworks]
                        .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
                        .map((hw) => {
                          const overdue = isOverdue(hw);
                          return (
                            <li key={hw.id} className="flex items-center justify-between gap-3 py-2.5">
                              <div className="min-w-0">
                                <p className={cn(
                                  "truncate text-sm font-medium",
                                  hw.isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                                )}>
                                  {hw.title}
                                </p>
                                <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                                  Due {shortDate(hw.dueDate)}
                                </p>
                              </div>
                              <span className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                                hw.isCompleted
                                  ? "bg-success/10 text-success"
                                  : overdue
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                              )}>
                                {hw.isCompleted ? "Done" : overdue ? "Overdue" : "Pending"}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  </>
                )}
              </Panel>

              {/* Syllabus mastery - the topics this subject's exams cover */}
              {selectedSubject && (
                <Panel className="space-y-4">
                  <PanelHeading
                    icon={<ListChecks />}
                    title="Syllabus"
                    aside={
                      subjectMastery.length > 0 && (
                        <span>
                          {subjectMastery.filter((m) => m.isCompleted).length}/{subjectMastery.length} mastered
                        </span>
                      )
                    }
                  />
                  <AddMasteryForm subject={selectedSubject.name} />
                  <MasteryList items={subjectMastery} subject={selectedSubject.name} />
                </Panel>
              )}

            </div>

            {/* RIGHT COLUMN: the AI study buddy */}
            <Panel
              padded={false}
              className="flex h-[560px] flex-col overflow-hidden lg:sticky lg:top-6 lg:col-span-7 lg:h-[calc(100dvh-9rem)] lg:min-h-[520px]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BrainCircuit className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-base font-semibold text-foreground">AI Study Buddy</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      Knows this subject&apos;s topics, homework and exams
                    </p>
                  </div>
                </div>
                {selectedSubject && (
                  <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
                    <Link href={`/studio/${encodeURIComponent(selectedSubject.name)}`} title="Write notes in the Deep work studio">
                      <NotebookPen />
                      Notes
                    </Link>
                  </Button>
                )}
              </div>

              <div
                ref={chatScrollRef}
                aria-live="polite"
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
              >
                {aiMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      "max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "self-end rounded-br-md bg-primary text-primary-foreground"
                        : "self-start rounded-bl-md bg-muted text-foreground"
                    )}
                  >
                    {/* Minimal markdown: escape everything, then allow bold and italics. */}
                    <div
                      className="whitespace-pre-wrap"
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
                  <div className="flex max-w-[85%] shrink-0 items-center gap-2 self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Thinking...
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border p-4">
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSendAiQuery(s.prompt)}
                      disabled={isAiLoading}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAiQuery();
                  }}
                >
                  <Input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    aria-label={`Ask about ${selectedSubject?.name ?? "this subject"}`}
                    placeholder={`Ask about ${selectedSubject?.name ?? "this subject"}...`}
                    disabled={isAiLoading}
                    className="h-10 flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon-lg"
                    aria-label="Send"
                    disabled={isAiLoading || !aiQuery.trim()}
                    className="size-10 shrink-0"
                  >
                    <Send />
                  </Button>
                </form>
              </div>
            </Panel>

          </div>

        </div>
      )}

      {/* Dialog: Add Subject */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-3xl border border-border bg-popover max-w-sm p-6 shadow-2xl">
          <form onSubmit={handleAddSubject}>
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-lg font-heading font-semibold">Add New Subject</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Register a new course in your master timetable workspace database.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Subject Name</Label>
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
              <DialogTitle className="text-lg font-heading font-semibold">Rename Subject</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Updates this subject name across all existing tables, schedules, history, and goals.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="renameName" className="text-xs font-medium text-muted-foreground">Subject Name</Label>
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
            <DialogTitle className="text-lg font-heading font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Delete Subject?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
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
              <DialogTitle className="text-lg font-heading font-semibold">Set Academic Target</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Set a benchmark goal grade percentage for {selectedSubject?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="goalGrade" className="text-xs font-medium text-muted-foreground">Target Percentage (%)</Label>
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

    </div>
  );
}

/** The one heading style for every panel on the subject page. */
function PanelHeading({
  icon,
  title,
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 font-heading text-base font-semibold text-foreground">
        <span aria-hidden className="text-primary [&_svg]:size-4">{icon}</span>
        {title}
      </h2>
      {aside && <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">{aside}</div>}
    </div>
  );
}

/** The subject's doors to Resources, Homework and Exams. */
function SubjectLinks({
  subject,
  resourceCount,
  homeworks,
  exams,
}: {
  subject: string;
  resourceCount: number;
  homeworks: Homework[];
  exams: ExamEvent[];
}) {
  const encoded = encodeURIComponent(subject);

  const pending = homeworks.filter((h) => !h.isCompleted);
  const overdue = pending.filter(isOverdue).length;
  const nextDue = pending
    .filter((h) => !isOverdue(h))
    .reduce<Homework | null>(
      (soonest, h) => (!soonest || new Date(h.dueDate) < new Date(soonest.dueDate) ? h : soonest),
      null,
    );
  const upcoming = upcomingExams(exams);
  const nextExam = upcoming[0] ?? null;

  return (
    <nav aria-label={`${subject} pages`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <HubTile
        href={`/resources/${encoded}`}
        icon={<FolderOpen />}
        tone="teal"
        label="Resources"
        value={`${resourceCount} ${resourceCount === 1 ? "file" : "files"}`}
        detail={`Open the ${subject} folder`}
      />
      <HubTile
        href={`/homeworks?subject=${encoded}`}
        icon={<BookOpen />}
        tone="blue"
        label="Homework"
        value={`${pending.length} pending`}
        detail={
          overdue > 0
            ? `${overdue} overdue`
            : nextDue
              ? `Next due ${shortDate(nextDue.dueDate)}`
              : "All caught up"
        }
      />
      <HubTile
        href={`/exams?subject=${encoded}`}
        icon={<CalendarClock />}
        tone="orange"
        label="Exams"
        value={examCountdown(nextExam)}
        detail={
          nextExam
            ? `${nextExam.title} · ${shortDate(nextExam.date)}${upcoming.length > 1 ? ` (+${upcoming.length - 1} more)` : ""}`
            : "Nothing scheduled"
        }
      />
    </nav>
  );
}
