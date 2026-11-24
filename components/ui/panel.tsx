import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The app's one surface, copied from the dashboard's panels
 * (docs/ui-contract.md "Surfaces"). No gradient, no glow, no arbitrary radius.
 * `interactive` adds a hover shadow and a small lift, and is only for panels
 * that respond to the pointer. `padded={false}` is for panels whose
 * content is a flush list or a table.
 */
export function Panel({
  className,
  padded = true,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { padded?: boolean; interactive?: boolean }) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "bg-card text-card-foreground border border-border/60 shadow-sm rounded-2xl",
        padded && "p-6",
        interactive && "hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,translate] duration-200 motion-reduce:hover:translate-y-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * A panel's heading row: the dashboard's h3 with its w-5 icon, and an optional
 * action (a link or a small button) pushed to the right.
 *
 * `tone` puts the icon in a soft coloured tile instead (the exam page's look).
 */
const TILE_TONES = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
} as const;

export type PanelTone = keyof typeof TILE_TONES;

export function PanelTitle({
  icon,
  children,
  action,
  className,
  tone,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tone?: PanelTone;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h3
        className={cn(
          "font-heading font-bold text-lg flex items-center min-w-0",
          tone ? "gap-3" : "gap-2 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-primary"
        )}
      >
        {tone && icon ? (
          <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-2xl [&_svg]:size-5", TILE_TONES[tone])}>
            {icon}
          </span>
        ) : (
          icon
        )}
        <span className="truncate">{children}</span>
      </h3>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
