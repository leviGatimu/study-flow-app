/** Exam dates are calendar dates; times belong to the account's timezone. */
export type TimedExam = {
  date: Date | string;
  startTime?: string | null;
  endTime?: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const examDay = (date: Date | string) => new Date(date).toISOString().slice(0, 10);

export function validateExamTimes(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  if (!start || !end) return 'Enter both a start and end time, or leave both blank.';
  if (!TIME.test(start) || !TIME.test(end)) return 'Use valid times in HH:MM format.';
  if (start === end) return 'The end time must differ from the start time.';
  return null;
}

function wallNow(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

export function examStatus(exam: TimedExam, timezone: string, now = new Date()): 'UPCOMING' | 'IN_PROGRESS' | 'DONE' {
  const day = new Date(`${examDay(exam.date)}T00:00:00Z`).getTime();
  const timeOffset = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h * 60 + m) * 60_000;
  };
  const start = exam.startTime && TIME.test(exam.startTime) ? day + timeOffset(exam.startTime) : null;
  let end = exam.endTime && TIME.test(exam.endTime) ? day + timeOffset(exam.endTime) : day + 86_400_000;
  // An end earlier than the start belongs to the following day (e.g. 23:00–01:00).
  if (start !== null && end < start) end += 86_400_000;
  const current = wallNow(now, timezone);
  if (current >= end) return 'DONE';
  if (start !== null && current >= start) return 'IN_PROGRESS';
  return 'UPCOMING';
}

export function examDaysAway(exam: TimedExam, timezone: string, now = new Date()): number {
  return Math.floor(new Date(`${examDay(exam.date)}T00:00:00Z`).getTime() / 86_400_000)
    - Math.floor(wallNow(now, timezone) / 86_400_000);
}

export function examTimeLabel(exam: TimedExam): string {
  if (!exam.startTime && !exam.endTime) return 'Time not set';
  return `${exam.startTime ?? '?'}–${exam.endTime ?? '?'}${exam.startTime && exam.endTime && exam.endTime < exam.startTime ? ' (+1 day)' : ''}`;
}
