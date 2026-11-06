'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Page } from '@/components/ui/page';

const PAGES = (NAV.find((section) => section.name === 'Schedule')?.children ?? []).filter((page) => !page.hidden);

/**
 * The full-screen frame for Week, Month and Study routine: one slim toolbar
 * (title, what it covers, arrows, the section's pages, actions) and the board
 * filling everything below it. The board scrolls inside itself only when the
 * screen is too short, so the page never does.
 */
export function ScheduleFrame({
  title,
  meta,
  controls,
  legend,
  actions,
  tour,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** Arrows and "This week", next to the title. */
  controls?: ReactNode;
  legend?: ReactNode;
  actions?: ReactNode;
  /** Onboarding tour anchor. */
  tour?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <Page bleed className="min-h-0">
      <header data-tour={tour} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/60 px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-bold leading-tight tracking-tight text-foreground">{title}</h1>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
        {controls && <div className="flex shrink-0 items-center gap-1.5">{controls}</div>}
        {legend && <div className="hidden xl:block">{legend}</div>}

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">
          <nav aria-label="Schedule pages" className="scrollbar-none flex max-w-full overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-0.5">
            {PAGES.map((page) => {
              const active = pathname === page.href;
              const Icon = page.icon;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {page.name}
                </Link>
              );
            })}
          </nav>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </Page>
  );
}

/** The small key in the toolbar. */
export function BlockKey({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] bg-primary" /> Homework
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] border-[1.5px] border-dashed border-orange-500 bg-orange-500/15" /> Revision
      </span>
      {children}
    </div>
  );
}

/** The key for the week cards: a solid outline is homework, a dashed one revision. */
export function EdgeKey() {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] border border-primary/70" /> Homework
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] border border-dashed border-orange-500/80" /> Revision
      </span>
    </div>
  );
}
