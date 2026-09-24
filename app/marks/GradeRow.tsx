"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BrainCircuit, ChevronRight, Edit2, Loader2, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/list-row";
import { deleteSubjectGrade, updateSubjectGrade } from "@/lib/marks-actions";
import { GradeFields } from "./GradeFields";
import {
  DEFAULT_FEEDBACK,
  letterGrade,
  parseGrade,
  statusBarClass,
  statusTone,
  type GradeFormValues,
  type SubjectGradeType,
} from "./marks-model";

/**
 * One subject on a report card. The row opens a dialog with the full note,
 * the target from Goals, and (outside an archived year) edit and delete.
 */
export function GradeRow({
  grade,
  target,
  subjects,
  readOnly,
}: {
  grade: SubjectGradeType;
  target: number | undefined;
  subjects: { id: string; name: string }[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<GradeFormValues>({
    subject: grade.subject,
    grade: grade.grade,
    status: grade.status,
    aiFeedback: grade.aiFeedback,
  });

  const score = parseGrade(grade.grade);
  const letter = letterGrade(grade.grade);
  const tone = statusTone(grade.status);
  const belowTarget = target !== undefined && score !== null && score < target;

  const startEdit = () => {
    setForm({ subject: grade.subject, grade: grade.grade, status: grade.status, aiFeedback: grade.aiFeedback });
    setEditing(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateSubjectGrade(grade.id, {
        subject: form.subject.trim(),
        grade: form.grade.trim(),
        status: form.status,
        aiFeedback: form.aiFeedback.trim() || DEFAULT_FEEDBACK,
      });
      if (result.success) {
        setEditing(false);
        setOpen(false);
        toast.success(`${form.subject.trim()} updated.`);
      } else {
        toast.error("The subject could not be updated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The subject could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${grade.subject} from this report card?`)) return;
    setDeleting(true);
    try {
      await deleteSubjectGrade(grade.id);
      setOpen(false);
      toast.success(`${grade.subject} removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The subject could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setEditing(false);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/40 bg-muted/40 px-5 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-bold text-foreground transition-colors group-hover:text-primary">{grade.subject}</span>
              <Pill tone={tone}>{grade.status}</Pill>
              {target !== undefined && (
                <Pill tone={belowTarget ? "warning" : "success"}>Target {target}%</Pill>
              )}
            </span>
            <span className="block truncate text-xs font-medium text-muted-foreground">
              {grade.aiFeedback || DEFAULT_FEEDBACK}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-right">
              <span className="block font-heading text-2xl font-black tabular-nums leading-none">{grade.grade}</span>
              <span className="mt-1.5 block h-1 w-16 overflow-hidden rounded-full bg-muted sm:w-24">
                <span className={cn("block h-full rounded-full", statusBarClass(grade.status))} style={{ width: `${Math.min(score ?? 0, 100)}%` }} />
              </span>
            </span>
            <span className="hidden size-9 items-center justify-center rounded-xl border border-border bg-background font-heading text-sm font-bold sm:flex">
              {letter}
            </span>
            <ChevronRight className="hidden size-5 text-muted-foreground md:block" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Edit {grade.subject}</DialogTitle>
              <DialogDescription>Change the mark, standing or note.</DialogDescription>
            </DialogHeader>
            <GradeFields idPrefix="edit-grade" values={form} onChange={setForm} subjects={subjects} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Pill tone={tone}>{grade.status}</Pill>
                <span className="text-xs font-medium text-muted-foreground">Grade {letter}</span>
              </div>
              <DialogTitle className="text-2xl">{grade.subject}</DialogTitle>
              <DialogDescription className="sr-only">Mark, note and target for {grade.subject}.</DialogDescription>
            </DialogHeader>

            <div className="flex items-end justify-between gap-4 border-b border-border/40 pb-4">
              <p className="font-heading text-5xl font-black tabular-nums leading-none">
                {grade.grade}
                {/^\d+(\.\d+)?$/.test(grade.grade.trim()) && (
                  <span className="ml-1 text-base font-medium text-muted-foreground">%</span>
                )}
              </p>
              <p className="text-right text-sm text-muted-foreground">
                {target === undefined ? (
                  <Link href="/goals" className="font-medium text-primary hover:underline">Set a target</Link>
                ) : belowTarget ? (
                  <>{(target - (score ?? 0)).toFixed(1)}% below your {target}% target</>
                ) : score === null ? (
                  <>Target {target}%</>
                ) : (
                  <>At or above your {target}% target</>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">How to improve</p>
              <p className="rounded-xl border border-border/40 bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                {grade.aiFeedback || DEFAULT_FEEDBACK}
              </p>
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link href={`/ai?subject=${encodeURIComponent(grade.subject)}`}>
                <BrainCircuit />
                Practice {grade.subject}
              </Link>
            </Button>

            {!readOnly && (
              <div className="flex gap-2 border-t border-border/40 pt-4">
                <Button variant="outline" onClick={startEdit} className="flex-1">
                  <Edit2 /> Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
