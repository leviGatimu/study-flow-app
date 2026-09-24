"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Plus,
  Search,
  Settings,
  Trophy,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { pageTitle, resolveNav } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QuickAddForm } from "@/components/QuickAddForm";
import { HeaderStats } from "@/components/HeaderStats";
import { ReminderManager } from "@/components/ReminderManager";
import { openCommandMenu } from "@/components/CommandMenu";
import { logoutUser } from "@/lib/actions";
import { SafeUserProgress as UserProgress } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The persistent top bar.
 *
 * It gives the app a fixed frame: you always know where you are, search is
 * always one click away, and the actions reached for constantly (start a focus
 * block, add a task, switch theme, sign out) live in one predictable place
 * instead of being duplicated per page. On the desktop build this same bar
 * doubles as the draggable window title bar.
 */
export function AppHeader({
  userProgress,
  subjects,
}: {
  userProgress: UserProgress | null;
  subjects: { id: string; name: string }[];
}) {
  const pathname = usePathname();

  const title = pageTitle(pathname);
  const match = resolveNav(pathname);
  const parent = match?.leaf ? match.section.name : null;

  const name = userProgress?.name || "Student";
  const initial = name.trim().charAt(0).toUpperCase() || "S";

  return (
    <>
      <header className="titlebar-drag flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        {/* Where you are */}
        <div className="min-w-0 flex-1 md:max-w-56 md:flex-none">
          <p className="truncate font-heading text-base font-semibold text-foreground">
            {title}
          </p>
          {parent && (
            <p className="truncate text-xs text-muted-foreground">{parent}</p>
          )}
        </div>

        {/* Search. Opens the command palette rather than being a second,
            competing search implementation. */}
        <div className="titlebar-no-drag flex flex-1 justify-center">
          <button
            type="button"
            onClick={openCommandMenu}
            data-tour="command-palette"
            className={cn(
              "hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 text-sm text-muted-foreground sm:flex",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            )}
          >
            <Search className="size-[18px] shrink-0" />
            <span className="truncate">Search tasks, notes, subjects...</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium md:inline">
              Ctrl K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={openCommandMenu}
            className="sm:hidden"
          >
            <Search />
          </Button>
        </div>

        {/* Streak / level / clock, visible on every page */}
        {userProgress && (
          <div className="titlebar-no-drag hidden shrink-0 items-center md:flex">
            <HeaderStats progress={userProgress} />
            <div className="mx-2 h-6 w-px bg-border" />
          </div>
        )}

        {/* Actions */}
        <div className="titlebar-no-drag flex shrink-0 items-center gap-1 md:justify-end">
          <Button variant="ghost" size="icon-lg" asChild aria-label="Focus mode" className="[&_svg]:size-[18px]">
            <Link href="/focus" data-tour="focus-mode">
              <Zap />
            </Link>
          </Button>

          <ReminderManager timezone={userProgress?.timezone} />

          <QuickAddForm
            subjects={subjects}
            trigger={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Add a task"
                className="[&_svg]:size-[18px] md:hidden"
              >
                <Plus />
              </Button>
            }
          />

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {name}
                {userProgress && (
                  <span className="block text-foreground">
                    Level {userProgress.level} - {userProgress.xp} XP
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/streak">
                  <Trophy /> Streak and level
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={logoutUser}>
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut /> Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

    </>
  );
}
