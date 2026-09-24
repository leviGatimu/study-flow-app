"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { normalizeSubject, isSubjectSimilar } from "@/lib/utils";
import { useIsArchived } from "@/components/ArchiveContext";
import { repairSubjects } from "@/lib/subject-actions";
import { SubjectGrid } from "./SubjectGrid";
import { SubjectDetail } from "./SubjectDetail";
import { AddSubjectDialog, DeleteSubjectDialog, GoalDialog, RenameSubjectDialog } from "./SubjectDialogs";
import {
  parseGradeToPercentage,
  type ExamEvent,
  type GradePoint,
  type Homework,
  type MasteryItem,
  type ReportCard,
  type Resource,
  type StudioNote,
  type Subject,
  type SubjectGoal,
} from "./subject-model";

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

const subjectUrl = (name: string | null) =>
  name ? `/subjects?subject=${encodeURIComponent(name)}` : "/subjects";

/**
 * The Subjects section: the list of subjects, or one subject's page when the
 * URL says ?subject=. Owns the subject list, goals and which dialog is open;
 * the views and dialogs are in their own files.
 */
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
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [goals, setGoals] = useState<SubjectGoal[]>(initialGoals);
  const [repairing, setRepairing] = useState(false);

  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [goalFor, setGoalFor] = useState<string | null>(null);

  // The open subject lives in the URL (/subjects?subject=Math), so other
  // pages can link straight to it and the browser's Back returns to the list.
  // An exact name wins; the similarity match catches "Maths" for "Math".
  const subjectParam = useSearchParams().get("subject");
  const selected = useMemo(() => {
    if (!subjectParam) return null;
    return (
      subjects.find((s) => s.name === subjectParam) ??
      subjects.find((s) => isSubjectSimilar(s.name, subjectParam)) ??
      null
    );
  }, [subjects, subjectParam]);

  const openSubject = (name: string | null) => window.history.pushState(null, "", subjectUrl(name));

  const subjectOptions = useMemo(() => subjects.map((s) => ({ id: s.id, name: s.name })), [subjects]);

  const detail = useMemo(() => {
    if (!selected) return null;
    const name = selected.name;
    const masteryKey = normalizeSubject(name);

    const chartData: GradePoint[] = [];
    for (const rc of initialReportCards) {
      const match = rc.grades.find((g) => isSubjectSimilar(g.subject, name));
      const grade = match ? parseGradeToPercentage(match.grade) : null;
      if (match && grade !== null) chartData.push({ term: rc.term, grade, rawGrade: match.grade });
    }

    return {
      homeworks: initialHomeworks.filter((h) => isSubjectSimilar(h.subject, name)),
      exams: initialExams.filter((e) => isSubjectSimilar(e.subject?.name ?? e.title, name)),
      resources: initialResources.filter((r) => isSubjectSimilar(r.subject, name)),
      // Mirrors getMasteryItems: syllabus topics are filed under the normalized name.
      mastery: initialMastery.filter((m) => m.subject === masteryKey),
      goal: goals.find((g) => isSubjectSimilar(g.subject, name)) ?? null,
      note: initialNotes.find((n) => isSubjectSimilar(n.subject, name))?.content.trim() ?? "",
      chartData,
    };
  }, [selected, initialHomeworks, initialExams, initialResources, initialMastery, initialReportCards, initialNotes, goals]);

  const handleRepair = async () => {
    setRepairing(true);
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
    } catch (err) {
      console.error("Tidy subjects:", err);
      toast.error("Could not tidy the subject list. Try again.");
    } finally {
      setRepairing(false);
    }
  };

  const byName = (a: Subject, b: Subject) => a.name.localeCompare(b.name);

  return (
    <>
      {selected && detail ? (
        <SubjectDetail
          subject={selected}
          {...detail}
          subjectOptions={subjectOptions}
          archived={archived}
          onBack={() => openSubject(null)}
          onRename={() => setRenaming(selected)}
          onDelete={() => setDeleting(selected)}
          onSetGoal={() => setGoalFor(selected.name)}
        />
      ) : (
        <SubjectGrid
          subjects={subjects}
          homeworks={initialHomeworks}
          exams={initialExams}
          resources={initialResources}
          goals={goals}
          reportCards={initialReportCards}
          archived={archived}
          repairing={repairing}
          onOpen={openSubject}
          onAdd={() => setAdding(true)}
          onRepair={handleRepair}
          onRename={setRenaming}
          onDelete={setDeleting}
        />
      )}

      <AddSubjectDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={(subject) => {
          setSubjects((prev) => [...prev, subject].sort(byName));
          // Straight to the new subject's page: its empty panels say what to add next.
          openSubject(subject.name);
        }}
      />
      <RenameSubjectDialog
        subject={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={(id, name) => {
          setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)).sort(byName));
          if (id === selected?.id) window.history.replaceState(null, "", subjectUrl(name));
          // Homework, exams and files were renamed on the server too.
          router.refresh();
        }}
      />
      <DeleteSubjectDialog
        subject={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          setSubjects((prev) => prev.filter((s) => s.id !== id));
          if (id === selected?.id) window.history.replaceState(null, "", subjectUrl(null));
          router.refresh();
        }}
      />
      <GoalDialog
        subjectName={goalFor}
        current={detail?.goal?.targetGrade ?? null}
        onClose={() => setGoalFor(null)}
        onSaved={(goal) => setGoals((prev) => [...prev.filter((g) => g.subject !== goal.subject), goal])}
      />
    </>
  );
}
