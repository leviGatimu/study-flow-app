"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
  History,
  Home,
  Library,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { logoutUser } from "@/lib/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MENTOR_NAV: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Overview", href: "/mentor", icon: Home },
  { name: "Week", href: "/mentor/schedule", icon: CalendarDays },
  { name: "Study log", href: "/mentor/log", icon: History },
  { name: "Reports", href: "/mentor/reports", icon: FileText },
  { name: "Subjects", href: "/mentor/subjects", icon: Library },
  { name: "Marks & exams", href: "/mentor/marks", icon: GraduationCap },
  { name: "Homework", href: "/mentor/homework", icon: ClipboardList },
];

type Props = {
  children: React.ReactNode;
  studentName: string;
  studentLine: string;
  mentorName: string;
  avatarUrl: string | null;
  lastSeen: string;
  online: boolean;
};

const isActive = (pathname: string, href: string) =>
  href === "/mentor" ? pathname === "/mentor" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The mentor's frame, built like the student's AppShell (components/Sidebar.tsx
 * and AppHeader.tsx): the same icon rail that opens on hover, the same header
 * strip, and the page in one rounded panel. Only the links differ - they lead
 * to the mentor's own pages - and the header says whose Study Flow this is.
 */
export function MentorShell({ children, studentName, studentLine, mentorName, avatarUrl, lastSeen, online }: Props) {
  const pathname = usePathname() ?? "/mentor";

  return (
    <div className="mentor flex h-full w-full">
      <Rail pathname={pathname} />

      <div className="flex min-w-0 flex-1 flex-col bg-sidebar">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 md:border-b-0">
          <Avatar name={studentName} url={avatarUrl} online={online} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold text-foreground">{studentName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {studentLine} · {online ? "online now" : `last in ${lastSeen.toLowerCase()}`}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">
            <Eye className="size-3.5" aria-hidden />
            Mentor view · read only
          </span>
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <ThemeToggle />
          <form action={logoutUser}>
            <Button type="submit" variant="outline" size="sm" title={`Signed in as ${mentorName}`}>
              <LogOut /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </header>

        {/* Phones: the mentor pages as the app's tab pills. */}
        <nav aria-label="Mentor pages" className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-sidebar px-3 py-2 md:hidden">
          {MENTOR_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <main className="app-scroll flex-1 overflow-y-auto bg-background md:rounded-tl-3xl md:border-l md:border-t md:border-border">{children}</main>
      </div>
    </div>
  );
}

/** components/Sidebar.tsx's rail, with the mentor's pages. */
function Rail({ pathname }: { pathname: string }) {
  return (
    <aside className="group/sidebar relative z-40 hidden w-[72px] shrink-0 md:block">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-y-0 left-[72px] right-0 bg-black/0 backdrop-blur-0 transition-[background-color,backdrop-filter] duration-300",
          "group-hover/sidebar:bg-black/[0.06] group-hover/sidebar:backdrop-blur-[2px] dark:group-hover/sidebar:bg-black/30",
          "group-focus-within/sidebar:bg-black/[0.06] dark:group-focus-within/sidebar:bg-black/30",
          "motion-reduce:backdrop-blur-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-hidden rounded-r-none border-r border-transparent bg-sidebar",
          "transition-[width,box-shadow,border-radius,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "group-hover/sidebar:w-60 group-hover/sidebar:rounded-r-3xl group-hover/sidebar:border-sidebar-border group-hover/sidebar:shadow-[12px_0_40px_-12px_rgb(0_0_0/0.35)]",
          "group-focus-within/sidebar:w-60 group-focus-within/sidebar:rounded-r-3xl group-focus-within/sidebar:border-sidebar-border group-focus-within/sidebar:shadow-[12px_0_40px_-12px_rgb(0_0_0/0.35)]"
        )}
      >
        <Link href="/mentor" aria-label="Mentor overview" className="flex h-16 shrink-0 items-center gap-3 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50">
          <Image src="/logo.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover shadow-md shadow-black/25 ring-1 ring-foreground/10" />
          <Label className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-foreground">Study Flow</span>
            <span className="block text-[11px] font-medium text-muted-foreground">Mentor view</span>
          </Label>
        </Link>

        <nav aria-label="Mentor pages" className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {MENTOR_NAV.map((item, i) => (
              <li key={item.href} style={{ ["--i" as string]: i + 1 }}>
                <RailLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "block whitespace-nowrap opacity-0 -translate-x-2 blur-[3px] transition-[opacity,translate,filter] duration-100",
        "group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-hover/sidebar:blur-none group-hover/sidebar:duration-300",
        "group-hover/sidebar:[transition-delay:calc(60ms+var(--i,0)*28ms)]",
        "group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100 group-focus-within/sidebar:blur-none",
        "motion-reduce:translate-x-0 motion-reduce:blur-none",
        className
      )}
    >
      {children}
    </span>
  );
}

function RailLink({ item, active }: { item: (typeof MENTOR_NAV)[number]; active: boolean }) {
  const Icon = item.icon;
  const reduceMotion = useReducedMotion();
  return (
    <Link
      href={item.href}
      aria-label={item.name}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/link relative flex h-12 shrink-0 items-center gap-2 rounded-xl transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "text-foreground group-hover/sidebar:bg-primary/10" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="mentor-active-marker"
          aria-hidden
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
          className="absolute -left-3 top-3 h-6 w-[3px] rounded-r-full bg-primary"
        />
      )}
      <span className="flex size-12 shrink-0 items-center justify-center">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition-all duration-150",
            active
              ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary),inset_0_1px_0_rgb(255_255_255/0.25)]"
              : "group-hover/link:bg-foreground/[0.06]"
          )}
        >
          <Icon className="size-[19px]" strokeWidth={active ? 2 : 1.75} />
        </span>
      </span>
      <Label className={cn("text-sm", active ? "font-semibold" : "font-medium")}>{item.name}</Label>
    </Link>
  );
}

function Avatar({ name, url, online }: { name: string; url: string | null; online: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="relative size-10 shrink-0">
      {url ? (
        // A private upload served through the session-checked route; next/image would cache it publicly.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full rounded-xl object-cover ring-1 ring-foreground/10" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-xl bg-primary font-heading text-sm font-bold text-primary-foreground">{initials || "S"}</span>
      )}
      {online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-success" aria-hidden />}
    </span>
  );
}
