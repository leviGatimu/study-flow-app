'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV, resolveNav } from "@/lib/nav";

/**
 * Primary navigation below md: the five working sections as a bottom tab bar,
 * in thumb reach. Settings is not a tab - it lives in the account menu, the
 * way it does on the desktop header - so five items keep their labels.
 *
 * It is a flex child under <main>, not position:fixed, so it can never cover
 * the last row of a page and no page has to pad itself to clear it.
 */
const TABS = NAV.filter((section) => section.name !== "Settings");

export function MobileTabBar() {
  const pathname = usePathname();
  const active = resolveNav(pathname)?.section.name;

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {TABS.map((section) => {
        const Icon = section.icon;
        const isActive = active === section.name;
        return (
          <Link
            key={section.name}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                isActive && "bg-primary/10"
              )}
            >
              <Icon className="size-5" />
            </span>
            {section.name}
          </Link>
        );
      })}
    </nav>
  );
}
