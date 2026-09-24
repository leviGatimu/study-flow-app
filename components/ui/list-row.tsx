import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const rowClass =
  "flex items-center justify-between gap-3 bg-muted/40 px-5 py-4 rounded-2xl border border-border/40 transition-colors";

/**
 * One item in a list inside a panel - the dashboard's "Tomorrow's Plan" row.
 * With `href` the whole row is a link and gains the hover wash; without it the
 * row is static and any controls go in `actions`.
 */
export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  className,
}: {
  href?: string;
  /** An icon, checkbox or small button on the left. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A Pill, time or action on the right. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground transition-colors group-hover:text-primary">
            {title}
          </p>
          {subtitle && (
            <p className="truncate text-xs font-medium text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          rowClass,
          "group hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={cn(rowClass, "group", className)}>{body}</div>;
}

/**
 * The dashboard's small rounded tag ("20:00", "Done", "3 / 5 Tasks").
 * `tone` is for status only: primary for done/active, warning for due soon,
 * danger for overdue.
 */
export function Pill({
  tone = "default",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-muted-foreground bg-background border-border",
    primary: "text-primary bg-background border-primary/20",
    success: "text-success bg-success/10 border-success/20",
    warning: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20",
    danger: "text-destructive bg-destructive/10 border-destructive/20",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums whitespace-nowrap [&_svg]:size-3.5",
        toneClass,
        className
      )}
      {...props}
    />
  );
}
