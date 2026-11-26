import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { markBand, type BlockStatus } from "@/lib/mentor-model";
import { Page, PageBody } from "@/components/ui/page";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

/**
 * The building blocks of the mentor pages, made from the app's own parts:
 * Page/PageBody, the PageHeader layout, Panel, PanelTitle and Stat. Pages fill
 * the window up to 1600px like every other page and lay cards out on a grid.
 */

export function MentorPage({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageBody className="space-y-6">{children}</PageBody>
    </Page>
  );
}

/**
 * components/ui/page-header.tsx's layout (big font-black title, muted line,
 * actions on the right), without the student's section pills. It sits first
 * in PageBody and reaches out to the page edges, as PageHeader does.
 */
export function MentorHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="-mx-4 -mt-8 flex flex-col justify-between gap-6 border-b border-border/40 px-4 pb-6 pt-10 md:-mx-8 md:px-8 xl:flex-row xl:items-center">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-bold text-primary/80">{eyebrow}</p>
        <h1 className="break-words font-heading text-4xl font-black tracking-tight text-foreground">{title}</h1>
        {description && <p className="max-w-3xl text-base font-medium text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <Panel className={cn("min-w-0", className)}>{children}</Panel>;
}

export function CardHead({
  title,
  hint,
  icon,
  href,
  linkLabel = "See all",
  right,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  right?: React.ReactNode;
}) {
  const action =
    right || href ? (
      <>
        {right}
        {href && (
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href={href}>
              {linkLabel}
              <ChevronRight />
            </Link>
          </Button>
        )}
      </>
    ) : undefined;
  return (
    <div className="mb-5">
      <PanelTitle icon={icon} tone={icon ? "primary" : undefined} action={action} className="mb-0">
        {title}
      </PanelTitle>
      {hint && <p className={cn("mt-1 text-sm font-medium text-muted-foreground", icon && "pl-[52px]")}>{hint}</p>}
    </div>
  );
}

/** A headline number: the app's Stat in a Panel, with an optional change chip. */
export function Kpi({
  label,
  value,
  sub,
  change,
  icon,
  tone = "accent",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  change?: { text: string; up: boolean | null } | null;
  icon?: React.ReactNode;
  tone?: "accent" | "primary" | "warn" | "missed";
}) {
  const statTone = ({ accent: "default", primary: "default", warn: "warning", missed: "danger" } as const)[tone];
  return (
    <Panel className="min-w-0 p-5">
      <Stat
        label={label}
        icon={icon}
        // Only a plain number counts up; "7h 45m" or "7/10" would count oddly.
        value={typeof value === "number" || /^[\d.,]+%?$/.test(String(value)) ? value : <span>{value}</span>}
        tone={statTone}
        hint={
          change || sub ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {change && <Change change={change} />}
              {sub && <span>{sub}</span>}
            </span>
          ) : undefined
        }
      />
    </Panel>
  );
}

export function Change({ change }: { change: { text: string; up: boolean | null } }) {
  const Icon = change.up === null ? Minus : change.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
        change.up === null ? "bg-muted text-muted-foreground" : change.up ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {change.text}
    </span>
  );
}

/** A thin bar showing a share, 0-100. */
export function Meter({ value, tone = "accent", className }: { value: number | null; tone?: "accent" | "missed" | "warn" | "primary"; className?: string }) {
  const fill = { accent: "bg-[var(--m-accent)]", missed: "bg-[var(--m-missed)]", warn: "bg-[var(--m-warn)]", primary: "bg-primary" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--m-planned)]", className)} aria-hidden>
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </div>
  );
}

/** A big ring for one percentage. */
export function Ring({ value, size = 120, label }: { value: number | null; size?: number; label?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Completion"}: ${value === null ? "nothing due" : `${v}%`}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--m-planned)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--m-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold tabular-nums text-foreground">{value === null ? "–" : `${v}%`}</span>
        {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

const STATUS = {
  done: { label: "Done", className: "bg-[var(--m-accent)]/12 text-[var(--m-accent)]", dot: "bg-[var(--m-accent)]" },
  missed: { label: "Missed", className: "bg-[var(--m-missed)]/12 text-[var(--m-missed)]", dot: "bg-[var(--m-missed)]" },
  today: { label: "Today", className: "bg-[var(--m-warn)]/14 text-[var(--m-warn)]", dot: "bg-[var(--m-warn)]" },
  upcoming: { label: "Coming up", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
} as const;

export function StatusPill({ status }: { status: BlockStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export function statusBorder(status: BlockStatus): string {
  return {
    done: "border-l-[var(--m-accent)]",
    missed: "border-l-[var(--m-missed)]",
    today: "border-l-[var(--m-warn)]",
    upcoming: "border-l-border",
  }[status];
}

/** A mark as a coloured percentage chip. */
export function MarkChip({ percent, className }: { percent: number; className?: string }) {
  const band = markBand(percent);
  const tone = {
    great: "bg-success/12 text-success",
    good: "bg-primary/10 text-primary",
    fair: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
    low: "bg-destructive/10 text-destructive",
  }[band];
  return <span className={cn("inline-flex items-center rounded-lg px-2 py-0.5 font-heading text-sm font-bold tabular-nums", tone, className)}>{percent}%</span>;
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-5" aria-hidden>{icon}</span>}
      <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
      {children && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** The app's tab pills (ScheduleFrame), switching a page's view through the URL. */
export function Segmented({ options, value }: { options: { label: string; href: string; value: string }[]; value: string }) {
  return (
    <nav className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          scroll={false}
          aria-current={o.value === value ? "page" : undefined}
          className={cn(
            "flex h-7 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
            o.value === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** A small key for status colours. */
export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", i.className)} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}
