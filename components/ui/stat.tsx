import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single number with a label. Replaces the bespoke coloured widgets that were
 * scattered across the dashboard (each with its own tint, glow and icon
 * treatment). Colour is opt-in via `tone` and should mean something.
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
    <div className={cn("flex items-center gap-3", className)}>
      {icon && (
        <div className={cn("flex size-9 items-center justify-center rounded-lg bg-muted", toneClass)}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("font-heading text-lg leading-tight font-semibold", toneClass)}>
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
