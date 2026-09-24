import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one empty state, on the dashboard's muted well (docs/ui-contract.md
 * "Empty states"). It must say what is missing and, through `action`, offer
 * the thing that fills it - never a bare "No data".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 text-center px-6 py-6 bg-muted/50 rounded-2xl border border-border/50",
        className
      )}
    >
      {icon && <div className="mb-1 text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-sm font-medium text-muted-foreground">{description}</p>
      )}
      {action && <div className="pt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
