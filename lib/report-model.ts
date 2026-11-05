/**
 * One report as both the Reports page and its PDF show it.
 *
 * Built from the enriched daily and weekly summaries (lib/actions.ts) plus the
 * homework finished in the period. Pure, with plain fields only, so the page,
 * the PDF renderer (lib/report-pdf.ts) and the tests all read the same thing.
 */

export type ReportKind = 'daily' | 'weekly';

export type ReportBlock = { subject: string; start: string; end: string; done: boolean };
export type ReportBar = { label: string; minutes: number };

export type ReportData = {
  kind: ReportKind;
  id: string;
  /** "yyyy-MM-dd" of the day, or of the week's Monday. */
  key: string;
  /** "Thursday 5 November 2026" / "2 – 8 November 2026". */
  title: string;
  /** "Thu 5 Nov" / "2 – 8 Nov", for the list. */
  shortTitle: string;
  /** "Daily report 2026-11-05.pdf": also the file's name in Resources. */
  fileName: string;
  grade: string;
  score: number;
  /** Grade colour as hex, for the PDF and the grade badge. */
  color: string;
  level: string;
  feedback: string;
  detail: string;
  plannedMinutes: number;
  doneMinutes: number;
  blocksDone: number;
  blocksTotal: number;
  streak: number;
  /** Mean done minutes of the earlier reports in the comparison window; null without any. */
  averageMinutes: number | null;
  /** "your last 7 days" / "your last 4 weeks". */
  averageLabel: string;
  /** Daily: each block, in time order. Weekly: empty. */
  blocks: ReportBlock[];
  /** Weekly: Monday to Sunday. Daily: empty. */
  days: ReportBar[];
  /** Planned minutes per subject, largest first. */
  subjects: ReportBar[];
  homework: { title: string; subject: string }[];
  strengths: string[];
  next: string[];
};

type Performance = {
  score: number;
  grade: string;
  level: string;
  feedback: string;
  detail: string;
  strengths: string[];
  improvements: string[];
  theme: { hex: string };
};

export type DailyInput = {
  id: string;
  /** "yyyy-MM-dd". */
  key: string;
  performance: Performance;
  totalMinutes: number;
  completedMinutes: number;
  subjectBreakdown: string;
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
  tasks: { subject: string; startTime: string; endTime: string; isDone: boolean }[];
};

export type WeeklyInput = {
  id: string;
  /** "yyyy-MM-dd" of the first and last day. */
  startKey: string;
  endKey: string;
  performance: Performance;
  totalMinutes: number;
  completedMinutes: number;
  subjectBreakdown: string;
  dailyMinutes: number[];
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parts(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function longDay(key: string): string {
  const p = parts(key);
  return `${DAYS[p.weekday]} ${p.d} ${MONTHS[p.m]} ${p.y}`;
}

export function shortDay(key: string): string {
  const p = parts(key);
  return `${DAYS[p.weekday].slice(0, 3)} ${p.d} ${MONTHS[p.m].slice(0, 3)}`;
}

function range(startKey: string, endKey: string, short: boolean): string {
  const a = parts(startKey);
  const b = parts(endKey);
  const month = (m: number) => (short ? MONTHS[m].slice(0, 3) : MONTHS[m]);
  const left = a.m === b.m ? `${a.d}` : `${a.d} ${month(a.m)}`;
  return `${left} – ${b.d} ${month(b.m)}${short ? '' : ` ${b.y}`}`;
}

export function parseBreakdown(json: string): ReportBar[] {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json) ?? {};
  } catch {
    raw = {};
  }
  return Object.entries(raw)
    .map(([label, value]) => ({ label, minutes: Math.round(Number(value)) }))
    .filter((b) => Number.isFinite(b.minutes) && b.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** Mean of the values, or null for none. */
function mean(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

/**
 * Daily reports, newest first. Each is compared with up to 7 earlier reports
 * in the same list (days without a report are days with nothing planned).
 */
export function dailyReports(
  days: DailyInput[],
  homeworkByDay: Map<string, { title: string; subject: string }[]> = new Map()
): ReportData[] {
  return days.map((s, i) => ({
    kind: 'daily',
    id: s.id,
    key: s.key,
    title: longDay(s.key),
    shortTitle: shortDay(s.key),
    fileName: `Daily report ${s.key}.pdf`,
    grade: s.performance.grade,
    score: s.performance.score,
    color: s.performance.theme.hex,
    level: s.performance.level,
    feedback: s.performance.feedback,
    detail: s.performance.detail,
    plannedMinutes: s.totalMinutes,
    doneMinutes: s.completedMinutes,
    blocksDone: s.completedSessions,
    blocksTotal: s.totalSessions,
    streak: s.currentStreak,
    averageMinutes: mean(days.slice(i + 1, i + 8).map((d) => d.completedMinutes)),
    averageLabel: 'your last 7 report days',
    blocks: [...s.tasks]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((t) => ({ subject: t.subject, start: t.startTime, end: t.endTime, done: t.isDone })),
    days: [],
    subjects: parseBreakdown(s.subjectBreakdown),
    homework: homeworkByDay.get(s.key) ?? [],
    strengths: s.performance.strengths,
    next: s.performance.improvements,
  }));
}

/** Weekly reports, newest first, each compared with up to 4 earlier weeks. */
export function weeklyReports(
  weeks: WeeklyInput[],
  homeworkByWeek: Map<string, { title: string; subject: string }[]> = new Map()
): ReportData[] {
  return weeks.map((s, i) => ({
    kind: 'weekly',
    id: s.id,
    key: s.startKey,
    title: range(s.startKey, s.endKey, false),
    shortTitle: range(s.startKey, s.endKey, true),
    fileName: `Weekly report ${s.startKey}.pdf`,
    grade: s.performance.grade,
    score: s.performance.score,
    color: s.performance.theme.hex,
    level: s.performance.level,
    feedback: s.performance.feedback,
    detail: s.performance.detail,
    plannedMinutes: s.totalMinutes,
    doneMinutes: s.completedMinutes,
    blocksDone: s.completedSessions,
    blocksTotal: s.totalSessions,
    streak: s.currentStreak,
    averageMinutes: mean(weeks.slice(i + 1, i + 5).map((w) => w.completedMinutes)),
    averageLabel: 'your last 4 weeks',
    blocks: [],
    days: WEEK.map((label, d) => ({ label, minutes: Math.round(s.dailyMinutes[d] ?? 0) })),
    subjects: parseBreakdown(s.subjectBreakdown),
    homework: homeworkByWeek.get(s.startKey) ?? [],
    strengths: s.performance.strengths,
    next: s.performance.improvements,
  }));
}

/** "1h 40m", "45m", "0m". */
export function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
}

/** "+24m more than your last 7 report days", or null without an average. */
export function versusAverage(r: Pick<ReportData, 'doneMinutes' | 'averageMinutes' | 'averageLabel'>): { text: string; up: boolean } | null {
  if (r.averageMinutes === null) return null;
  const diff = r.doneMinutes - r.averageMinutes;
  if (Math.abs(diff) < 5) return { text: `About the same as ${r.averageLabel} (${hm(r.averageMinutes)})`, up: true };
  return {
    text: `${hm(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than ${r.averageLabel} (${hm(r.averageMinutes)})`,
    up: diff > 0,
  };
}
