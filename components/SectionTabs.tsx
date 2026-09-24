'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { resolveNav } from "@/lib/nav";

/**
 * Every page of the current section, as one row of tabs under the header.
 *
 * The sidebar only lists a section's pages while it is expanded, so on a
 * collapsed sidebar a page like Exams had no visible way to its siblings or
 * back to Subjects. This strip is that way, on every page that belongs to a
 * section with more than one page. The section's hub is always the first tab.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const section = resolveNav(pathname)?.section;
  const pages = section?.children ?? [];
  if (!section || pages.length < 2) return null;

  // Longest match wins, so /exams/abc lights up Exams and not a shorter href.
  const active = pages
    .filter((p) => pathname === p.href || pathname?.startsWith(p.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav
      aria-label={`${section.name} pages`}
      className="app-scroll flex h-11 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border bg-background px-3 md:px-4"
    >
      {pages.map((page) => {
        const Icon = page.icon;
        const isActive = page === active;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-2.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md",
              isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {page.name}
            {isActive && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
