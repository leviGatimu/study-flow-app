"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV, NavSection, resolveNav } from "@/lib/nav";
import { QuickAddForm } from "@/components/QuickAddForm";
import { UserProgress } from "@/lib/types";

/**
 * Primary navigation: a fixed 64px icon rail.
 *
 * Each icon opens a flyout on hover or keyboard focus listing that section's
 * pages, so nothing is hidden behind "you must already be in this section" the
 * way an inline expanding list hides it - while the rail itself never costs
 * more than 64px of screen.
 *
 * There is no collapse toggle any more: the rail IS the collapsed state, so a
 * second one would be a control with nothing to do.
 *
 * Note the aside must NOT clip its overflow, or the flyouts get cut off.
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

  return (
    <aside
      data-tour="sidebar"
      className="z-40 hidden w-16 shrink-0 flex-col items-center border-r border-border bg-sidebar py-3 md:flex"
    >
      <Link href="/" className="mb-3" aria-label="Study Flow home">
        <img src="/logo.png" alt="" className="size-9 rounded-xl object-cover" />
      </Link>

      <QuickAddForm
        subjects={subjects}
        trigger={
          <button
            type="button"
            aria-label="Add a task"
            title="Add a task"
            className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-5" />
          </button>
        }
      />

      <nav className="flex flex-col items-center gap-1">
        {NAV.map((section) => (
          <RailItem
            key={section.name}
            section={section}
            pathname={pathname}
            isActive={activeSection?.name === section.name}
          />
        ))}
      </nav>

      {userProgress && (
        <Link
          href="/ranks"
          title={`Level ${userProgress.level}`}
          className="mt-auto flex size-10 items-center justify-center rounded-xl border border-border bg-card font-heading text-sm font-semibold text-primary transition-colors hover:bg-muted"
        >
          {userProgress.level}
        </Link>
      )}
    </aside>
  );
}

function RailItem({
  section,
  pathname,
  isActive,
}: {
  section: NavSection;
  pathname: string | null;
  isActive: boolean;
}) {
  const Icon = section.icon;
  const children = section.children ?? [];

  return (
    <div className="group/item relative">
      <Link
        href={section.href}
        aria-label={section.name}
        className={cn(
          "flex size-10 items-center justify-center rounded-xl transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-5" />
      </Link>

      {/*
        The wrapper's left padding is the visual gap between rail and panel, and
        it is deliberately part of the hoverable element: make it a margin, or
        give it pointer-events-none, and that gap becomes a dead zone that
        closes the flyout as the pointer crosses it.

        Hovering an absolutely-positioned descendant still counts as hovering
        the group, because :hover follows the DOM tree, not the visual box.
      */}
      <div
        className={cn(
          "absolute top-0 left-full z-50 hidden pl-2",
          "group-hover/item:block group-focus-within/item:block"
        )}
      >
        <div className="min-w-[12rem] rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
          {children.length === 0 ? (
            <Link
              href={section.href}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {section.name}
            </Link>
          ) : (
            <>
              <p className="px-3 py-1.5 text-xs text-muted-foreground">
                {section.name}
              </p>
              {children.map((child) => {
                const childActive =
                  pathname === child.href || pathname?.startsWith(child.href + "/");
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm transition-colors",
                      childActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {child.name}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
