import Link from "next/link";

import { hoursMinutes } from "@/lib/mentor-model";
import type { ReportData } from "@/lib/report-model";
import { cn } from "@/lib/utils";

/** One report as a row: grade tile, period, and how much of the plan was done. */
export function ReportRow({ report: r, active = false }: { report: ReportData; active?: boolean }) {
  return (
    <Link
      href={`/mentor/reports?view=${r.kind}&r=${r.id}`}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
        active ? "border-[var(--m-accent)]/50 bg-[var(--m-accent)]/8" : "border-border/60 hover:bg-muted/50"
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-bold text-white" style={{ background: r.color }}>
        {r.grade}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{r.kind === "weekly" ? `Week of ${r.shortTitle}` : r.shortTitle}</p>
        <p className="truncate text-xs text-muted-foreground">
          {r.level} · {hoursMinutes(r.doneMinutes)} of {hoursMinutes(r.plannedMinutes)}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{r.score}/100</span>
    </Link>
  );
}
