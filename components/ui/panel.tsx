import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The app's one surface, copied from the dashboard's panels
 * (docs/ui-contract.md "Surfaces"). No gradient, no glow, no hover lift, no
 * arbitrary radius. `interactive` adds the dashboard's hover shadow and is only
 * for panels that respond to the pointer. `padded={false}` is for panels whose
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
        interactive && "hover:shadow-md transition-shadow duration-200",
        className
      )}
      {...props}
    />
  );
}

/**
 * A panel's heading row: the dashboard's h3 with its w-5 icon, and an optional
 * action (a link or a small button) pushed to the right.
 */
export function PanelTitle({
  icon,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h3 className="font-heading font-bold text-lg flex items-center gap-2 min-w-0 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-primary">
        {icon}
        <span className="truncate">{children}</span>
      </h3>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
