import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An inline failure: what went wrong in plain words and how to recover. Never
 * pass a raw error message as `title` - log it and say what the user can do.
 */
export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 text-center px-6 py-6 rounded-2xl border border-destructive/20 bg-destructive/5",
        className
      )}
    >
      <AlertTriangle className="mb-1 size-5 text-destructive" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-sm font-medium text-muted-foreground">{description}</p>
      )}
      {action && <div className="pt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
