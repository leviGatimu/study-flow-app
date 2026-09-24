"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSubjectGrade, createManualReportCard, uploadReportCard } from "@/lib/marks-actions";
import { GradeFields } from "./GradeFields";
import { DEFAULT_FEEDBACK, EMPTY_GRADE_FORM, type GradeFormValues } from "./marks-model";

type ControlledDialog = { open: boolean; onOpenChange: (open: boolean) => void };

/** Start a term's record by hand, to fill in subject by subject. */
export function CreateTermDialog({
  open,
  onOpenChange,
  onCreated,
}: ControlledDialog & { onCreated: (term: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = name.trim();
    if (!term) return;
    setSaving(true);
    try {
      const result = await createManualReportCard(term);
      if (result.error) {
        toast.error(result.error);
      } else {
        onCreated(term);
        setName("");
        onOpenChange(false);
        toast.success(`${term} created. Add its subjects next.`);
      }
    } catch {
      toast.error("The term could not be created. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New term</DialogTitle>
          <DialogDescription>Start a term&apos;s report card and add its marks yourself.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-term-name">Term name</Label>
            <Input
              id="create-term-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Term 2 2026"
              className="h-10 rounded-xl"
            />
          </div>
          <Button type="submit" disabled={saving || !name.trim()} className="w-full">
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Creating…" : "Create term"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Upload a report card; the AI reads the marks off it. */
export function UploadReportDialog({
  open,
  onOpenChange,
  defaultTerm,
  onUploaded,
}: ControlledDialog & { defaultTerm: string; onUploaded: (term: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [term, setTerm] = useState(defaultTerm);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !term) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("term", term);
    try {
      const result = await uploadReportCard(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setFile(null);
        onOpenChange(false);
        onUploaded(term);
        toast.success("Report card read. Your marks are in.");
      }
    } catch {
      toast.error("The report card could not be read. Try again, or add the marks by hand.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan a report card</DialogTitle>
          <DialogDescription>Upload a PDF, photo or Word file and the marks are read off it for you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="upload-term">Term</Label>
            <Input
              id="upload-term"
              required
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Term 1 2026"
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-upload">File</Label>
            <input
              type="file"
              accept=".pdf,image/*,.docx"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="peer sr-only"
              id="report-upload"
            />
            <label
              htmlFor="report-upload"
              className={cn(
                "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50",
                file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              {file ? (
                <>
                  <FileText className="size-6 text-primary" />
                  <span className="max-w-full truncate text-sm font-semibold text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">Ready to read. Click to choose another.</span>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Click to choose a file</span>
                </>
              )}
            </label>
          </div>

          <Button type="submit" disabled={uploading || !file} className="w-full">
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading ? "Reading report card…" : "Read marks"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Add one subject's mark to the selected term. */
export function AddGradeDialog({
  open,
  onOpenChange,
  reportCardId,
  subjects,
}: ControlledDialog & { reportCardId: string; subjects: { id: string; name: string }[] }) {
  const [values, setValues] = useState<GradeFormValues>(EMPTY_GRADE_FORM);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.subject.trim() || !values.grade.trim()) return;
    setSaving(true);
    try {
      const result = await addSubjectGrade(reportCardId, {
        subject: values.subject.trim(),
        grade: values.grade.trim(),
        status: values.status,
        aiFeedback: values.aiFeedback.trim() || DEFAULT_FEEDBACK,
      });
      if (result.success) {
        setValues(EMPTY_GRADE_FORM);
        onOpenChange(false);
        toast.success(`${values.subject.trim()} added.`);
      } else {
        toast.error("The mark could not be added.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The mark could not be added.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a subject</DialogTitle>
          <DialogDescription>Add one subject&apos;s mark to this term&apos;s report card.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <GradeFields idPrefix="add-grade" values={values} onChange={setValues} subjects={subjects} />
          <Button
            type="submit"
            disabled={saving || !values.subject.trim() || !values.grade.trim()}
            className="w-full"
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Add subject"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
