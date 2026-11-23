"use client";

import Link from "next/link";
import { Eye, LayoutDashboard, LogOut } from "lucide-react";

import { logoutUser } from "@/lib/actions";
import type { MentorView } from "@/components/ArchiveContext";
import { Button } from "@/components/ui/button";

/**
 * The bar a mentor sees on every page: whose Study Flow this is, that it is
 * read-only, and the way out. Same place and shape as ArchiveBanner, in the
 * primary colour so it is never mistaken for the archive's amber.
 */
export function MentorBanner({ mentor }: { mentor: NonNullable<MentorView> }) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-b border-primary/25 bg-primary/10 px-3 py-2 md:px-4">
      <Eye className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        <span className="font-medium">You&apos;re viewing {mentor.studentName}&apos;s Study Flow</span>
        <span className="hidden text-muted-foreground sm:inline"> &mdash; as a mentor. Read only.</span>
      </p>
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href="/mentor">
          <LayoutDashboard />
          <span className="hidden sm:inline">Mentor dashboard</span>
        </Link>
      </Button>
      {/* Signing out only clears the cookie, so the read-only guard lets it through. */}
      <form action={logoutUser} className="shrink-0">
        <Button type="submit" variant="outline" size="sm">
          <LogOut /> Sign out
        </Button>
      </form>
    </div>
  );
}
