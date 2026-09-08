"use client";

import { Archive } from "lucide-react";

import { exitArchive } from "@/app/archive-actions";
import { useArchive } from "@/components/ArchiveContext";
import { Button } from "@/components/ui/button";

/**
 * The bar that says you are reading a finished year.
 *
 * It lives in AppShell between the header and the scrolling content, so it is
 * chrome: it survives every navigation and never scrolls away. Without it the
 * app would look identical in both years while quietly refusing every write,
 * which is the one failure mode this whole feature exists to avoid.
 *
 * Styled as chrome rather than as a page panel - the same border and token
 * palette as the header it sits under - with a single amber wash, which is the
 * app's existing "paused / not running" tone (see the Year & Terms page).
 */
export function ArchiveBanner() {
  const archive = useArchive();
  if (!archive) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 md:px-4"
    >
      <Archive className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />

      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        <span className="font-medium">Viewing {archive.label}</span>
        {/* Hidden rather than truncated on a narrow screen: half a sentence
            is worse than the headline alone. */}
        <span className="hidden text-muted-foreground sm:inline">
          {" "}
          &mdash; a finished year. Everything here is read-only.
        </span>
      </p>

      {/* Always rendered. Without an active year the label has to be generic,
          but leaving the bar with no way out would strand the user here. */}
      <form action={exitArchive} className="shrink-0">
        <Button type="submit" variant="outline" size="sm">
          {archive.activeLabel ? `Back to ${archive.activeLabel}` : "Leave archive"}
        </Button>
      </form>
    </div>
  );
}
