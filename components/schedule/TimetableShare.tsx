"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Download, FileUp, Loader2, Send, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportTimetable, importTimetable } from "@/lib/timetable-share-actions";
import {
  DAY_NAMES,
  MAX_TIMETABLE_FILE_BYTES,
  parseTimetableFile,
  subjectsOf,
  TIMETABLE_FILE_EXTENSION,
  type TimetableData,
} from "@/lib/timetable-share";

/**
 * "Share" on School lessons and Study routine: download the timetable as a
 * .studyflow file to send to someone, or import one somebody sent. Importing
 * replaces the matching parts of this year's timetable, after a review.
 */
export function TimetableShare({
  page,
  canImport,
  yearLabel,
}: {
  /** Which part this page is about; it is ticked first when sharing. */
  page: "lessons" | "routine";
  /** False while an archived year is open: it can be shared but not replaced. */
  canImport: boolean;
  yearLabel?: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const [review, setReview] = useState<TimetableData | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_TIMETABLE_FILE_BYTES) {
      toast.error("This file is too big to be a Study Flow timetable.");
      return;
    }
    const parsed = parseTimetableFile(await file.text());
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setReview(parsed.data);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Share2 /> Share <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setExporting(true)}>
            <Download /> Download to share
          </DropdownMenuItem>
          {canImport && (
            <DropdownMenuItem onSelect={() => picker.current?.click()}>
              <FileUp /> Import a timetable
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={picker}
        type="file"
        accept={`.${TIMETABLE_FILE_EXTENSION},application/json,.json`}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void pickFile(file);
        }}
      />

      <ExportDialog open={exporting} page={page} onClose={() => setExporting(false)} />
      <ImportDialog data={review} yearLabel={yearLabel ?? null} onClose={() => setReview(null)} />
    </>
  );
}

function ExportDialog({ open, page, onClose }: { open: boolean; page: "lessons" | "routine"; onClose: () => void }) {
  const [lessons, setLessons] = useState(true);
  const [routine, setRoutine] = useState(true);
  const [pending, start] = useTransition();
  const canSend = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const make = (then: (file: File) => Promise<void> | void) => {
    start(async () => {
      const result = await exportTimetable({ lessons, routine });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const file = new File([JSON.stringify(result.file, null, 2)], result.fileName, { type: "application/json" });
      await then(file);
    });
  };

  const download = () =>
    make((file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Timetable downloaded", { description: "Send the file to anyone; they open Share > Import a timetable." });
      onClose();
    });

  const send = () =>
    make(async (file) => {
      if (!navigator.canShare?.({ files: [file] })) {
        toast.error("Sending files is not available here. Download it instead.");
        return;
      }
      try {
        await navigator.share({ files: [file], title: "My timetable", text: "My Study Flow timetable. Open it in Study Flow: Share > Import a timetable." });
        onClose();
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error("The timetable could not be sent.");
      }
    });

  const order = page === "lessons" ? (["lessons", "routine"] as const) : (["routine", "lessons"] as const);
  const rows = {
    lessons: { id: "share-lessons", label: "School lessons", hint: "The classes you attend", checked: lessons, set: setLessons },
    routine: { id: "share-routine", label: "Study routine", hint: "Your weekly study blocks", checked: routine, set: setRoutine },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Share your timetable</DialogTitle>
          <DialogDescription>
            Download a file you can send by WhatsApp, email or USB. The other person imports it in Study Flow. Your marks, notes and finished work are not included.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {order.map((key) => {
            const row = rows[key];
            return (
              <Label
                key={key}
                htmlFor={row.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-3 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
              >
                <Checkbox id={row.id} checked={row.checked} onCheckedChange={(v) => row.set(v === true)} />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{row.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{row.hint}</span>
                </span>
              </Label>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {canSend && (
            <Button variant="outline" onClick={send} disabled={pending || (!lessons && !routine)}>
              <Send /> Send…
            </Button>
          )}
          <Button onClick={download} disabled={pending || (!lessons && !routine)}>
            {pending ? <Loader2 className="animate-spin" /> : <Download />} Download file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Monday first, the way a school week reads. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function ImportDialog({ data, yearLabel, onClose }: { data: TimetableData | null; yearLabel: string | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!data) return <Dialog open={false} />;

  const parts = [data.schoolLessons && "school lessons", data.studyRoutine && "study routine"].filter(Boolean).join(" and ");
  const subjects = subjectsOf(data);
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

  const replace = () =>
    start(async () => {
      const result = await importTimetable({
        kind: "study-flow-timetable",
        version: 1,
        from: data.from,
        exportedAt: data.exportedAt,
        ...(data.schoolLessons ? { schoolLessons: data.schoolLessons } : {}),
        ...(data.studyRoutine ? { studyRoutine: data.studyRoutine } : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { summary } = result;
      const done = [
        summary.lessons !== null && `${summary.lessons} ${summary.lessons === 1 ? "lesson" : "lessons"}`,
        summary.blocks !== null && `${summary.blocks} study ${summary.blocks === 1 ? "block" : "blocks"}`,
      ]
        .filter(Boolean)
        .join(" and ");
      const notes = [
        summary.newSubjects.length > 0 && `New subjects: ${summary.newSubjects.join(", ")}.`,
        summary.blocks !== null && !summary.termRunning && "Study blocks appear in your Week once a term is running.",
      ]
        .filter(Boolean)
        .join(" ");
      toast.success(`Imported ${done}`, notes ? { description: notes } : undefined);
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            Import {data.from ? `${data.from}'s` : "this"} timetable?
          </DialogTitle>
          <DialogDescription>
            {[data.from && `From ${data.from}`, when && `made ${when}`].filter(Boolean).join(", ") || "A Study Flow timetable file"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p>
            This replaces your {parts}
            {yearLabel ? ` for ${yearLabel}` : ""}. Blocks you have already finished stay in History.
          </p>
        </div>

        {data.schoolLessons && (
          <Section title={`School lessons · ${data.schoolLessons.length}`}>
            <DayList items={data.schoolLessons.map((l) => ({ day: l.dayOfWeek, start: l.startTime, text: `${l.startTime}–${l.endTime} ${l.subject}`, muted: l.isBreak }))} />
          </Section>
        )}
        {data.studyRoutine && (
          <Section title={`Study routine · ${data.studyRoutine.length}`}>
            <DayList
              items={data.studyRoutine.map((b) => ({
                day: b.dayOfWeek,
                start: b.startTime,
                text: `${b.startTime}–${b.endTime} ${b.subject} (${b.type === "REVISION" ? "revision" : "homework"})`,
              }))}
            />
          </Section>
        )}
        {subjects.length > 0 && (
          <Section title="Subjects">
            <p className="text-xs text-muted-foreground">Ones you don&apos;t have yet are added to your subjects.</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <li key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={replace} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Replace mine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function DayList({ items }: { items: { day: number; start: string; text: string; muted?: boolean }[] }) {
  const days = WEEK.map((day) => ({
    day,
    entries: items.filter((i) => i.day === day).sort((a, b) => a.start.localeCompare(b.start)),
  })).filter((d) => d.entries.length > 0);
  if (days.length === 0) return <p className="text-sm text-muted-foreground">Nothing on any day.</p>;
  return (
    <dl className="divide-y divide-border/60 rounded-xl border border-border/60">
      {days.map(({ day, entries }) => (
        <div key={day} className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2 text-sm">
          <dt className="font-medium text-foreground">{DAY_NAMES[day]}</dt>
          <dd className="space-y-0.5">
            {entries.map((e, i) => (
              <p key={i} className={e.muted ? "text-muted-foreground" : "text-foreground"}>
                {e.text}
              </p>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
