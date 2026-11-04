"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV, NavSection, resolveNav } from "@/lib/nav";
import { getRankInfo, getXpForNextLevel } from "@/lib/levels";
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

/** Settings sits under a divider, still in the top group (links stay at the top). */
const MAIN = NAV.filter((s) => s.href !== "/settings");
const SETTINGS = NAV.filter((s) => s.href === "/settings");

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
 * the labels fade in beside them. Pure CSS (group-hover / focus-within) for
 * the opening; the active marker slides between items with framer-motion.
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
  const isActive = (section: NavSection) =>
    section === ADMIN_SECTION ? (pathname?.startsWith("/admin") ?? false) : activeSection?.name === section.name;

  return (
    <aside data-tour="sidebar" className="group/sidebar relative z-40 hidden w-[72px] shrink-0 md:block">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar",
          "transition-[width,box-shadow] duration-200 ease-out",
          "group-hover/sidebar:w-60 group-hover/sidebar:shadow-[8px_0_32px_-8px_rgb(0_0_0/0.45)]",
          "group-focus-within/sidebar:w-60 group-focus-within/sidebar:shadow-[8px_0_32px_-8px_rgb(0_0_0/0.45)]"
        )}
      >
        {/* Same height and rule as the app header, so the two read as one bar. */}
        <Link
          href="/"
          aria-label="Study Flow home"
          className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-xl object-cover shadow-md shadow-black/25 ring-1 ring-foreground/10"
          />
          <Label className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-foreground">Study Flow</span>
            <span className="block text-[11px] font-medium text-muted-foreground">Study planner</span>
          </Label>
        </Link>

        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {MAIN.map((section) => (
              <li key={section.name}>
                <RailLink section={section} active={isActive(section)} />
              </li>
            ))}
          </ul>

          <div aria-hidden className="mx-2 my-3 h-px bg-sidebar-border" />

          <ul className="flex flex-col gap-1">
            {SETTINGS.map((section) => (
              <li key={section.name}>
                <RailLink section={section} active={isActive(section)} />
              </li>
            ))}
            {isAdmin && (
              <li>
                <RailLink section={ADMIN_SECTION} active={isActive(ADMIN_SECTION)} />
              </li>
            )}
          </ul>
        </nav>

        {userProgress && <LevelCard level={userProgress.level} xp={userProgress.xp} />}
      </div>
    </aside>
  );
}

/** A label that is invisible on the rail and fades in once the panel opens. */
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "block whitespace-nowrap opacity-0 transition-opacity duration-150",
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
  const reduceMotion = useReducedMotion();
  return (
    <Link
      href={section.href}
      aria-label={section.name}
      aria-current={active ? "page" : undefined}
      // Anchor for the onboarding tour: [data-tour="nav-subjects"] etc.
      data-tour={`nav-${section.name.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "group/link relative flex h-12 shrink-0 items-center gap-2 rounded-xl transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "text-foreground group-hover/sidebar:bg-primary/10"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      )}
    >
      {/* The active marker: a bar on the rail's inner edge that slides between items. */}
      {active && (
        <motion.span
          layoutId="sidebar-active-marker"
          aria-hidden
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
          className="absolute -left-3 top-3 h-6 w-[3px] rounded-r-full bg-primary"
        />
      )}
      <span className="flex size-12 shrink-0 items-center justify-center">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition-all duration-150",
            active
              ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary),inset_0_1px_0_rgb(255_255_255/0.25)]"
              : "group-hover/link:bg-foreground/[0.06]"
          )}
        >
          <Icon className="size-[19px]" strokeWidth={active ? 2 : 1.75} />
        </span>
      </span>
      <Label className={cn("text-sm", active ? "font-semibold" : "font-medium")}>{section.name}</Label>
    </Link>
  );
}

/** Level badge with an XP ring; opens into level, rank and XP to go. */
function LevelCard({ level, xp }: { level: number; xp: number }) {
  const goal = getXpForNextLevel(level);
  const ratio = goal > 0 ? Math.min(Math.max(xp / goal, 0), 1) : 0;
  const rank = getRankInfo(level);
  const radius = 17;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="shrink-0 border-t border-sidebar-border p-3">
      <Link
        href="/streak"
        aria-label={`Level ${level}, ${xp.toLocaleString()} of ${goal.toLocaleString()} XP`}
        className="flex h-12 items-center gap-2 rounded-xl transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="relative flex size-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="absolute size-10 -rotate-90" aria-hidden>
            <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="3" className="stroke-foreground/10" />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              className="stroke-primary transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <span className="text-sm font-bold tabular-nums text-foreground">{level}</span>
        </span>
        <Label className="min-w-0 flex-1 pr-3">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Level {level}</span>
            <span className={cn("text-[11px] font-semibold", rank.color)}>{rank.name}</span>
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
            {xp.toLocaleString()} / {goal.toLocaleString()} XP
          </span>
        </Label>
      </Link>
    </div>
  );
}
