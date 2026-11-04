"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readLastBackup, subscribeLastBackup, type SectionId } from "./settings-index";
import type { SettingsData } from "./settings-ui";
import styles from "./Settings.module.css";

export type SetupCounts = { subjects: number; studyBlocks: number };

type SetupItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
  /** The section that holds the fix, for the nav's "needs attention" dot. */
  section?: SectionId;
  action: { label: string; jump: string } | { label: string; href: string };
};

const BACKUP_FRESH_DAYS = 30;

/** Read outside render (store snapshot), since it depends on the clock. */
function readBackupFresh() {
  const last = readLastBackup();
  const time = last ? Date.parse(last) : NaN;
  return !Number.isNaN(time) && Date.now() - time < BACKUP_FRESH_DAYS * 86_400_000;
}

/** What is set up and what is missing, from data the page already has. */
export function useSetupItems(data: SettingsData, counts: SetupCounts): SetupItem[] {
  // Backups are files on a device, so "when did I last make one" is per device.
  const lastBackup = useSyncExternalStore(subscribeLastBackup, readLastBackup, () => null);
  const backupFresh = useSyncExternalStore(subscribeLastBackup, readBackupFresh, () => false);
  const backupDate = lastBackup ? new Date(lastBackup) : null;

  const name = data.progress?.name?.trim() ?? "";
  const timezone = data.progress?.timezone ?? "";
  const keyCount = Number(data.aiKeys.gemini.configured) + Number(data.aiKeys.openai.configured);
  const offlineModel = data.progress?.ollamaEnabled && data.progress?.ollamaModel ? data.progress.ollamaModel : null;

  return [
    {
      key: "name", label: "Your name", done: name !== "", section: "profile",
      detail: name || "Not set",
      action: { label: "Add", jump: "display-name" },
    },
    {
      key: "timezone", label: "Time zone", done: timezone !== "", section: "schedule",
      detail: timezone ? timezone.replace(/_/g, " ") : "Not set",
      action: { label: "Set", jump: "timezone" },
    },
    {
      key: "ai", label: "AI", done: keyCount > 0 || offlineModel !== null, section: "ai",
      detail: keyCount > 0 ? `${keyCount} key${keyCount === 1 ? "" : "s"} saved` : offlineModel ? `Offline: ${offlineModel}` : "No key yet",
      action: { label: "Add key", jump: "gemini-key" },
    },
    {
      key: "subjects", label: "Subjects", done: counts.subjects > 0,
      detail: counts.subjects ? `${counts.subjects} subject${counts.subjects === 1 ? "" : "s"}` : "None yet",
      action: { label: "Add", href: "/setup?step=subjects" },
    },
    {
      key: "week", label: "Study week", done: counts.studyBlocks > 0,
      detail: counts.studyBlocks ? `${counts.studyBlocks} weekly block${counts.studyBlocks === 1 ? "" : "s"}` : "Nothing planned",
      action: { label: "Plan", href: "/setup?step=blocks" },
    },
    {
      key: "backup", label: "Backup", done: backupFresh, section: "data",
      detail: backupDate && !Number.isNaN(backupDate.getTime())
        ? `${formatDistanceToNow(backupDate, { addSuffix: true })} on this device`
        : "Never on this device",
      action: { label: "Download", jump: "download-backup" },
    },
  ];
}

export function SetupStatus({ items, onJump }: { items: SetupItem[]; onJump: (settingId: string) => void }) {
  const done = items.filter((i) => i.done).length;
  const all = done === items.length;

  return (
    <section id="status" aria-labelledby="status-title" className={styles.status}>
      <div className={styles.statusTop}>
        <div>
          <h2 id="status-title">{all ? "Everything is set up" : "Setup status"}</h2>
          <p>
            {all
              ? "Your name, time zone, AI, subjects, study week and a recent backup are all in place."
              : `${done} of ${items.length} done. Finish the rest so every part of the app works.`}
          </p>
        </div>
        {all && <PartyPopper className="size-6 text-primary" aria-hidden="true" />}
      </div>
      <div
        className={styles.bar}
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
      >
        {items.map((i) => <span key={i.key} data-done={i.done} />)}
      </div>
      {!all && (
        <ul className={styles.statusList}>
          {items.map((item) => (
            <li key={item.key} className={styles.statusItem}>
              {item.done ? (
                <CheckCircle2 className="size-[18px] text-success" aria-label="Done" />
              ) : (
                <Circle className="size-[18px] text-muted-foreground" aria-label="Not done" />
              )}
              <div className="min-w-0 flex-1">
                <p>{item.label}</p>
                <small>{item.detail}</small>
              </div>
              {!item.done &&
                ("href" in item.action ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={item.action.href}>{item.action.label}</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onJump((item.action as { jump: string }).jump)}>
                    {item.action.label}
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
