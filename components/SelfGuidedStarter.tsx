"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFocus } from "@/lib/FocusContext";
import { TaskWithTemplate } from "@/lib/types";

/**
 * Self-guided session starter: pick a length, start focusing.
 *
 * When nothing is scheduled, the status card used to just say "Self-Guided
 * Mode" and leave you to go find Focus Mode yourself. This puts the one useful
 * action where the status already is.
 *
 * It builds the same synthetic "free" task that /focus/free renders, hands it
 * to startFocus with the chosen duration, then navigates - so the session is
 * already running when the page arrives.
 *
 * `onDark` restyles it for the full-bleed coloured status cards, whose text is
 * white. The slider's track and range are internal to the primitive, so they
 * are reached through their data-slot attributes.
 */
export function SelfGuidedStarter({ onDark = false }: { onDark?: boolean }) {
  const { startFocus } = useFocus();
  const router = useRouter();
  const [minutes, setMinutes] = useState(45);

  const start = () => {
    const now = new Date();
    const end = new Date(now.getTime() + minutes * 60 * 1000);
    const hhmm = (d: Date) =>
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    const freeTask = {
      id: "free",
      userId: "",
      templateId: null,
      date: now,
      startTime: hhmm(now),
      endTime: hhmm(end),
      subject: "Custom Focus",
      isDone: false,
      isMissed: false,
      isDeleted: false,
      type: "FREE",
      template: null,
      workDescription: null,
      proofPdfUrl: null,
    } as unknown as TaskWithTemplate;

    startFocus(freeTask, minutes);
    router.push("/focus/free");
  };

  const label =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
      : `${minutes}m`;

  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[minutes]}
        onValueChange={([v]) => setMinutes(v)}
        min={10}
        max={120}
        step={5}
        aria-label="Session length in minutes"
        className={cn(
          "w-24 sm:w-32",
          onDark &&
            "[&_[data-slot=slider-track]]:bg-white/25 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-white",
        )}
      />
      <span
        className={cn(
          "w-11 shrink-0 text-sm font-bold tabular-nums",
          onDark ? "text-white" : "text-foreground",
        )}
      >
        {label}
      </span>
      <Button
        size="sm"
        onClick={start}
        className={cn(
          "gap-1.5 font-bold shrink-0 rounded-xl",
          onDark && "bg-white text-black hover:bg-white/90",
        )}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Start
      </Button>
    </div>
  );
}
