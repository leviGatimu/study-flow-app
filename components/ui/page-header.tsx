import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single page title treatment, cut from the dashboard hero: the same
 * pt/pb, the same border-border/40 rule, the same gutter. The dashboard's own
 * h1 is a personal greeting in font-black; every other page's title is a label
 * and stays font-bold (docs/ui-contract.md).
 *
 * `description` says what the page is for in one sentence. `actions` holds the
 * page's primary action (and at most one or two secondary ones) on the right.
 * `meta` is an optional line under the description for live context, such as
 * "3 due this week".
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 px-4 md:px-8 pt-8 pb-6 border-b border-border/40 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-base font-medium text-muted-foreground">
            {description}
          </p>
        )}
        {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
