'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { mentorVisible, NAV, resolveNav } from "@/lib/nav";
import { useMentor } from "@/components/ArchiveContext";

/**
 * Primary navigation below md: the five working sections as a bottom tab bar,
 * in thumb reach. Settings is not a tab - it lives in the account menu, the
 * way it does on the desktop header - so five items keep their labels.
 *
 * It is a flex child under <main>, not position:fixed, so it can never cover
 * the last row of a page and no page has to pad itself to clear it.
 */
// Sections with a mobileGroup (Homework, Exams, Resources) ride on their
// group's tab, so the bar keeps five labelled tabs.
const TABS = NAV.filter((section) => section.name !== "Settings" && !section.mobileGroup);

export function MobileTabBar() {
  const pathname = usePathname();
  const current = resolveNav(pathname)?.section;
  const active = current?.mobileGroup ?? current?.name;
  const tabs = useMentor() ? mentorVisible(TABS) : TABS;
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((section) => {
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
            <span className="relative flex h-7 w-12 items-center justify-center">
              {/* The highlight slides from the old tab to the new one. */}
              {isActive && (
                <motion.span
                  layoutId="mobile-tab-active"
                  aria-hidden
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                  className="absolute inset-0 rounded-full bg-primary/10"
                />
              )}
              <Icon className="relative size-5" />
            </span>
            {section.name}
          </Link>
        );
      })}
    </nav>
  );
}
