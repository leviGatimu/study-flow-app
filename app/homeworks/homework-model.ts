import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Homework as the list sees it: plain, serializable, with every date already
 * reduced to a calendar day ("yyyy-MM-dd") in the user's timezone on the
 * server. The client never decides what day a timestamp falls on, so the
 * grouping is the same during SSR and hydration and on any device clock.
 */
export type HomeworkItem = {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  dueDay: string;
  plannedDay: string | null;
  isCompleted: boolean;
  completedDay: string | null;
  /** ISO timestamp, only used to order the Done list newest first. */
  completedAt: string | null;
  proofUrl: string | null;
};

export type SubjectChip = { name: string; open: number; active: boolean };

export type UrgencyGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export const GROUP_ORDER: { key: UrgencyGroup; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
];

/** Days from `today` to `day`; negative when `day` is in the past. */
export function daysUntil(day: string, today: string): number {
  return differenceInCalendarDays(parseISO(day), parseISO(today));
}

export function urgencyOf(dueDay: string, today: string): UrgencyGroup {
  const d = daysUntil(dueDay, today);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 7) return 'week';
  return 'later';
}

/** "2 days late", "Today", "Tomorrow", "Fri 26 Sep" (year added when it differs). */
export function relativeDue(dueDay: string, today: string): string {
  const d = daysUntil(dueDay, today);
  if (d < -1) return `${-d} days late`;
  if (d === -1) return '1 day late';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return formatDay(dueDay, today);
}

export function formatDay(day: string, today: string): string {
  const date = parseISO(day);
  return date.getFullYear() === parseISO(today).getFullYear()
    ? format(date, 'EEE d MMM')
    : format(date, 'EEE d MMM yyyy');
}

export function isWithinNextWeek(dueDay: string, today: string): boolean {
  const d = daysUntil(dueDay, today);
  return d >= 0 && d <= 7;
}

// Full class names so Tailwind sees them. Colours are handed out in the
// order of the page's sorted subject list, so up to ten subjects never share
// one, and a subject keeps its colour in the chips and in every row.
const SUBJECT_DOTS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-lime-500',
  'bg-orange-500',
  'bg-indigo-500',
];

export function subjectDots(sortedSubjects: string[]): (subject: string) => string {
  const bySubject = new Map(sortedSubjects.map((s, i) => [s, SUBJECT_DOTS[i % SUBJECT_DOTS.length]]));
  return (subject) => bySubject.get(subject) ?? 'bg-muted-foreground';
}
