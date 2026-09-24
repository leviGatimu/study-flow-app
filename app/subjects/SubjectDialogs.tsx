"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addSubject, deleteSubject, renameSubject } from "@/lib/subject-actions";
import { saveGoal } from "@/lib/goal-actions";
import type { Subject, SubjectGoal } from "./subject-model";

/**
 * The four subject dialogs. Each owns its own form and pending state and only
 * reports the outcome, so SubjectsClient keeps nothing but which one is open.
 */

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function Footer({
  onCancel,
  pending,
  submitLabel,
  destructive = false,
  onSubmit,
}: {
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  destructive?: boolean;
  /** For a dialog without a form; otherwise the button submits the form. */
  onSubmit?: () => void;
}) {
  return (
    <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} className="h-10">
        Cancel
      </Button>
      <Button
        type={onSubmit ? "button" : "submit"}
        onClick={onSubmit}
        variant={destructive ? "destructive" : "default"}
        disabled={pending}
        className="h-10 gap-2"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

export function AddSubjectDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (subject: Subject) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the subject a name.");
      return;
    }
    setPending(true);
    try {
      const res = await addSubject(name);
      if (res.success && res.subject) {
        toast.success(`Added ${res.subject.name}.`);
        setName("");
        onOpenChange(false);
        onAdded(res.subject as Subject);
      }
    } catch (err) {
      toast.error(errorText(err, "Could not add the subject. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold">Add subject</DialogTitle>
            <DialogDescription>
              A subject collects its homework, exams, files and marks in one place.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="subject-add-name">Name</Label>
            <Input
              id="subject-add-name"
              placeholder="e.g. Embedded systems"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
              required
              autoFocus
            />
          </div>
          <Footer onCancel={() => onOpenChange(false)} pending={pending} submitLabel="Add subject" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameSubjectDialog({
  subject,
  onClose,
  onRenamed,
}: {
  subject: Subject | null;
  onClose: () => void;
  onRenamed: (id: string, name: string) => void;
}) {
  return (
    <Dialog open={subject !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {/* Keyed so the field starts from the name of whichever subject opened it. */}
        {subject && <RenameForm key={subject.id} subject={subject} onClose={onClose} onRenamed={onRenamed} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  subject,
  onClose,
  onRenamed,
}: {
  subject: Subject;
  onClose: () => void;
  onRenamed: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(subject.name);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) {
      toast.error("The name cannot be empty.");
      return;
    }
    setPending(true);
    try {
      const res = await renameSubject(subject.id, next);
      if (res.success) {
        toast.success(`Renamed to ${next} everywhere it appears.`);
        onRenamed(subject.id, next);
        onClose();
      }
    } catch (err) {
      toast.error(errorText(err, "Could not rename the subject. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg font-semibold">Rename subject</DialogTitle>
        <DialogDescription>
          The new name is used on its timetable blocks, homework, history and goals too.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="subject-rename-name">Name</Label>
        <Input
          id="subject-rename-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
          required
          autoFocus
        />
      </div>
      <Footer onCancel={onClose} pending={pending} submitLabel="Save name" />
    </form>
  );
}

export function DeleteSubjectDialog({
  subject,
  onClose,
  onDeleted,
}: {
  subject: Subject | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [cascade, setCascade] = useState(false);
  const [pending, setPending] = useState(false);

  const close = () => {
    setCascade(false);
    onClose();
  };

  const confirm = async () => {
    if (!subject) return;
    setPending(true);
    try {
      const res = await deleteSubject(subject.id, cascade);
      if (res.success) {
        toast.success(
          cascade ? `Deleted ${subject.name} and everything filed under it.` : `Deleted ${subject.name}.`
        );
        onDeleted(subject.id);
        close();
      }
    } catch (err) {
      toast.error(errorText(err, "Could not delete the subject. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={subject !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-lg font-semibold">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            Delete {subject?.name}?
          </DialogTitle>
          <DialogDescription>
            The subject is removed from your list. Its homework, files and marks stay unless you choose otherwise below.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <Checkbox
            id="subject-delete-cascade"
            checked={cascade}
            onCheckedChange={(checked) => setCascade(!!checked)}
            className="mt-0.5"
          />
          <Label htmlFor="subject-delete-cascade" className="cursor-pointer text-sm font-normal leading-relaxed text-muted-foreground">
            Also delete its homework, resources, target, timetable blocks and report card grades. This cannot be undone.
          </Label>
        </div>

        <Footer onCancel={close} pending={pending} submitLabel="Delete" destructive onSubmit={confirm} />
      </DialogContent>
    </Dialog>
  );
}

export function GoalDialog({
  subjectName,
  current,
  onClose,
  onSaved,
}: {
  /** Open while set. */
  subjectName: string | null;
  current: number | null;
  onClose: () => void;
  onSaved: (goal: SubjectGoal) => void;
}) {
  return (
    <Dialog open={subjectName !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {subjectName && (
          <GoalForm key={subjectName} subjectName={subjectName} current={current} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  subjectName,
  current,
  onClose,
  onSaved,
}: {
  subjectName: string;
  current: number | null;
  onClose: () => void;
  onSaved: (goal: SubjectGoal) => void;
}) {
  const [value, setValue] = useState(current !== null ? String(current) : "");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(value);
    if (isNaN(target) || target < 0 || target > 100) {
      toast.error("Enter a target between 0 and 100.");
      return;
    }
    setPending(true);
    try {
      const res = await saveGoal(subjectName, target);
      if (res.success && res.goal) {
        toast.success(`Target for ${subjectName} set to ${target}%.`);
        onSaved(res.goal as SubjectGoal);
        onClose();
      }
    } catch (err) {
      toast.error(errorText(err, "Could not save the target. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg font-semibold">Set a target</DialogTitle>
        <DialogDescription>
          The average you are aiming for in {subjectName}. Your marks are compared against it.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="subject-goal-grade">Target (%)</Label>
        <Input
          id="subject-goal-grade"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.1"
          placeholder="e.g. 85"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10"
          required
          autoFocus
        />
      </div>
      <Footer onCancel={onClose} pending={pending} submitLabel="Save target" />
    </form>
  );
}
