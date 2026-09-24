"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV, NavSection, resolveNav } from "@/lib/nav";
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
 * Primary navigation: an icon rail that opens on hover (or keyboard focus)
 * to show each section's name.
 *
 * What Levi asked for, 2026-09-24, after two versions he disliked:
 *   - icons only by default, the names appear on hover;
 *   - nothing unfolds under a section (its pages are the pills in each page
 *     header, components/SectionNav.tsx);
 *   - no "Add task" here (it is the + in the app header).
 *
 * The aside reserves the 72px rail; the panel inside it widens OVER the page
 * rather than pushing it, so nothing on the page moves when the pointer
 * crosses the sidebar. Every icon sits in the same fixed 48px slot at every
 * width, so the icons stay perfectly still while the panel opens and only
 * the labels fade in beside them. Pure CSS (group-hover / focus-within): no
 * state, no hydration differences.
 */
export function Sidebar({
  userProgress,
  isAdmin = false,
}: {
  userProgress: UserProgress | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const activeSection = resolveNav(pathname)?.section;

  return (
    <aside data-tour="sidebar" className="group/sidebar relative z-40 hidden w-[72px] shrink-0 md:block">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-hidden border-r border-border bg-sidebar",
          "transition-[width,box-shadow] duration-200 ease-out",
          "group-hover/sidebar:w-60 group-hover/sidebar:shadow-2xl group-hover/sidebar:shadow-black/30",
          "group-focus-within/sidebar:w-60 group-focus-within/sidebar:shadow-2xl group-focus-within/sidebar:shadow-black/30"
        )}
      >
        <Link
          href="/"
          aria-label="Study Flow home"
          className="flex h-16 shrink-0 items-center gap-3 px-[14px] focus-visible:outline-none"
        >
          <img src="/logo.png" alt="" className="size-11 shrink-0 rounded-2xl object-cover" />
          <Label className="font-heading text-lg font-black tracking-tight text-foreground">Study Flow</Label>
        </Link>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1.5 px-3 pt-4">
          {NAV.map((section) => (
            <RailLink
              key={section.name}
              section={section}
              active={activeSection?.name === section.name}
            />
          ))}

          {isAdmin && (
            <>
              <div className="mx-3 my-2 h-px bg-border" />
              <RailLink section={ADMIN_SECTION} active={pathname?.startsWith("/admin") ?? false} />
            </>
          )}
        </nav>

        {userProgress && (
          <Link
            href="/streak"
            title={`Level ${userProgress.level}`}
            className="m-3 flex shrink-0 items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 font-heading text-sm font-black text-primary-foreground shadow-sm">
              {userProgress.level}
            </span>
            <Label className="min-w-0">
              <span className="block truncate text-sm font-bold text-foreground">Level {userProgress.level}</span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {userProgress.xp.toLocaleString()} XP
              </span>
            </Label>
          </Link>
        )}
      </div>
    </aside>
  );
}

/** A label that is invisible on the rail and fades in once the panel opens. */
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap opacity-0 transition-opacity duration-150",
        "group-hover/sidebar:opacity-100 group-hover/sidebar:delay-75",
        "group-focus-within/sidebar:opacity-100",
        className
      )}
    >
      {children}
    </span>
  );
}

function RailLink({ section, active }: { section: NavSection; active: boolean }) {
  const Icon = section.icon;
  return (
    <Link
      href={section.href}
      aria-label={section.name}
      aria-current={active ? "page" : undefined}
      // Anchor for the onboarding tour: [data-tour="nav-subjects"] etc.
      data-tour={`nav-${section.name.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "relative flex h-12 items-center gap-3 rounded-2xl transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {/* The active marker: a short bar on the rail's inner edge. */}
      {active && (
        <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <span className="flex size-12 shrink-0 items-center justify-center">
        <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 2} />
      </span>
      <Label className="text-[15px] font-semibold">{section.name}</Label>
    </Link>
  );
}
