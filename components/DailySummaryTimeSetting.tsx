"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { updateDailySummaryTime } from "@/lib/actions";
import { toast } from "sonner";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** When the daily report is written, saved as soon as it changes. */
export function DailySummaryTimeSetting({ initialTime }: { initialTime: string }) {
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);

  const handleChange = async (value: string) => {
    setTime(value);
    // A cleared or half-typed field is not a time. The server would silently
    // ignore it, so do not claim it was saved.
    if (!TIME_PATTERN.test(value)) return;
    setSaving(true);
    try {
      await updateDailySummaryTime(value);
      toast.success(`Daily reports will be written at ${value}.`);
    } catch {
      toast.error("The report time could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm">
      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Daily report at</span>
      <input
        type="time"
        value={time}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent font-bold tabular-nums text-foreground outline-none disabled:opacity-50"
      />
    </label>
  );
}
