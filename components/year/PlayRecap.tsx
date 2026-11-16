"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YearRecap } from "@/lib/year-recap";
import { RecapStory } from "./RecapStory";

/** The Year home's "Play your recap" button, and the story it opens. */
export function PlayRecap({ recap, className }: { recap: YearRecap; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group inline-flex h-14 items-center gap-3 rounded-full bg-white pl-2 pr-6 font-heading text-base font-bold text-slate-950 shadow-lg shadow-black/20 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:scale-[0.98]",
          className
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-slate-950 text-white transition-transform group-hover:scale-110">
          <Play className="size-4 translate-x-px fill-current" />
        </span>
        Play your recap
      </button>
      {open && <RecapStory recap={recap} onClose={() => setOpen(false)} />}
    </>
  );
}
