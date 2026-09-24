"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Download, HardDrive, Trash2, Upload } from "lucide-react";

import { clearAllTasks, exportUserData, importUserData, verifyDbIntegrity } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { SettingRow, SettingsPanel, reportError } from "./settings-ui";

type DbCounts = { tasks: number; templates: number; homeworks: number; projects: number };

export function DataSettings() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, startExport] = useTransition();
  const [importing, startImport] = useTransition();
  const [checking, startCheck] = useTransition();
  const [counts, setCounts] = useState<DbCounts | null>(null);

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
        toast.success("Backup downloaded.");
      } catch (error) {
        reportError("export", error);
        toast.error("The backup could not be made. Check your connection and try again.");
      }
    });

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      reportError("read backup file", error);
      toast.error("That file is not a Study Flow backup. Choose the .json file you exported.");
      return;
    }
    if (!confirm("This replaces your current data with the backup. Continue?")) return;

    startImport(async () => {
      try {
        const res = await importUserData(parsed);
        if (res.success) {
          toast.success("Backup restored.");
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
    <div className="space-y-6">
      <SettingsPanel
        title="Backup"
        icon={<Download />}
        description="A backup is one .json file of your study data. Keep it somewhere safe."
      >
        <div className="divide-y divide-border/60">
          <SettingRow label="Download a backup" description="Save a copy of all your data to this computer.">
            <Button variant="outline" onClick={exportData} disabled={exporting} className="gap-1.5">
              <Download className="size-4" />
              {exporting ? "Preparing…" : "Download"}
            </Button>
          </SettingRow>
          <SettingRow
            label="Restore a backup"
            description="Replace your current data with a backup you downloaded earlier."
          >
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void importFile(e)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileInput.current?.click()}
              className="gap-1.5"
            >
              <Upload className="size-4" />
              {importing ? "Restoring…" : "Choose file"}
            </Button>
          </SettingRow>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Check your data"
        icon={<HardDrive />}
        description="Confirms the app can read your data and counts what is there."
        action={
          <Button variant="outline" onClick={runCheck} disabled={checking}>
            {checking ? "Checking…" : "Run check"}
          </Button>
        }
      >
        {counts ? (
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Everything could be read.
            </p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ["Study blocks", counts.tasks],
                  ["Routine slots", counts.templates],
                  ["Homework", counts.homeworks],
                  ["Projects", counts.projects],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="font-heading text-2xl font-black tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not run yet.</p>
        )}
      </SettingsPanel>
    </div>
  );
}

export function DangerSettings() {
  const router = useRouter();
  const [clearing, startClearing] = useTransition();

  const clear = () => {
    if (
      !confirm(
        "Delete every study block in your current year? Your timetable, subjects, homework, exams and notes are kept. This cannot be undone from the app."
      )
    )
      return;
    startClearing(async () => {
      try {
        await clearAllTasks();
        toast.success("This year's study blocks were deleted.");
        router.push("/");
      } catch (error) {
        reportError("clear tasks", error);
        toast.error(
          "Nothing was deleted. If a finished year is open, close it on Year & terms first, then try again."
        );
      }
    });
  };

  return (
    <SettingsPanel
      tone="danger"
      title="Delete this year's study blocks"
      icon={<Trash2 />}
      description="Removes every generated study block (done or not) in your current year, so this year's history starts again. Your weekly routine, subjects, homework, exams and notes are not touched. Download a backup first if you might want them back."
    >
      <Button variant="destructive" onClick={clear} disabled={clearing} className="gap-1.5">
        <Trash2 className="size-4" />
        {clearing ? "Deleting…" : "Delete study blocks"}
      </Button>
    </SettingsPanel>
  );
}
