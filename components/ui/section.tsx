import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A titled block within a page. Owns the heading size and the gap between the
 * heading and its content so sections can't drift apart across pages.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
