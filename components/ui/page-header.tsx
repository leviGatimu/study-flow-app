import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single page title treatment for the whole app.
 *
 * Before this existed every page hand-rolled its own header, which is why
 * nothing matched: title sizes ranged from text-2xl to text-5xl, half were
 * uppercase, and each picked its own bottom border and spacing. Pages should
 * pass `title`/`description`/`actions` here and never style a heading directly.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
