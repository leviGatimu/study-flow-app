"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Plus, ShieldCheck, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV, NavSection, resolveNav } from "@/lib/nav";
import { QuickAddForm } from "@/components/QuickAddForm";
import { useArchiveReason } from "@/components/ArchiveContext";
import { SafeUserProgress as UserProgress } from "@/lib/types";

/**
 * The admin console's entry. Deliberately NOT in lib/nav.ts: that list feeds
 * the command palette, which every account can open. The page 404s for a
 * non-admin regardless - this just keeps it out of sight.
 */
const ADMIN_SECTION: NavSection = {
  name: "Admin",
  href: "/admin",
  icon: ShieldCheck,
};

/**
 * Primary navigation: an ordinary, always-open sidebar.
 *
 * Levi rejected the hover-to-expand rail (2026-09-24): things grew and
 * appeared under the pointer, and the sub-pages that unfolded beneath a
 * section felt unlike a normal sidebar. So this is fixed-width, nothing moves
 * on hover, and it lists the six sections only - a section's own pages are
 * the pills in each page header (components/SectionNav.tsx).
 *
 * Shown from lg up. Between md and lg the same list collapses to icons so the
 * page keeps its width; below md the bottom tab bar takes over.
 */
export function Sidebar({
  userProgress,
  subjects,
  isAdmin = false,
}: {
  userProgress: UserProgress | null;
  subjects: { id: string; name: string }[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const activeSection = resolveNav(pathname)?.section;
  const archiveReason = useArchiveReason();

  const sections = isAdmin ? [...NAV, ADMIN_SECTION] : NAV;

  return (
    <aside
      data-tour="sidebar"
      className="hidden md:flex w-16 lg:w-60 shrink-0 flex-col border-r border-border bg-sidebar"
    >
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3.5 lg:px-5"
        aria-label="Study Flow home"
      >
        <img src="/logo.png" alt="" className="size-9 shrink-0 rounded-xl object-cover" />
        <span className="hidden lg:block font-heading text-lg font-bold text-foreground">Study Flow</span>
      </Link>

      <div className="px-3 pt-4 lg:px-4">
        {archiveReason ? (
          <button
            type="button"
            // aria-disabled rather than disabled, so the title tooltip that
            // explains why it is off still shows.
            aria-disabled="true"
            aria-label="Add a task"
            title={archiveReason}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-muted text-sm font-semibold text-muted-foreground"
          >
            <Lock className="size-4 shrink-0" />
            <span className="hidden lg:inline">Read-only year</span>
          </button>
        ) : (
          <QuickAddForm
            subjects={subjects}
            trigger={
              <button
                type="button"
                aria-label="Add a task"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-4 shrink-0" />
                <span className="hidden lg:inline">Add task</span>
              </button>
            }
          />
        )}
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-4 lg:px-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive =
            section === ADMIN_SECTION
              ? pathname?.startsWith("/admin") ?? false
              : activeSection?.name === section.name;
          return (
            <Link
              key={section.name}
              href={section.href}
              title={section.name}
              aria-current={isActive ? "page" : undefined}
              // Anchor for the onboarding tour: [data-tour="nav-subjects"] etc.
              data-tour={`nav-${section.name.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex h-10 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors lg:justify-start",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden lg:inline truncate">{section.name}</span>
            </Link>
          );
        })}
      </nav>

      {userProgress && (
        <div className="border-t border-border p-3 lg:p-4">
          <Link
            href="/streak"
            title={`Level ${userProgress.level}`}
            className="flex items-center justify-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted lg:justify-start"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-sm font-bold text-primary">
              {userProgress.level}
            </span>
            <span className="hidden lg:block min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">Level {userProgress.level}</span>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Trophy className="size-3" />
                {userProgress.xp.toLocaleString()} XP
              </span>
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
