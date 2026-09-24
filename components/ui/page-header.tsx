import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionNav } from "@/components/SectionNav";

/**
 * Every page's header, cut from the Home page's hero (app/page.tsx) so the
 * whole app opens the same way: a big font-black title where Home has its
 * greeting, a muted line under it where Home has the date, the section's
 * pages as pills where Home has "Take a tour", and on the right a card like
 * Home's "Currently in" card holding the page's one live fact and its actions.
 *
 * - `highlight` is that live fact ("Open homework", "3 · 1 overdue"). Without
 *   it the actions sit on their own on the right.
 * - `meta` is an extra muted line for context that is not a number
 *   ("Showing Physics only. Show all").
 * - `back` is for detail pages (an exam, a subject): one link to their list.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  highlight,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  highlight?: { label: React.ReactNode; value: React.ReactNode };
  back?: { href?: string; onClick?: () => void; label: string };
  className?: string;
}) {
  const backClass =
    "inline-flex items-center gap-1.5 text-xs font-bold text-primary/80 hover:text-primary transition-colors";

  return (
    <section
      className={cn(
        "flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4 md:px-8 pt-10 pb-6 border-b border-border/40",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {back &&
          (back.href ? (
            <Link href={back.href} className={backClass}>
              <ArrowLeft className="size-3.5" /> {back.label}
            </Link>
          ) : (
            <button type="button" onClick={back.onClick} className={backClass}>
              <ArrowLeft className="size-3.5" /> {back.label}
            </button>
          ))}
        <h1 className="text-4xl font-heading font-black tracking-tight text-foreground break-words">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-base font-medium text-muted-foreground">{description}</p>
        )}
        {meta && <div className="text-sm font-medium text-muted-foreground">{meta}</div>}
        <SectionNav />
      </div>

      {highlight ? (
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm sm:min-w-72 shrink-0">
          <p className="text-xs font-bold text-muted-foreground">{highlight.label}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <p className="font-heading font-bold text-2xl leading-tight">{highlight.value}</p>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      ) : (
        actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </section>
  );
}
