"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { updateDailySummaryTime } from "@/lib/actions";
import { toast } from "sonner";

export function DailySummaryTimeSetting({ initialTime }: { initialTime: string }) {
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);

  const handleChange = async (value: string) => {
    setTime(value);
    setSaving(true);
    try {
      await updateDailySummaryTime(value);
      toast.success(`Daily summary will auto-generate at ${value}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 h-[52px] rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md">
      <Clock className="w-4 h-4 text-primary shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Auto-generate at</span>
        <input
          type="time"
          value={time}
          disabled={saving}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-transparent text-sm font-bold text-foreground outline-none mt-0.5 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
