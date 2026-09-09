"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV, NavSection, resolveNav } from "@/lib/nav";
import { QuickAddForm } from "@/components/QuickAddForm";
import { useArchiveReason } from "@/components/ArchiveContext";
import { SafeUserProgress as UserProgress } from "@/lib/types";

/**
 * Remembered per browser, so the rail opens the way you left it. Read through
 * useSyncExternalStore rather than an effect: the server has no localStorage,
 * so it renders unpinned and React reconciles on hydration without a
 * setState-in-effect cascade.
 */
const PIN_KEY = "sidebarPinned";
const PIN_EVENT = "sidebar-pin-change";

const subscribeToPin = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(PIN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PIN_EVENT, onChange);
  };
};
const readPin = () => localStorage.getItem(PIN_KEY) === "true";
const pinOnServer = () => false;

/**
 * Primary navigation: a 64px icon rail that opens to 240px on hover, on
 * keyboard focus, or for good once you pin it.
 *
 * Unpinned, the open panel is absolutely positioned OVER the page while the
 * aside keeps reserving its 64px - a rail that widened in flow would shove the
 * whole page sideways every time the pointer crossed it. Pinned, the aside
 * reserves the full 240px and the panel fills it exactly, so nothing overlaps
 * and the shift happens once, because you asked for it.
 *
 * Sub-pages are listed inline under whichever section the pointer (or focus)
 * is on, defaulting to the section you are in. That keeps the old flyout's one
 * real virtue - any sub-page is reachable without first navigating into its
 * section - without the flyout's dead zones between rail and panel.
 */
export function Sidebar({
  userProgress,
  subjects,
}: {
  userProgress: UserProgress | null;
  subjects: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const activeSection = resolveNav(pathname)?.section;
  const archiveReason = useArchiveReason();

  const pinned = useSyncExternalStore(subscribeToPin, readPin, pinOnServer);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [pointedSection, setPointedSection] = useState<string | null>(null);

  const togglePin = () => {
    localStorage.setItem(PIN_KEY, String(!pinned));
    window.dispatchEvent(new Event(PIN_EVENT));
  };

  const expanded = pinned || pointerInside || focusInside;
  const openSection = expanded
    ? pointedSection ?? activeSection?.name ?? null
    : null;

  const collapse = () => {
    setPointerInside(false);
    setPointedSection(null);
  };

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "relative z-40 hidden shrink-0 transition-[width] duration-[var(--duration-base)] ease-out md:block",
        pinned ? "w-60" : "w-16"
      )}
    >
      <div
        onMouseEnter={() => setPointerInside(true)}
        onMouseLeave={collapse}
        onFocus={() => setFocusInside(true)}
        onBlur={(e) => {
          // Focus moving between two links inside the rail must not close it,
          // so only a target outside the panel counts as leaving.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocusInside(false);
            setPointedSection(null);
          }
        }}
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-sidebar py-3 transition-[width] duration-[var(--duration-base)] ease-out",
          expanded ? "w-60" : "w-16",
          // Only the overlaying state needs to lift off the page beneath it.
          expanded && !pinned && "shadow-lg"
        )}
      >
        <div className="flex items-center gap-3 px-3">
          <Link href="/" aria-label="Study Flow home" className="shrink-0">
            <img
              src="/logo.png"
              alt=""
              className="size-9 rounded-xl object-cover"
            />
          </Link>
          {expanded && (
            <>
              <span className="truncate font-heading text-sm font-bold text-foreground">
                Study Flow
              </span>
              <button
                type="button"
                onClick={togglePin}
                aria-pressed={pinned}
                title={pinned ? "Let the sidebar collapse" : "Keep the sidebar open"}
                className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {pinned ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeftOpen className="size-4" />
                )}
                <span className="sr-only">
                  {pinned ? "Let the sidebar collapse" : "Keep the sidebar open"}
                </span>
              </button>
            </>
          )}
        </div>

        <div className="mt-3 px-3">
          {/* While a finished year is open this stays in place but inert, and
              says why. Removing it outright would leave the rail's most
              prominent slot empty and read as a bug rather than a rule. */}
          {archiveReason ? (
            <button
              type="button"
              // aria-disabled rather than disabled: a `disabled` button gets no
              // pointer events in Chrome, so its title tooltip - the thing that
              // explains why it is off - would never appear.
              aria-disabled="true"
              aria-label="Add a task"
              title={archiveReason}
              className={cn(
                "flex h-10 w-full items-center rounded-xl bg-muted text-muted-foreground",
                expanded ? "gap-3 px-2.5" : "justify-center"
              )}
            >
              <Lock className="size-5 shrink-0" />
              {expanded && (
                <span className="truncate text-sm font-medium">Read-only year</span>
              )}
            </button>
          ) : (
            <QuickAddForm
              subjects={subjects}
              trigger={
                <button
                  type="button"
                  aria-label="Add a task"
                  title="Add a task"
                  className={cn(
                    "flex h-10 w-full items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    expanded ? "gap-3 px-2.5" : "justify-center"
                  )}
                >
                  <Plus className="size-5 shrink-0" />
                  {expanded && (
                    <span className="truncate text-sm font-medium">Add a task</span>
                  )}
                </button>
              }
            />
          )}
        </div>

        <nav aria-label="Primary" className="mt-3 flex flex-col gap-1 px-3">
          {NAV.map((section) => (
            <RailItem
              key={section.name}
              section={section}
              pathname={pathname}
              expanded={expanded}
              isActive={activeSection?.name === section.name}
              showChildren={openSection === section.name}
              onPoint={() => setPointedSection(section.name)}
            />
          ))}
        </nav>

        {userProgress && (
          <div className="mt-auto px-3 pt-3">
            <Link
              href="/ranks"
              title={`Level ${userProgress.level}`}
              className={cn(
                "flex h-10 w-full items-center rounded-xl border border-border bg-card transition-colors hover:bg-muted",
                expanded ? "gap-3 px-2.5" : "justify-center"
              )}
            >
              <span className="shrink-0 font-heading text-sm font-semibold text-primary">
                {userProgress.level}
              </span>
              {expanded && (
                <span className="truncate text-sm font-medium text-foreground">
                  Level {userProgress.level}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

function RailItem({
  section,
  pathname,
  expanded,
  isActive,
  showChildren,
  onPoint,
}: {
  section: NavSection;
  pathname: string | null;
  expanded: boolean;
  isActive: boolean;
  showChildren: boolean;
  onPoint: () => void;
}) {
  const Icon = section.icon;
  const children = section.children ?? [];

  return (
    <div onMouseEnter={onPoint} onFocus={onPoint}>
      <Link
        href={section.href}
        aria-label={section.name}
        aria-current={pathname === section.href ? "page" : undefined}
        title={section.name}
        // Anchor for the onboarding tour: [data-tour="nav-subjects"] and so on.
        // Derived from the section rather than hand-written per item, so a
        // renamed or reordered section cannot leave the tour pointing at
        // nothing the way the old hard-coded nav-* anchors did.
        data-tour={`nav-${section.name.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "flex h-10 w-full items-center rounded-xl transition-colors",
          expanded ? "gap-3 px-2.5" : "justify-center",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-5 shrink-0" />
        {expanded && (
          <span className="truncate text-sm font-medium">{section.name}</span>
        )}
      </Link>

      {showChildren && children.length > 0 && (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-10">
          {children.map((child) => {
            const childActive =
              pathname === child.href || pathname?.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={pathname === child.href ? "page" : undefined}
                className={cn(
                  "truncate rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {child.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
