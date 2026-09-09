import {
  Activity,
  BookOpen,
  Brain,
  BrainCircuit,
  Book,
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  Layers,
  LayoutGrid,
  Library,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Trophy,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavLeaf = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Extra words the command palette should match on. */
  keywords?: string;
};

export type NavSection = NavLeaf & {
  children?: NavLeaf[];
};

/**
 * The whole app's navigation, in one place.
 *
 * Six destinations, not twenty-seven. Nothing was deleted — every route that
 * used to sit in the sidebar is still here, one level down, and the command
 * palette (Cmd+K) reaches all of them directly. The sidebar's job is to answer
 * "where am I and where can I go", not to list every feature that exists.
 */
export const NAV: NavSection[] = [
  {
    name: "Today",
    href: "/",
    icon: Home,
    keywords: "dashboard home focus tasks",
  },
  {
    name: "Plan",
    href: "/calendar",
    icon: Calendar,
    children: [
      { name: "Calendar", href: "/calendar", icon: Calendar, keywords: "month grid dates" },
      { name: "This Week", href: "/timetable", icon: LayoutGrid, keywords: "week schedule" },
      { name: "Weekly Timetable", href: "/manage", icon: Layers, keywords: "templates recurring manage schedule" },
      { name: "Year & Terms", href: "/year", icon: GraduationCap, keywords: "class term semester pause archive academic year" },
    ],
  },
  {
    name: "Subjects",
    href: "/subjects",
    icon: Library,
    children: [
      { name: "All Subjects", href: "/subjects", icon: Library, keywords: "courses modules" },
      { name: "Exams", href: "/exams", icon: GraduationCap, keywords: "assessments tests papers" },
      { name: "Homework", href: "/homeworks", icon: BookOpen, keywords: "assignments due" },
      { name: "Resources", href: "/resources", icon: Layers, keywords: "files links pdfs" },
    ],
  },
  {
    name: "Progress",
    href: "/insights",
    icon: Activity,
    children: [
      { name: "Insights", href: "/insights", icon: Activity, keywords: "stats analytics charts" },
      { name: "History", href: "/history", icon: CheckCircle, keywords: "completed done log" },
      { name: "Marks", href: "/marks", icon: TrendingUp, keywords: "grades results report card" },
      { name: "Goals", href: "/goals", icon: Target, keywords: "targets" },
      { name: "Summaries", href: "/summaries", icon: FileText, keywords: "weekly review" },
      { name: "Daily Summary", href: "/daily-summary", icon: CalendarClock, keywords: "day review" },
      { name: "Streak", href: "/streak", icon: Trophy, keywords: "consistency days" },
      { name: "Ranks", href: "/ranks", icon: Trophy, keywords: "xp level badges" },
    ],
  },
  {
    name: "Study",
    href: "/ai",
    icon: Sparkles,
    children: [
      { name: "AI Buddy", href: "/ai", icon: BrainCircuit, keywords: "chat assistant ask" },
      { name: "AI Tutor", href: "/tutor", icon: Brain, keywords: "quiz flashcards modules revision" },
      { name: "AI Notes", href: "/notes-ai", icon: Sparkles, keywords: "generate summarise pdf" },
      { name: "Sticky Notes", href: "/notes", icon: StickyNote, keywords: "scratch reminders" },
      { name: "Projects", href: "/projects", icon: FolderOpen, keywords: "coursework docs" },
      { name: "Calculator", href: "/calculator", icon: Calculator, keywords: "maths compute" },
      { name: "Bible", href: "/bible", icon: Book, keywords: "verse scripture" },
    ],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { name: "Settings", href: "/settings", icon: Settings, keywords: "preferences account timezone ai keys" },
      { name: "School Timetable", href: "/school-timetable", icon: GraduationCap, keywords: "lessons classes school day upload photo" },
    ],
  },
];

/** Flattened list of every reachable destination, for the command palette. */
export const NAV_LEAVES: NavLeaf[] = NAV.flatMap((section) =>
  section.children?.length ? section.children : [section]
);

/** Routes that render without app chrome (no header, no sidebar). */
export const BARE_ROUTES = ["/login", "/register", "/welcome", "/setup"];

export function isBareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return BARE_ROUTES.includes(pathname) || pathname.startsWith("/focus/widget");
}

/**
 * Resolve the header's breadcrumb for a path: the top-level destination it
 * belongs to, plus the specific page within it when they differ.
 * Longest-prefix wins so /projects/abc resolves to Projects, not Study.
 */
export function resolveNav(pathname: string | null): {
  section: NavSection;
  leaf?: NavLeaf;
} | null {
  if (!pathname) return null;

  type Match = { section: NavSection; leaf?: NavLeaf; score: number };
  const matches: Match[] = [];

  const matchesHref = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  for (const section of NAV) {
    if (matchesHref(section.href)) {
      matches.push({ section, leaf: undefined, score: section.href.length });
    }
    for (const child of section.children ?? []) {
      if (matchesHref(child.href)) {
        matches.push({ section, leaf: child, score: child.href.length });
      }
    }
  }

  // Longest matching href wins, so /projects/abc resolves to Projects.
  const best = matches.sort((a, b) => b.score - a.score)[0] ?? null;

  if (!best) return null;
  const { section, leaf } = best;
  // A leaf that just repeats its section (e.g. Settings > Settings) adds noise.
  return { section, leaf: leaf && leaf.name !== section.name ? leaf : undefined };
}

/** Page title for the header, falling back to a tidied path segment. */
export function pageTitle(pathname: string | null): string {
  const match = resolveNav(pathname);
  if (match) return match.leaf?.name ?? match.section.name;
  const segment = (pathname ?? "/").split("/").filter(Boolean)[0];
  if (!segment) return "Today";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}
