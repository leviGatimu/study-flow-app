import { cache } from 'react';
import { redirect } from 'next/navigation';

import { getMentorSession, getUserId } from '@/lib/auth';
import { ensureTasksGenerated, getCurrentUserTimezone } from '@/lib/actions';
import { prisma } from '@/lib/prisma';
import { byTerm, getViewScope } from '@/lib/scope';
import { getScheduleState } from '@/lib/term';
import { taskDateFromKey, taskDayKey, todayKey } from '@/lib/schedule-placement';
import { getTimeZoneOffsetMinutes } from '@/lib/utils';
import { addDays, type MentorExam, type MentorHomework, type MentorTask } from '@/lib/mentor-model';

/**
 * What a mentor's pages read. Server-only (not 'use server'): every loader
 * takes the student's id from the mentor's own session, never from the
 * browser, and selects only what a mentor may see - no notes, answers or
 * proof files are ever read here, so none can reach the page.
 */

/** The student's calendar day of a moment in time (not a stored day). */
const localDay = (at: Date, timeZone: string) =>
  new Date(at.getTime() + getTimeZoneOffsetMinutes(timeZone, at) * 60_000).toISOString().slice(0, 10);

export type MentorStudent = {
  studentId: string;
  mentorName: string;
  name: string;
  school: string | null;
  /** Private "/uploads/..." path; the uploads route checks the session. */
  avatarUrl: string | null;
  timeZone: string;
  today: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  level: number;
  xp: number;
  classLabel: string | null;
  termName: string | null;
  isRunning: boolean;
};

/** The signed-in mentor's student. Anyone else is sent away. */
export const requireMentorStudent = cache(async function requireMentorStudent(): Promise<MentorStudent> {
  const studentId = await getUserId();
  if (!studentId) redirect('/welcome');
  const mentor = await getMentorSession();
  if (!mentor) redirect('/');

  const [timeZone, progress, schedule] = await Promise.all([
    getCurrentUserTimezone(),
    prisma.userProgress.findUnique({
      where: { userId: studentId },
      select: { name: true, school: true, avatarUrl: true, currentStreak: true, longestStreak: true, lastActiveDate: true, level: true, xp: true },
    }),
    getScheduleState(studentId),
  ]);

  return {
    studentId,
    mentorName: mentor.username,
    name: progress?.name?.trim() || 'Your student',
    school: progress?.school?.trim() || null,
    avatarUrl: progress?.avatarUrl ?? null,
    timeZone,
    today: todayKey(timeZone),
    currentStreak: progress?.currentStreak ?? 0,
    longestStreak: progress?.longestStreak ?? 0,
    lastActiveDate: progress?.lastActiveDate ?? null,
    level: progress?.level ?? 1,
    xp: progress?.xp ?? 0,
    classLabel: schedule.classLabel,
    termName: schedule.termName,
    isRunning: schedule.isRunning,
  };
});

/**
 * Study blocks from `from` to `to` ("yyyy-MM-dd", inclusive), with the focus
 * time spent on each. Days ahead are generated from the routine first, the
 * same as when the student opens their week.
 */
export async function loadMentorTasks(student: MentorStudent, from: string, to: string): Promise<MentorTask[]> {
  const { studentId, today, timeZone } = student;
  if (to >= today && student.isRunning) {
    const start = from > today ? from : today;
    const end = taskDateFromKey(to);
    end.setHours(23, 59, 59, 999);
    await ensureTasksGenerated(taskDateFromKey(start), end);
  }

  const scope = await getViewScope(studentId);
  // Stored dates sit at the start of the student's day; pad a day each side
  // and keep the rows whose day key falls inside.
  const rows = await prisma.task.findMany({
    where: {
      userId: studentId,
      ...byTerm(scope),
      isDeleted: false,
      date: { gte: taskDateFromKey(addDays(from, -1)), lt: taskDateFromKey(addDays(to, 2)) },
    },
    select: { id: true, subject: true, type: true, startTime: true, endTime: true, date: true, isDone: true, isMissed: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const tasks = rows.map((t) => ({ ...t, day: taskDayKey(t.date, timeZone) })).filter((t) => t.day >= from && t.day <= to);

  const focus = new Map<string, number>();
  if (tasks.length) {
    const events = await prisma.xpEvent.findMany({
      where: { userId: studentId, source: 'FOCUS', taskId: { in: tasks.map((t) => t.id) } },
      select: { taskId: true, amount: true, focusSeconds: true },
    });
    for (const e of events) {
      if (!e.taskId || !e.focusSeconds) continue;
      focus.set(e.taskId, (focus.get(e.taskId) ?? 0) + Math.sign(e.amount || 1) * e.focusSeconds);
    }
  }

  return tasks.map((t) => ({
    id: t.id,
    subject: t.subject,
    type: t.type,
    startTime: t.startTime,
    endTime: t.endTime,
    day: t.day,
    isDone: t.isDone,
    isMissed: t.isMissed,
    focusMinutes: Math.max(0, Math.round((focus.get(t.id) ?? 0) / 60)),
  }));
}

export async function loadMentorExams(student: MentorStudent): Promise<MentorExam[]> {
  const scope = await getViewScope(student.studentId);
  const rows = await prisma.examEvent.findMany({
    where: { userId: student.studentId, ...byTerm(scope) },
    select: {
      id: true,
      title: true,
      date: true,
      kind: true,
      category: true,
      startTime: true,
      score: true,
      maxScore: true,
      subject: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    subject: e.subject?.name ?? null,
    kind: e.kind,
    category: e.category,
    day: taskDayKey(e.date, student.timeZone),
    startTime: e.startTime,
    score: e.score,
    maxScore: e.maxScore,
  }));
}

export async function loadMentorHomework(student: MentorStudent): Promise<MentorHomework[]> {
  const scope = await getViewScope(student.studentId);
  const rows = await prisma.homework.findMany({
    where: { userId: student.studentId, ...byTerm(scope) },
    select: { id: true, title: true, subject: true, dueDate: true, isCompleted: true, completedAt: true },
    orderBy: { dueDate: 'asc' },
  });
  // Due dates are stored as UTC midnight of the chosen day.
  return rows.map((h) => ({
    id: h.id,
    title: h.title,
    subject: h.subject,
    due: h.dueDate.toISOString().slice(0, 10),
    isCompleted: h.isCompleted,
    completed: h.completedAt ? localDay(h.completedAt, student.timeZone) : null,
  }));
}
