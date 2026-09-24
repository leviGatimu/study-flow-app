import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single headline number with a label, in the dashboard's type: a muted
 * sentence-case label over a font-black figure (the contract reserves
 * font-black for exactly this). Colour is opt-in via `tone` and should report
 * status, not decorate.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-orange-500",
    danger: "text-destructive",
  }[tone];

  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 font-heading text-3xl font-black tracking-tight tabular-nums", toneClass)}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{hint}</p>}
    </div>
  );
}
