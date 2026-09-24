import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Progress section's one segmented control: Insights' year / all-time
 * scope, Reports' daily / weekly view and History's period filter. An option
 * with `href` is a link (the choice lives in the URL); one with `onSelect` is a
 * button (the choice is client state).
 */
export type SegmentedOption = {
  value: string;
  label: React.ReactNode;
  href?: string;
  onSelect?: () => void;
};

const itemClass =
  "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function Segmented({
  label,
  value,
  options,
  className,
}: {
  /** Accessible name for the group, e.g. "Report period". */
  label: string;
  value: string;
  options: SegmentedOption[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const stateClass = active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground";

        if (option.href) {
          return (
            <Link
              key={option.value}
              href={option.href}
              aria-current={active ? "page" : undefined}
              className={cn(itemClass, stateClass)}
            >
              {option.label}
            </Link>
          );
        }
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={option.onSelect}
            className={cn(itemClass, stateClass)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
