import { cn } from "@/lib/utils";
import type { SubjectProgress } from "@/lib/subject-progress";

/** Where a subject's mark comes from, in words. */
export function sourceText(p: SubjectProgress): string {
  if (p.source === "exams") {
    const n = p.results.length;
    const how = n > 1 ? (p.weighted ? ", weighted by share of the grade" : ", each counted the same") : "";
    return `From ${n} ${n === 1 ? "exam" : "exams"} this term${how}`;
  }
  if (p.source === "report") return `From your ${p.reportTerm ?? "latest"} report card`;
  return "No exam results or report card mark yet";
}

/** What the coming exams need, or null when there is nothing to say. */
export function neededText(p: SubjectProgress): { text: string; tone: "success" | "warning" | "danger" | "default" } | null {
  if (p.needed === null || p.target === null) return null;
  const left = p.coming.length;
  const what = left === 1 ? p.coming[0].title : `the ${left} exams left`;
  if (p.needed <= 0) return { text: `Target reached whatever happens in ${what}.`, tone: "success" };
  if (p.needed > 100) return { text: `Even 100% in ${what} would not reach ${p.target}%.`, tone: "danger" };
  // neededOnRest uses weights only when every exam has one; say so otherwise.
  const allWeighted = [...p.results, ...p.coming].every((e) => e.weight !== null && e.weight > 0);
  const assumption = allWeighted ? "" : " (if each exam counts the same)";
  return {
    text: `You need ${p.needed}% ${left === 1 ? "in" : "on average in"} ${what} to reach ${p.target}%${assumption}.`,
    tone: p.needed > 90 ? "danger" : p.needed > (p.current ?? 0) ? "warning" : "default",
  };
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** 0-100 bar: the fill is where you are, the tick is the target. */
export function GoalBar({
  current,
  target,
  className,
}: {
  current: number | null;
  target: number | null;
  className?: string;
}) {
  const met = current !== null && target !== null && current >= target;
  const label =
    current === null
      ? "No mark yet"
      : target === null
        ? `${current}%`
        : `${current}% against a target of ${target}%`;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      {current !== null && (
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            target === null ? "bg-primary" : met ? "bg-success" : "bg-orange-500"
          )}
          style={{ width: `${clamp(current)}%` }}
        />
      )}
      {target !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp(target)}%` }} />
      )}
    </div>
  );
}

/** Each marked exam as a small chip: "Midterm 1 · 62%". */
export function ResultChips({ progress, max = 4 }: { progress: SubjectProgress; max?: number }) {
  if (progress.results.length === 0) return null;
  const shown = progress.results.slice(-max);
  const hidden = progress.results.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Exam results">
      {hidden > 0 && <li className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">+{hidden} earlier</li>}
      {shown.map((r) => (
        <li
          key={r.id}
          className="max-w-full truncate rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
          title={r.title}
        >
          {r.category ?? r.title} · <span className="font-semibold tabular-nums text-foreground">{r.percent}%</span>
        </li>
      ))}
    </ul>
  );
}
