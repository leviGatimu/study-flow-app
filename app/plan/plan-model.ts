import { differenceInCalendarDays, format } from 'date-fns';

/**
 * The Plan hub's data, as plain serializable values.
 *
 * The server page gathers rows; this file turns them into what the hub shows.
 * Kept free of Prisma and server imports so the presentational component - and
 * the /welcome harness that renders it with fake data - depend only on these
 * shapes.
 *
 * Dates travel as "yyyy-MM-dd" day keys, never Date objects: the page is about
 * calendar days, and a key cannot drift across a timezone the way an instant
 * serialised to ISO can.
 */

export type AgendaTaskSummary = {
  total: number;
  done: number;
  missed: number;
  /** Distinct subjects in start-time order, for a one-line preview. */
  subjects: string[];
  /** Earliest start time that day, "HH:MM". */
  firstStart: string | null;
};

export type AgendaHomework = { id: string; subject: string; title: string };

export type AgendaExam = {
  id: string;
  title: string;
  kind: string;
  startTime: string | null;
};

export type AgendaDay = {
  dateKey: string;
  tasks: AgendaTaskSummary;
  homework: AgendaHomework[];
  exams: AgendaExam[];
};

export type YearFact = {
  /** e.g. "Term 1" or "Paused". */
  value: string;
  /** e.g. "38 days left" or "Start the next term in Year & Terms". */
  detail: string;
};

export type PlanHubData = {
  todayKey: string;
  isArchive: boolean;
  calendar: {
    monthLabel: string;
    monthBlocks: number;
    monthExams: number;
    nextExam: { id: string; title: string; dateKey: string } | null;
  };
  week: { done: number; total: number };
  timetable: { blocks: number; days: number };
  year: YearFact;
  agenda: AgendaDay[];
  /** The oldest few, for display. */
  overdueHomework: (AgendaHomework & { dateKey: string })[];
  overdueCount: number;
};

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** A day key back to a local-midnight Date, for formatting only. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

type TaskRow = { date: Date; isDone: boolean; isMissed: boolean; subject: string; startTime: string };
type HomeworkRow = { id: string; subject: string; title: string; dueDate: Date };
type ExamRow = { id: string; title: string; kind: string; startTime: string | null; date: Date };

/**
 * One entry per day for `days` days from `todayKey`, merging the three kinds
 * of dated work. Rows outside the window are ignored, so callers can pass a
 * wider query result (the week query overlaps the agenda window).
 */
export function buildAgenda(
  todayKey: string,
  days: number,
  tasks: TaskRow[],
  homework: HomeworkRow[],
  exams: ExamRow[]
): AgendaDay[] {
  const start = fromDayKey(todayKey);
  const byKey = new Map<string, AgendaDay>();
  const order: string[] = [];

  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    order.push(key);
    byKey.set(key, {
      dateKey: key,
      tasks: { total: 0, done: 0, missed: 0, subjects: [], firstStart: null },
      homework: [],
      exams: [],
    });
  }

  const sortedTasks = [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const t of sortedTasks) {
    const day = byKey.get(dayKey(t.date));
    if (!day) continue;
    day.tasks.total++;
    if (t.isDone) day.tasks.done++;
    else if (t.isMissed) day.tasks.missed++;
    if (!day.tasks.subjects.includes(t.subject)) day.tasks.subjects.push(t.subject);
    day.tasks.firstStart ??= t.startTime;
  }

  for (const h of homework) {
    byKey.get(dayKey(h.dueDate))?.homework.push({ id: h.id, subject: h.subject, title: h.title });
  }

  const sortedExams = [...exams].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  for (const e of sortedExams) {
    byKey.get(dayKey(e.date))?.exams.push({ id: e.id, title: e.title, kind: e.kind, startTime: e.startTime });
  }

  return order.map((k) => byKey.get(k)!);
}

type ScheduleFacts = {
  reason: 'RUNNING' | 'PAUSED' | 'TERM_NOT_STARTED' | 'BETWEEN_TERMS' | 'CLASS_COMPLETE' | 'NO_CLASS';
  classLabel: string | null;
  termName: string | null;
  termStartDate: Date | null;
  termEndDate: Date | null;
  nextTerm: { name: string; startDate: Date | null } | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The Year & Terms tile's one fact: which term, and how long it has left. */
export function yearFact(
  schedule: ScheduleFacts | null,
  today: Date,
  archive: { isArchive: boolean; label: string | null }
): YearFact {
  if (archive.isArchive) {
    return { value: archive.label ?? 'Past year', detail: 'Viewing an archived year (read-only)' };
  }
  if (!schedule || schedule.reason === 'NO_CLASS') {
    return { value: 'Not set up', detail: 'Add your academic year and terms' };
  }

  const term = schedule.termName ?? 'Current term';
  const cls = schedule.classLabel ? ` · ${schedule.classLabel}` : '';

  switch (schedule.reason) {
    case 'PAUSED':
      return { value: `${term} · paused`, detail: `Schedule paused${cls}` };
    case 'TERM_NOT_STARTED': {
      const days = schedule.termStartDate ? differenceInCalendarDays(schedule.termStartDate, today) : null;
      return {
        value: term,
        detail: days !== null && days > 0 ? `Starts in ${plural(days, 'day')}` : `Not started yet${cls}`,
      };
    }
    case 'BETWEEN_TERMS': {
      const next = schedule.nextTerm;
      const days = next?.startDate ? differenceInCalendarDays(next.startDate, today) : null;
      return {
        value: 'Between terms',
        detail: next
          ? `${next.name}${days !== null && days > 0 ? ` starts in ${plural(days, 'day')}` : ' is ready to start'}`
          : `No next term queued${cls}`,
      };
    }
    case 'CLASS_COMPLETE':
      return { value: 'Year complete', detail: 'Start a new academic year' };
    case 'RUNNING': {
      if (!schedule.termEndDate) return { value: term, detail: `No end date set${cls}` };
      const left = differenceInCalendarDays(schedule.termEndDate, today);
      return {
        value: term,
        detail: left > 0 ? `${plural(left, 'day')} left${cls}` : left === 0 ? 'Ends today' : 'Past its end date',
      };
    }
  }
}
