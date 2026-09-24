"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Recharts measures its container, which does not exist during the server
 * render, so a chart is drawn only once the page has mounted. The frame keeps
 * its height either way so nothing jumps when the chart appears.
 */
export function ChartFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const mounted = useIsClient();
  return (
    <div className={cn("h-72 w-full", className)}>
      {mounted ? children : <div className="h-full w-full rounded-xl bg-muted/40" />}
    </div>
  );
}

const subscribeNothing = () => () => {};

/** True once rendering in the browser; false during the server render and hydration. */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(subscribeNothing, () => true, () => false);
}

/** Tooltip styling shared by every Progress chart, on the app's tokens. */
export const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid var(--border)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontWeight: 600,
  fontSize: "12px",
  background: "var(--card)",
  color: "var(--foreground)",
};

export const AXIS_TICK = { fontSize: 11, fontWeight: 600, fill: "var(--muted-foreground)" };

/** Orange is the app's revision / warning colour; charts reuse it for the second series. */
export const CHART_PRIMARY = "var(--primary)";
export const CHART_ORANGE = "#f97316";

/** Categorical colours for per-subject slices, primary first. */
export const SUBJECT_COLORS = [
  "var(--primary)",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
];
