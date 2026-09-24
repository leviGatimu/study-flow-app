import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One door on a hub page: where it goes, and the single live fact that makes
 * it worth opening now ("3 pending", "In 5 days"). Every hub - Plan,
 * Subjects, Progress, Study - builds its grid from these so they read alike.
 *
 * `tone` tints the icon only. Use it to tell the doors apart, not to rank them.
 */
export function HubTile({
  href,
  icon,
  label,
  value,
  detail,
  tone = "primary",
  className,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** The live fact, big. Keep it to a few words. */
  value: React.ReactNode;
  /** One muted line of context under the value. Truncates. */
  detail?: React.ReactNode;
  tone?: "primary" | "blue" | "teal" | "orange" | "purple" | "emerald" | "rose" | "amber";
  className?: string;
}) {
  const tint = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[tone];

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors",
        "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", tint)}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate font-heading text-lg font-semibold leading-tight text-foreground">{value}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
