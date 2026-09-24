'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { resolveNav } from "@/lib/nav";

/**
 * The other pages of the current section, as small pills inside the page
 * header (styled like Home's "0 / 0 done" pill). This replaced a full-width
 * tab strip under the app header: same job - every page one click from its
 * siblings - without a second ruled bar across the top of every screen.
 */
export function SectionNav() {
  const pathname = usePathname();
  const section = resolveNav(pathname)?.section;
  const pages = section?.children ?? [];
  if (!section || pages.length < 2) return null;

  // Longest match wins, so /exams/abc lights up Exams.
  const active = pages
    .filter((p) => pathname === p.href || pathname?.startsWith(p.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={`${section.name} pages`} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pt-2 sm:mx-0 sm:flex-wrap sm:px-0">
      {pages.map((page) => {
        const Icon = page.icon;
        const isActive = page === active;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/70"
            )}
          >
            <Icon className="size-4" />
            {page.name}
          </Link>
        );
      })}
    </nav>
  );
}
