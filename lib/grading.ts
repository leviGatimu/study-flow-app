/**
 * StudyFlow — Weekly Performance Grading Engine
 * --------------------------------------------------
 * A fair, effort-weighted scoring model. Hours studied are the dominant
 * signal and establish a guaranteed grade FLOOR, so a high-effort week can
 * never collapse to an "F" because of a few missed checkboxes. Consistency,
 * completion, streaks and week-over-week improvement act as modifiers that
 * can lift the score toward the top "S" tier.
 *
 * Everything here is pure and deterministic so it can run identically on the
 * server (when persisting a summary) and on the client (when rendering it).
 */

export interface WeeklyMetricsInput {
  /** Minutes actually studied this week (sum of completed task durations). */
  studiedMinutes: number;
  /** Minutes scheduled this week (sum of all task durations). */
  scheduledMinutes: number;
  /** Number of completed study sessions/tasks. */
  completedSessions: number;
  /** Total scheduled sessions/tasks. */
  totalSessions: number;
  /** Distinct days (0-7) with at least one completed session. */
  activeDays: number;
  /** Longest run of consecutive active days within this week (0-7). */
  weekStreak: number;
  /** Studied minutes in the previous week, or null if unknown. */
  prevStudiedMinutes: number | null;
}

export type GradeKey = "F" | "D" | "C" | "B" | "A" | "A+" | "S";

export interface GradeTheme {
  /** Primary hex colour for charts / accents. */
  hex: string;
  /** Soft background hex (for chart gradients). */
  softHex: string;
  /** Tailwind text colour class. */
  text: string;
  /** Tailwind background tint class. */
  bg: string;
  /** Tailwind border class. */
  border: string;
  /** Tailwind gradient (from/to) for hero cards. */
  gradient: string;
  /** Glow colour class. */
  glow: string;
  /** Human label used on the transcript ribbon. */
  ring: string;
}

export interface PerformanceComponents {
  hours: number;        // 0-100
  consistency: number;  // 0-100
  completion: number;   // 0-100
  streak: number;       // 0-100
  improvement: number;  // 0-100
}

export interface WeeklyPerformance {
  score: number;            // 0-100 final weighted score
  grade: GradeKey;          // letter grade
  level: string;            // descriptive tier label
  feedback: string;         // personalized headline message
  detail: string;           // supporting sentence
  strengths: string[];      // what went well
  improvements: string[];   // actionable suggestions
  insights: string[];       // data-driven observations
  components: PerformanceComponents;
  theme: GradeTheme;
  /** Percentage change in studied hours vs last week, or null. */
  improvementPct: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Linear interpolation across an ordered list of [input, output] breakpoints. */
function interpolate(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * Maps weekly study HOURS to a 0-100 score. The breakpoints are tuned so the
 * resulting score lands in the grade band the user expects for that effort
 * level (see README of grade thresholds below).
 *
 *   0-2h → F   2-5h → D   5-10h → C   10-20h → B
 *   20-35h → A   35-50h → A+   50h+ → S
 */
export function hoursScore(hours: number): number {
  return clamp(
    interpolate(hours, [
      [0, 0],
      [2, 42],
      [5, 55],
      [10, 68],
      [20, 80],
      [35, 90],
      [50, 96],
      [70, 100],
    ])
  );
}

/**
 * Guaranteed minimum score based purely on hours studied. This is the core
 * fix: real effort can NEVER be graded an F. A 50h week floors at 92 (A+).
 */
function hoursFloor(hours: number): number {
  if (hours >= 50) return 92;
  if (hours >= 35) return 88;
  if (hours >= 20) return 80;
  if (hours >= 10) return 68;
  if (hours >= 5) return 55;
  if (hours >= 2) return 42;
  return 0;
}

export function gradeFromScore(score: number): GradeKey {
  if (score >= 97) return "S";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 68) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export const GRADE_THEMES: Record<GradeKey, GradeTheme> = {
  S: {
    hex: "#a855f7", softHex: "#f3e8ff",
    text: "text-fuchsia-500 dark:text-fuchsia-400",
    bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30",
    gradient: "from-fuchsia-500 via-purple-500 to-amber-400",
    glow: "bg-fuchsia-500", ring: "S TIER · ELITE",
  },
  "A+": {
    hex: "#15803d", softHex: "#dcfce7",
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-600/10", border: "border-green-600/30",
    gradient: "from-green-600 via-emerald-600 to-green-700",
    glow: "bg-green-600", ring: "OUTSTANDING",
  },
  A: {
    hex: "#22c55e", softHex: "#dcfce7",
    text: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10", border: "border-emerald-500/25",
    gradient: "from-emerald-500 to-green-500",
    glow: "bg-emerald-500", ring: "EXCELLENT",
  },
  B: {
    hex: "#84cc16", softHex: "#ecfccb",
    text: "text-lime-600 dark:text-lime-400",
    bg: "bg-lime-500/10", border: "border-lime-500/25",
    gradient: "from-lime-500 to-emerald-500",
    glow: "bg-lime-500", ring: "STRONG",
  },
  C: {
    hex: "#eab308", softHex: "#fef9c3",
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10", border: "border-yellow-500/25",
    gradient: "from-yellow-400 to-amber-500",
    glow: "bg-yellow-500", ring: "STEADY",
  },
  D: {
    hex: "#f97316", softHex: "#ffedd5",
    text: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10", border: "border-orange-500/25",
    gradient: "from-orange-500 to-amber-500",
    glow: "bg-orange-500", ring: "BUILDING",
  },
  F: {
    hex: "#ef4444", softHex: "#fee2e2",
    text: "text-red-500 dark:text-red-400",
    bg: "bg-red-500/10", border: "border-red-500/25",
    gradient: "from-red-500 to-rose-500",
    glow: "bg-red-500", ring: "GETTING STARTED",
  },
};

const LEVEL_LABELS: Record<GradeKey, string> = {
  S: "Elite Performer",
  "A+": "Outstanding",
  A: "Excellent",
  B: "Strong Momentum",
  C: "Steady Progress",
  D: "Building Habits",
  F: "Getting Started",
};

/* ------------------------------------------------------------------ */
/* Feedback generation                                                */
/* ------------------------------------------------------------------ */

function buildFeedback(grade: GradeKey): { feedback: string; detail: string } {
  switch (grade) {
    case "S":
      return {
        feedback: "Outstanding week — you're operating at an elite level.",
        detail: "Your commitment and work ethic are exceptional. Keep maintaining this level of focus.",
      };
    case "A+":
      return {
        feedback: "Excellent work. You're among the top-performing students.",
        detail: "Your dedication and consistency are paying off. Hold this rhythm.",
      };
    case "A":
      return {
        feedback: "Excellent week. You're hitting your targets consistently.",
        detail: "Strong, sustained effort. A little more consistency unlocks the top tier.",
      };
    case "B":
      return {
        feedback: "Solid progress this week — you're building real momentum.",
        detail: "Consistency is improving. Push your weekly hours up to reach an A.",
      };
    case "C":
      return {
        feedback: "Good, steady effort. You're showing up.",
        detail: "Tighten your daily routine and add a few more focused hours next week.",
      };
    case "D":
      return {
        feedback: "You're getting started — keep the momentum going.",
        detail: "Try increasing study time and building a daily habit to climb the grades.",
      };
    default:
      return {
        feedback: "Every expert started here. Let's build the habit.",
        detail: "Aim for a couple of focused hours across a few days this week — small wins compound.",
      };
  }
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                   */
/* ------------------------------------------------------------------ */

export function computeWeeklyPerformance(input: WeeklyMetricsInput): WeeklyPerformance {
  const hours = input.studiedMinutes / 60;

  // --- Component scores (each 0-100) ---
  const hScore = hoursScore(hours);
  const consistency = clamp((input.activeDays / 7) * 100);
  const completion = input.totalSessions > 0
    ? clamp((input.completedSessions / input.totalSessions) * 100)
    : 0;
  const streak = clamp((input.weekStreak / 7) * 100);

  // Improvement: +50% week-over-week = 100, flat = 60, -50% = 0. Neutral 60
  // when there's no prior week to compare against.
  let improvementPct: number | null = null;
  let improvement = 60;
  if (input.prevStudiedMinutes !== null && input.prevStudiedMinutes > 0) {
    improvementPct = ((input.studiedMinutes - input.prevStudiedMinutes) / input.prevStudiedMinutes) * 100;
    improvement = clamp(60 + (improvementPct / 50) * 40);
  } else if (input.prevStudiedMinutes === 0 && input.studiedMinutes > 0) {
    improvementPct = 100;
    improvement = 100;
  }

  const components: PerformanceComponents = {
    hours: Math.round(hScore),
    consistency: Math.round(consistency),
    completion: Math.round(completion),
    streak: Math.round(streak),
    improvement: Math.round(improvement),
  };

  // --- Weighted blend (hours dominate at 50%) ---
  const weighted =
    hScore * 0.5 +
    consistency * 0.2 +
    completion * 0.15 +
    streak * 0.08 +
    improvement * 0.07;

  // Effort floor guarantees a fair grade for real hours invested.
  const score = Math.round(clamp(Math.max(weighted, hoursFloor(hours))));
  const grade = gradeFromScore(score);
  const { feedback, detail } = buildFeedback(grade);

  // --- Strengths & improvements (data-driven) ---
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (hours >= 20) strengths.push(`Logged ${hours.toFixed(1)} hours of focused study`);
  if (input.activeDays >= 5) strengths.push(`Studied on ${input.activeDays} different days`);
  if (completion >= 80) strengths.push(`Completed ${components.completion}% of planned sessions`);
  if (input.weekStreak >= 4) strengths.push(`${input.weekStreak}-day consistency streak`);
  if (improvementPct !== null && improvementPct >= 15)
    strengths.push(`Up ${Math.round(improvementPct)}% vs last week`);

  if (hours < 10) improvements.push("Increase weekly study hours toward 10+");
  if (input.activeDays < 4) improvements.push("Spread sessions across more days of the week");
  if (completion < 70 && input.totalSessions > 0)
    improvements.push("Finish more of the sessions you plan");
  if (input.weekStreak < 3) improvements.push("Build a daily streak — even 20 minutes counts");
  if (improvementPct !== null && improvementPct < -10)
    improvements.push("Aim to match or beat last week's hours");

  // Always give at least one of each so the UI never looks empty.
  if (strengths.length === 0) strengths.push("You showed up and logged study time");
  if (improvements.length === 0) improvements.push("Keep this rhythm and push for a new personal best");

  return {
    score,
    grade,
    level: LEVEL_LABELS[grade],
    feedback,
    detail,
    strengths,
    improvements,
    insights: [],
    components,
    theme: GRADE_THEMES[grade],
    improvementPct,
  };
}

/* ------------------------------------------------------------------ */
/* Milestones (for achievement badges)                                */
/* ------------------------------------------------------------------ */

export const HOUR_MILESTONES = [5, 10, 20, 35, 50, 75, 100];
export const STREAK_MILESTONES = [3, 5, 7, 14, 30];

/** Returns the next hour milestone and how many hours remain to reach it. */
export function nextHourMilestone(hours: number): { target: number; remaining: number } | null {
  const target = HOUR_MILESTONES.find((m) => m > hours);
  if (!target) return null;
  return { target, remaining: Math.max(0, target - hours) };
}

/* ------------------------------------------------------------------ */
/* Daily performance (single-day grading)                             */
/* ------------------------------------------------------------------ */

export interface DailyMetricsInput {
  /** Minutes scheduled today (headline effort signal). */
  studiedMinutes: number;
  completedSessions: number;
  totalSessions: number;
  /** Consecutive-day study streak, from UserProgress. */
  currentStreak: number;
  /** Scheduled minutes yesterday, or null if unknown. */
  prevDayMinutes: number | null;
}

/**
 * Maps daily study HOURS to a 0-100 score. A full week's worth of weekly
 * thresholds compressed into one day would never be reachable, so these
 * breakpoints are tuned much tighter than `hoursScore`.
 *
 *   0-0.5h → F   0.5-1h → D   1-2h → C   2-3.5h → B   3.5-5h → A
 *   5-6.5h → A+   6.5h+ → S
 */
export function dailyHoursScore(hours: number): number {
  return clamp(
    interpolate(hours, [
      [0, 0],
      [0.5, 40],
      [1, 52],
      [2, 65],
      [3.5, 78],
      [5, 88],
      [6.5, 95],
      [8, 100],
    ])
  );
}

function dailyHoursFloor(hours: number): number {
  if (hours >= 6.5) return 90;
  if (hours >= 5) return 84;
  if (hours >= 3.5) return 75;
  if (hours >= 2) return 62;
  if (hours >= 1) return 50;
  if (hours >= 0.5) return 38;
  return 0;
}

function buildDailyFeedback(grade: GradeKey): { feedback: string; detail: string } {
  switch (grade) {
    case "S":
      return { feedback: "Phenomenal day — elite-level focus.", detail: "You showed up and gave it everything. Protect this rhythm." };
    case "A+":
      return { feedback: "Outstanding day. You're operating at a top tier.", detail: "This kind of discipline is exactly what compounds into big results." };
    case "A":
      return { feedback: "Excellent day — strong, focused effort.", detail: "Keep stacking days like this one." };
    case "B":
      return { feedback: "Solid day of progress.", detail: "A bit more focused time tomorrow pushes this into A territory." };
    case "C":
      return { feedback: "Steady effort today. You showed up.", detail: "Tighten the schedule and finish what you start tomorrow." };
    case "D":
      return { feedback: "A light day — but you're still in motion.", detail: "Add an extra focused hour tomorrow to build momentum." };
    default:
      return { feedback: "A quiet day. Tomorrow is a fresh start.", detail: "Even 30-60 focused minutes tomorrow restarts the momentum." };
  }
}

export function computeDailyPerformance(input: DailyMetricsInput): WeeklyPerformance {
  const hours = input.studiedMinutes / 60;

  const hScore = dailyHoursScore(hours);
  const completion = input.totalSessions > 0
    ? clamp((input.completedSessions / input.totalSessions) * 100)
    : 0;
  const streak = clamp((input.currentStreak / 14) * 100);

  // Momentum vs yesterday: +50% = 100, flat = 60, -50% = 0. Neutral 60 when
  // there's no prior day to compare against.
  let improvementPct: number | null = null;
  let improvement = 60;
  if (input.prevDayMinutes !== null && input.prevDayMinutes > 0) {
    improvementPct = ((input.studiedMinutes - input.prevDayMinutes) / input.prevDayMinutes) * 100;
    improvement = clamp(60 + (improvementPct / 50) * 40);
  } else if (input.prevDayMinutes === 0 && input.studiedMinutes > 0) {
    improvementPct = 100;
    improvement = 100;
  }

  const components: PerformanceComponents = {
    hours: Math.round(hScore),
    consistency: Math.round(completion),
    completion: Math.round(completion),
    streak: Math.round(streak),
    improvement: Math.round(improvement),
  };

  // Hours dominate even more than the weekly blend, since a single day has
  // no room for a "consistency across days" signal.
  const weighted =
    hScore * 0.55 +
    completion * 0.25 +
    streak * 0.1 +
    improvement * 0.1;

  const score = Math.round(clamp(Math.max(weighted, dailyHoursFloor(hours))));
  const grade = gradeFromScore(score);
  const { feedback, detail } = buildDailyFeedback(grade);

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (hours >= 5) strengths.push(`Logged ${hours.toFixed(1)} focused hours today`);
  if (completion >= 80 && input.totalSessions > 0) strengths.push(`Completed ${components.completion}% of today's sessions`);
  if (input.currentStreak >= 3) strengths.push(`${input.currentStreak}-day study streak going`);
  if (improvementPct !== null && improvementPct >= 15) strengths.push(`Up ${Math.round(improvementPct)}% vs yesterday`);

  if (hours < 2) improvements.push("Aim for at least 2 focused hours tomorrow");
  if (completion < 70 && input.totalSessions > 0) improvements.push("Finish everything you schedule for the day");
  if (input.currentStreak < 3) improvements.push("Build a daily streak — even a short session counts");
  if (improvementPct !== null && improvementPct < -10) improvements.push("Bounce back tomorrow — match or beat today's hours");

  if (strengths.length === 0) strengths.push("You showed up and logged study time today");
  if (improvements.length === 0) improvements.push("Keep this rhythm going tomorrow");

  return {
    score,
    grade,
    level: LEVEL_LABELS[grade],
    feedback,
    detail,
    strengths,
    improvements,
    insights: [],
    components,
    theme: GRADE_THEMES[grade],
    improvementPct,
  };
}
