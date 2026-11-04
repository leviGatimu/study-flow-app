"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Database, Download, HardDrive, ShieldAlert, Trash2, Upload } from "lucide-react";

import { clearAllTasks, exportUserData, importUserData, verifyDbIntegrity } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingRow, SettingsCard, SettingsSection, reportError } from "./settings-ui";
import { readLastBackup, recordBackup, subscribeLastBackup } from "./settings-index";

type DbCounts = { tasks: number; templates: number; homeworks: number; projects: number };

export function DataSettings() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, startExport] = useTransition();
  const [importing, startImport] = useTransition();
  const [checking, startCheck] = useTransition();
  const [counts, setCounts] = useState<DbCounts | null>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const lastBackup = useSyncExternalStore(subscribeLastBackup, readLastBackup, () => null);
  const lastBackupDate = lastBackup ? new Date(lastBackup) : null;

  const exportData = () =>
    startExport(async () => {
      try {
        const res = await exportUserData();
        if (res.error) {
          toast.error(res.error);
          return;
        }
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `studyflow-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        recordBackup();
        toast.success("Backup downloaded.");
      } catch (error) {
        reportError("export", error);
        toast.error("The backup could not be made. Check your connection and try again.");
      }
    });

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setPending({ name: file.name, data: JSON.parse(await file.text()) });
    } catch (error) {
      reportError("read backup file", error);
      toast.error("That file is not a Study Flow backup. Choose the .json file you downloaded.");
    }
  };

  const restore = () => {
    if (!pending) return;
    startImport(async () => {
      try {
        const res = await importUserData(pending.data);
        if (res.success) {
          toast.success("Backup restored.");
          setPending(null);
          router.refresh();
        } else {
          toast.error(res.error || "The backup could not be restored.");
        }
      } catch (error) {
        reportError("import", error);
        toast.error("The backup could not be restored. Check your connection and try again.");
      }
    });
  };

  const runCheck = () =>
    startCheck(async () => {
      try {
        const res = await verifyDbIntegrity();
        if (res.success && res.details) {
          setCounts(res.details);
        } else {
          toast.error("The check could not reach your data. Try again in a moment.");
        }
      } catch (error) {
        reportError("verify db", error);
        toast.error("The check could not reach your data. Try again in a moment.");
      }
    });

  return (
    <SettingsSection id="data" icon={Database} title="Data & backup" description="Download a backup, restore one, or check your data.">
      <SettingsCard>
        <SettingRow
          id="download-backup"
          label="Download a backup"
          description={
            <>
              One .json file with all your study data. Keep it somewhere safe.
              <span className="mt-1 block text-foreground">
                {lastBackupDate && !Number.isNaN(lastBackupDate.getTime())
                  ? `Last downloaded on this device ${formatDistanceToNow(lastBackupDate, { addSuffix: true })}.`
                  : "Not downloaded on this device yet."}
              </span>
            </>
          }
        >
          <Button onClick={exportData} disabled={exporting} className="gap-1.5" size="lg">
            <Download className="size-4" />
            {exporting ? "Preparing…" : "Download"}
          </Button>
        </SettingRow>
        <SettingRow
          id="restore-backup"
          label="Restore a backup"
          description="Replace your current data with a backup you downloaded earlier."
        >
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void chooseFile(e)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()} className="gap-1.5">
            <Upload className="size-4" />
            {importing ? "Restoring…" : "Choose file"}
          </Button>
        </SettingRow>
        <SettingRow
          id="check-data"
          label="Check your data"
          stacked={counts !== null}
          description="Confirms the app can read your data and counts what is there."
        >
          <div className={counts ? "mt-1 space-y-3" : undefined}>
            <Button variant="outline" onClick={runCheck} disabled={checking} className="gap-1.5">
              <HardDrive className="size-4" />
              {checking ? "Checking…" : counts ? "Check again" : "Run check"}
            </Button>
            {counts && (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Everything could be read.
                </p>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["Study blocks", counts.tasks],
                      ["Routine slots", counts.templates],
                      ["Homework", counts.homeworks],
                      ["Projects", counts.projects],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </SettingRow>
      </SettingsCard>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !importing && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              Your current data will be replaced with <span className="font-medium text-foreground">{pending?.name}</span>. If you
              might want today’s data back, download a backup of it first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={restore} disabled={importing}>
              {importing ? "Restoring…" : "Replace my data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

const CONFIRM_WORD = "delete";

export function DangerSettings() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [clearing, startClearing] = useTransition();

  const clear = () =>
    startClearing(async () => {
      try {
        await clearAllTasks();
        toast.success("This year's study blocks were deleted.");
        setOpen(false);
        router.push("/");
      } catch (error) {
        reportError("clear tasks", error);
        toast.error("Nothing was deleted. If a finished year is open, close it on Year & terms first, then try again.");
      }
    });

  return (
    <SettingsSection
      id="danger"
      tone="danger"
      icon={ShieldAlert}
      title="Reset"
      description="Changes that delete data. Read each one before you use it."
    >
      <SettingsCard>
        <SettingRow
          id="delete-blocks"
          label="Delete this year's study blocks"
          description="Removes every generated study block (done or not) in your current year, so this year's history starts again. Your weekly routine, subjects, homework, exams and notes are kept."
        >
          <Button variant="destructive" onClick={() => { setTyped(""); setOpen(true); }} className="gap-1.5">
            <Trash2 className="size-4" /> Delete study blocks
          </Button>
        </SettingRow>
      </SettingsCard>

      <Dialog open={open} onOpenChange={(next) => !clearing && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim().toLowerCase() === CONFIRM_WORD) clear();
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete this year’s study blocks?</DialogTitle>
              <DialogDescription>
                Every study block in your current year is deleted, done or not. This cannot be undone from the app. Your
                routine, subjects, homework, exams and notes are kept.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="settings-confirm-delete" className="text-xs font-medium text-muted-foreground">
                Type <span className="font-mono text-foreground">{CONFIRM_WORD}</span> to confirm
              </label>
              <Input
                id="settings-confirm-delete"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
                className="h-10"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={clearing}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={clearing || typed.trim().toLowerCase() !== CONFIRM_WORD}
                className="gap-1.5"
              >
                <Trash2 className="size-4" />
                {clearing ? "Deleting…" : "Delete study blocks"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
