/**
 * Reading a school timetable, in one place.
 *
 * "Which lesson is on right now" was written three separate times - the
 * dashboard status card, the lesson notifier and the portal each had their own
 * copy of the same minute arithmetic. They agreed by luck, and one of them
 * getting the `<` / `<=` boundary wrong would have shown a lesson as active a
 * minute after it ended on one surface and not the other.
 *
 * Pure and dependency-free on purpose: client components import it, and so can
 * a plain `node --test` run.
 */

/** A school lesson, as every consumer sees it. Serialisable across the wire. */
export type SchoolLesson = {
  id: string;
  /** 0 for Sunday, 1 for Monday - the schema's convention, matching ScheduleTemplate. */
  dayOfWeek: number;
  /** "HH:MM", 24hr. Validated where it enters the database, not here. */
  startTime: string;
  endTime: string;
  subject: string;
  /** Breaks and lunch occupy a slot but are not something you attend. */
  isBreak: boolean;
};

/** Monday-first day names, indexed by the schema's 0=Sunday dayOfWeek. */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** "HH:MM" as minutes past midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Where a day sits in a school week: Monday 0 through Sunday 6.
 *
 * The schema stores 0=Sunday because ScheduleTemplate does and the two have to
 * be comparable. A timetable is read Monday-first, so ordering converts.
 */
export const weekdayOrder = (dayOfWeek: number): number => (dayOfWeek + 6) % 7;

/** Just this day's lessons, in the order they happen. */
export function lessonsOn(lessons: SchoolLesson[], dayOfWeek: number): SchoolLesson[] {
  return lessons
    .filter((lesson) => lesson.dayOfWeek === dayOfWeek)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

/**
 * The lesson happening at `minutes` past midnight on `dayOfWeek`, or null.
 *
 * Half-open: a lesson that ends at 10:40 is over at 10:40, so the 10:40 lesson
 * is the one that owns that minute. Closed intervals would light up two lessons
 * at every changeover.
 */
export function lessonAt(
  lessons: SchoolLesson[],
  dayOfWeek: number,
  minutes: number
): SchoolLesson | null {
  return (
    lessonsOn(lessons, dayOfWeek).find(
      (lesson) => minutes >= toMinutes(lesson.startTime) && minutes < toMinutes(lesson.endTime)
    ) ?? null
  );
}

/**
 * The next lesson still to come on this day, or null once the day is done.
 *
 * Deliberately does not roll over into tomorrow. Every caller wants "what is
 * left of today" - a card saying "then Physics at 09:00" when it is 18:00 on
 * Friday would be describing Monday.
 */
export function nextLessonAfter(
  lessons: SchoolLesson[],
  dayOfWeek: number,
  minutes: number
): SchoolLesson | null {
  return lessonsOn(lessons, dayOfWeek).find((lesson) => toMinutes(lesson.startTime) > minutes) ?? null;
}

/** Changeover allowed between the halves of a double lesson, in minutes. */
const DOUBLE_LESSON_GAP = 5;

const sameSubject = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The timetable with back-to-back lessons of the same subject joined into one,
 * so a double lesson (Database 08:00-09:00 then 09:00-10:00) reads as one
 * lesson from 08:00 to 10:00. The home card counts down to the end of the
 * whole lesson, not the end of its first half. Breaks are never joined, and a
 * gap longer than a changeover keeps the two apart.
 */
export function joinDoubleLessons(lessons: SchoolLesson[]): SchoolLesson[] {
  const joined: SchoolLesson[] = [];
  for (const day of [...new Set(lessons.map((lesson) => lesson.dayOfWeek))]) {
    for (const lesson of lessonsOn(lessons, day)) {
      const last = joined[joined.length - 1];
      const continues =
        last &&
        last.dayOfWeek === day &&
        !last.isBreak &&
        !lesson.isBreak &&
        sameSubject(last.subject, lesson.subject) &&
        toMinutes(lesson.startTime) >= toMinutes(last.endTime) &&
        toMinutes(lesson.startTime) - toMinutes(last.endTime) <= DOUBLE_LESSON_GAP;
      if (continues) {
        if (toMinutes(lesson.endTime) > toMinutes(last.endTime)) last.endTime = lesson.endTime;
      } else {
        joined.push({ ...lesson });
      }
    }
  }
  return joined;
}

/**
 * When the school day starts and ends on a given day, or null if there is none.
 *
 * Derived rather than configured. /timetable used to draw a hardcoded
 * 07:30-17:20 band on every user's week; it now draws the span of the lessons
 * that user actually has, so a day with no lessons draws nothing.
 */
export function schoolDayBounds(
  lessons: SchoolLesson[],
  dayOfWeek: number
): { start: string; end: string } | null {
  const day = lessonsOn(lessons, dayOfWeek);
  if (day.length === 0) return null;

  // Last by END time, not by position: a timetable may list a long lesson that
  // starts early and finishes after a short one that starts later.
  const end = day.reduce((latest, lesson) =>
    toMinutes(lesson.endTime) > toMinutes(latest.endTime) ? lesson : latest
  );
  return { start: day[0].startTime, end: end.endTime };
}

/** Minutes past midnight for a Date, in whatever timezone it already carries. */
export const minutesOf = (date: Date): number => date.getHours() * 60 + date.getMinutes();
