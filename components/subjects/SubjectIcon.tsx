import {
  Atom,
  BookMarked,
  BookOpen,
  Briefcase,
  Calculator,
  ChartLine,
  Church,
  CodeXml,
  Cpu,
  Database,
  Dna,
  Dumbbell,
  FileBarChart,
  FlaskConical,
  Globe2,
  HeartPulse,
  Landmark,
  Languages,
  LayoutTemplate,
  type LucideIcon,
  Monitor,
  Music,
  Network,
  Palette,
  PenLine,
  Users,
  Wrench,
} from "lucide-react";

import { subjectLook, type SubjectIconKey, type SubjectTone } from "@/lib/subject-look";
import { cn } from "@/lib/utils";

const ICONS: Record<SubjectIconKey, LucideIcon> = {
  math: Calculator,
  code: CodeXml,
  web: LayoutTemplate,
  database: Database,
  network: Network,
  chip: Cpu,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Dna,
  health: HeartPulse,
  english: PenLine,
  language: Languages,
  literature: BookMarked,
  history: Landmark,
  geography: Globe2,
  business: Briefcase,
  economics: ChartLine,
  engineering: Wrench,
  art: Palette,
  music: Music,
  religion: Church,
  sport: Dumbbell,
  social: Users,
  computer: Monitor,
  report: FileBarChart,
  book: BookOpen,
};

/**
 * Every class is written out in full so Tailwind sees it. `tile` is the
 * pastel block, `ink` the icon/accent colour on it, `soft` a lighter wash for
 * chips, `ring` the progress-ring stroke.
 */
export const TONE_CLASSES: Record<SubjectTone, { tile: string; ink: string; soft: string; ring: string; bar: string }> = {
  violet: { tile: "bg-violet-200/80 dark:bg-violet-500/20", ink: "text-violet-900 dark:text-violet-200", soft: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200", ring: "stroke-violet-500 dark:stroke-violet-300", bar: "bg-violet-500 dark:bg-violet-300" },
  rose: { tile: "bg-rose-200/80 dark:bg-rose-500/20", ink: "text-rose-900 dark:text-rose-200", soft: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200", ring: "stroke-rose-500 dark:stroke-rose-300", bar: "bg-rose-500 dark:bg-rose-300" },
  amber: { tile: "bg-amber-200/80 dark:bg-amber-500/20", ink: "text-amber-900 dark:text-amber-200", soft: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200", ring: "stroke-amber-500 dark:stroke-amber-300", bar: "bg-amber-500 dark:bg-amber-300" },
  emerald: { tile: "bg-emerald-200/80 dark:bg-emerald-500/20", ink: "text-emerald-900 dark:text-emerald-200", soft: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", ring: "stroke-emerald-500 dark:stroke-emerald-300", bar: "bg-emerald-500 dark:bg-emerald-300" },
  sky: { tile: "bg-sky-200/80 dark:bg-sky-500/20", ink: "text-sky-900 dark:text-sky-200", soft: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", ring: "stroke-sky-500 dark:stroke-sky-300", bar: "bg-sky-500 dark:bg-sky-300" },
  teal: { tile: "bg-teal-200/80 dark:bg-teal-500/20", ink: "text-teal-900 dark:text-teal-200", soft: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200", ring: "stroke-teal-500 dark:stroke-teal-300", bar: "bg-teal-500 dark:bg-teal-300" },
  pink: { tile: "bg-pink-200/80 dark:bg-pink-500/20", ink: "text-pink-900 dark:text-pink-200", soft: "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-200", ring: "stroke-pink-500 dark:stroke-pink-300", bar: "bg-pink-500 dark:bg-pink-300" },
  indigo: { tile: "bg-indigo-200/80 dark:bg-indigo-500/20", ink: "text-indigo-900 dark:text-indigo-200", soft: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200", ring: "stroke-indigo-500 dark:stroke-indigo-300", bar: "bg-indigo-500 dark:bg-indigo-300" },
};

export function subjectStyle(name: string) {
  const { icon, tone } = subjectLook(name);
  return { Icon: ICONS[icon], tone, classes: TONE_CLASSES[tone] };
}

/** The subject's icon on its pastel tile. Size it with className (e.g. "size-12"). */
export function SubjectIcon({ name, className, iconClassName }: { name: string; className?: string; iconClassName?: string }) {
  const { Icon, classes } = subjectStyle(name);
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-xl", classes.tile, classes.ink, className)}>
      <Icon className={cn("size-1/2", iconClassName)} strokeWidth={1.75} />
    </span>
  );
}
