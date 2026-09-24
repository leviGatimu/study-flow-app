import {
  Activity,
  BookOpen,
  BrainCircuit,
  Book,
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle,
  FileText,
  FolderKanban,
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
  Timer,
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
 * The whole app's navigation, in one place. Six sections, each named for what
 * the student is doing rather than for the tables behind it:
 *
 *   Today     what to do right now (the dashboard)
 *   Schedule  when things happen - the week, the month, and the two recurring
 *             timetables (study routine, school lessons) that fill them
 *   Subjects  what you study - each subject, and its homework, exams, files
 *   Study     doing the work - practice sets, focus sessions, notes, projects
 *   Progress  how it is going - insights, history, marks, goals, reports
 *   Settings  the account, and the academic year it is organised by
 *
 * A section's href IS its first page. There are no "overview" hub pages: a
 * hub that only links to its children is a page with nothing to do on it.
 * Every page is reachable from the sidebar, the section tabs under the header
 * and the command palette (Cmd+K), which indexes this list.
 */
export const NAV: NavSection[] = [
  {
    name: "Today",
    href: "/",
    icon: Home,
    keywords: "dashboard home focus tasks",
  },
  {
    name: "Schedule",
    href: "/timetable",
    icon: Calendar,
    children: [
      { name: "Week", href: "/timetable", icon: LayoutGrid, keywords: "this week schedule plan" },
      { name: "Month", href: "/calendar", icon: Calendar, keywords: "calendar month grid dates" },
      { name: "Study routine", href: "/manage", icon: Layers, keywords: "weekly timetable templates recurring manage schedule" },
      { name: "School lessons", href: "/school-timetable", icon: GraduationCap, keywords: "school timetable lessons classes school day upload photo" },
    ],
  },
  {
    name: "Subjects",
    href: "/subjects",
    icon: Library,
    children: [
      { name: "Subjects", href: "/subjects", icon: Library, keywords: "courses modules" },
      { name: "Homework", href: "/homeworks", icon: BookOpen, keywords: "assignments due" },
      { name: "Exams", href: "/exams", icon: GraduationCap, keywords: "assessments tests papers" },
      { name: "Resources", href: "/resources", icon: FolderOpen, keywords: "files links pdfs library" },
    ],
  },
  {
    name: "Study",
    href: "/ai",
    icon: Sparkles,
    children: [
      {
        name: "Practice",
        href: "/ai",
        icon: BrainCircuit,
        keywords: "ai study quiz flashcards mock exam generate questions pdf word document revision test me",
      },
      { name: "Focus", href: "/focus", icon: Timer, keywords: "focus mode timer pomodoro concentrate music" },
      { name: "Notes", href: "/notes", icon: StickyNote, keywords: "sticky notes scratch reminders" },
      { name: "Projects", href: "/projects", icon: FolderKanban, keywords: "coursework docs" },
      { name: "Calculator", href: "/calculator", icon: Calculator, keywords: "maths compute" },
      { name: "Bible", href: "/bible", icon: Book, keywords: "verse scripture" },
    ],
  },
  {
    name: "Progress",
    href: "/insights",
    icon: Activity,
    children: [
      { name: "Insights", href: "/insights", icon: Activity, keywords: "progress stats analytics charts attention" },
      { name: "History", href: "/history", icon: CheckCircle, keywords: "completed done log" },
      { name: "Marks", href: "/marks", icon: TrendingUp, keywords: "grades results report card" },
      { name: "Goals", href: "/goals", icon: Target, keywords: "targets" },
      { name: "Reports", href: "/summaries", icon: FileText, keywords: "daily summary weekly review report pdf" },
      { name: "Streak", href: "/streak", icon: Trophy, keywords: "consistency days xp level rank badges" },
    ],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { name: "Settings", href: "/settings", icon: Settings, keywords: "preferences account timezone ai keys sync" },
      { name: "Year & terms", href: "/year", icon: CalendarClock, keywords: "class term semester pause archive academic year" },
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
  // On a tie (a section's href is its first page's) the page wins, so the
  // header can name it.
  const best =
    matches.sort((a, b) => b.score - a.score || Number(!!b.leaf) - Number(!!a.leaf))[0] ?? null;

  if (!best) return null;
  const { section, leaf } = best;
  // A leaf that just repeats its section's name (Settings > Settings,
  // Subjects > Subjects) adds noise. A section's first page keeps its own name
  // ("Week" under Schedule), since that is what the tabs call it.
  const repeats = leaf && leaf.name === section.name;
  return { section, leaf: repeats ? undefined : leaf };
}

/** Page title for the header, falling back to a tidied path segment. */
export function pageTitle(pathname: string | null): string {
  const match = resolveNav(pathname);
  if (match) return match.leaf?.name ?? match.section.name;
  const segment = (pathname ?? "/").split("/").filter(Boolean)[0];
  if (!segment) return "Today";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}
