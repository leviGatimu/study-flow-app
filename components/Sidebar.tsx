"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  CheckCircle,
  Settings,
  FolderOpen,
  FileText,
  CalendarClock,
  LayoutGrid,
  LogOut,
  BrainCircuit,
  Zap,
  GraduationCap,
  Calculator,
  StickyNote,
  Brain,
  Layers,
  Sparkles,
  BookOpen,
  PanelLeftClose,
  Trophy,
  TrendingUp,
  Target,
  Book,
  Library,
  Activity,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { logoutUser } from "@/lib/actions";
import { RankBadge } from "./RankBadge";
import { UserProgress } from "@/lib/types";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { useSidebar } from "@/lib/SidebarContext";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function FadeIn({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

const groups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", href: "/", icon: Home },
      { name: "Subjects", href: "/subjects", icon: Library },
      { name: "Timetable", href: "/timetable", icon: LayoutGrid },
      { name: "Ranks", href: "/ranks", icon: Trophy },
      { name: "Marks", href: "/marks", icon: TrendingUp },
      { name: "Insights", href: "/insights", icon: Activity },
      { name: "Goals", href: "/goals", icon: Target },
      { name: "Calendar", href: "/calendar", icon: Calendar },
      { name: "History", href: "/history", icon: CheckCircle },
      { name: "Summaries", href: "/summaries", icon: FileText },
      { name: "Daily Summary", href: "/daily-summary", icon: CalendarClock },
    ]
  },
  {
    label: "Study Hub",
    items: [
      { name: "Exams", href: "/exams", icon: GraduationCap },
      { name: "Homeworks", href: "/homeworks", icon: BookOpen },
      {
        name: "AI",
        href: "#ai",
        icon: Sparkles,
        children: [
          { name: "AI Buddy", href: "/ai", icon: BrainCircuit },
          { name: "AI Tutor", href: "/tutor", icon: Brain },
        ],
      },
      { name: "Resources", href: "/resources", icon: Layers },
      { name: "Sticky Notes", href: "/notes", icon: StickyNote },
      { name: "AI-Notes", href: "/notes-ai", icon: Sparkles },
      { name: "Projects", href: "/projects", icon: FolderOpen },
      { name: "School", href: "/school", icon: GraduationCap },
      { name: "Bible", href: "/bible", icon: Book },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Focus Mode", href: "/focus", icon: Zap },
      { name: "Calculator", href: "/calculator", icon: Calculator },
      { name: "Manage", href: "/manage", icon: Layers },
      { name: "Settings", href: "/settings", icon: Settings },
    ]
  }
];

export function Sidebar({ userProgress }: { userProgress: UserProgress | null }) {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [isHovering, setIsHovering] = useState(false);

  if (['/login', '/register', '/welcome'].includes(pathname || '')) return null;

  // Pinned open -> always expanded. Pinned collapsed -> icon rail that
  // temporarily expands while the pointer is over it, then snaps back.
  const expanded = !isCollapsed || isHovering;

  return (
    <MotionConfig transition={{ duration: 0.45, ease: "easeInOut" }}>
    <motion.aside
      onMouseEnter={() => isCollapsed && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      animate={{ width: expanded ? 288 : 80 }}
      className={cn(
        "flex h-screen flex-col border-r bg-background shrink-0 z-50 overflow-hidden transition-shadow duration-300",
        isCollapsed ? "fixed inset-y-0 left-0" : "relative",
        isCollapsed && isHovering && "shadow-2xl"
      )}
      data-tour="sidebar"
    >
      {/* Brand Header */}
      <div className={cn("flex items-center", expanded ? "justify-between p-8" : "justify-center py-8")}>
        <Link
          href="/"
          className="flex items-center gap-3 transition-transform active:scale-95 group shrink-0"
        >
          <motion.div layout className="h-10 w-10 overflow-hidden rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-primary/20 transition-all shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </motion.div>
          <FadeIn show={expanded} className="font-heading font-black text-xl tracking-tight text-foreground whitespace-nowrap">
            Study Flow
          </FadeIn>
        </Link>
        <FadeIn show={expanded} className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground transition-all"
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        </FadeIn>
      </div>

      {/* Navigation Groups */}
      <div className={cn("flex-1 overflow-y-auto space-y-10 scrollbar-hide pb-10", expanded ? "px-6" : "px-3")}>
        {groups.map((group) => (
          <motion.div layout key={group.label} className="space-y-3">
            {expanded ? (
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-4">
                {group.label}
              </p>
            ) : (
              <div className="h-px w-6 bg-border/40 mx-auto" />
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                if (item.children) {
                  return <ExpandableNavItem key={item.name} item={item} pathname={pathname} expanded={expanded} />;
                }
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={`nav-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className={cn(!expanded && "flex justify-center")}
                  >
                    <motion.div
                      layout
                      className={cn(
                        "flex items-center rounded-2xl text-sm font-bold transition-all duration-300 active:scale-95 group/item whitespace-nowrap",
                        expanded ? "gap-4 px-4 py-3" : "h-11 w-11 justify-center",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-1",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-all duration-300 shrink-0",
                          isActive ? "text-primary-foreground scale-110" : "opacity-50 group-hover/item:text-primary group-hover/item:opacity-100 group-hover/item:scale-110",
                        )}
                      />
                      <FadeIn show={expanded}>{item.name}</FadeIn>
                      {expanded && isActive && (
                        <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_100px_rgba(255,255,255,0.8)]" />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        ))}
      </div>

      {/* Footer / Profile */}
      <div className="p-6 space-y-6">
        <AnimatePresence>
          {userProgress && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: { delay: 0.15, duration: 0.2 } }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.08 } }}
              className="px-2 overflow-hidden"
            >
              <Link href="/ranks" className="block hover:scale-[1.02] active:scale-95 transition-transform duration-300">
                <RankBadge level={userProgress.level} xp={userProgress.xp} showProgress={true} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <form action={logoutUser}>
          <Button
            variant="ghost"
            type="submit"
            className={cn(
              "w-full rounded-2xl text-sm font-black text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-all active:scale-95 group",
              expanded ? "justify-start gap-4 px-4 py-6" : "justify-center px-0 py-6"
            )}
          >
            <div className="h-8 w-8 rounded-xl bg-destructive/5 group-hover:bg-destructive/10 transition-colors flex items-center justify-center shrink-0">
              <LogOut className="h-4 w-4 opacity-70" />
            </div>
            <FadeIn show={expanded}>Logout</FadeIn>
          </Button>
        </form>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.aside>
    </MotionConfig>
  );
}

function ExpandableNavItem({ item, pathname, expanded }: { item: NavItem; pathname: string; expanded: boolean }) {
  const Icon = item.icon;
  const children = item.children || [];
  const childActive = children.some((c) => pathname === c.href || pathname.startsWith(c.href));
  const [open, setOpen] = useState(childActive);

  // Keep it open while a child route is active; otherwise collapse on mouse-out.
  useEffect(() => { setOpen(childActive); }, [childActive]);

  if (!expanded) {
    return (
      <div className="flex justify-center" data-tour="nav-ai-buddy">
        <div
          className={cn(
            "flex items-center justify-center h-11 w-11 rounded-2xl transition-all",
            childActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
          )}
        >
          <Icon className={cn("h-4 w-4", childActive ? "text-primary scale-110" : "opacity-50")} />
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(childActive)}
      data-tour="nav-ai-buddy"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-300 active:scale-95 group/item",
          childActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0 transition-all", childActive ? "text-primary scale-110" : "opacity-50 group-hover/item:opacity-100 group-hover/item:text-primary")} />
        <span>{item.name}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-1 space-y-1 border-l border-border/40 pl-3">
              {children.map((c) => {
                const Ci = c.icon;
                const active = pathname === c.href || pathname.startsWith(c.href);
                return (
                  <Link key={c.href} href={c.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95 group/sub",
                        active
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-0.5"
                      )}
                    >
                      <Ci className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "opacity-50 group-hover/sub:opacity-100")} />
                      <span>{c.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
