'use server';

import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, addDays, isSameDay, differenceInDays, format } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId, login, logout } from '@/lib/auth';
import { saveUpload, deleteUpload } from '@/lib/upload';
import bcrypt from 'bcryptjs';
import { getRwandaTime } from './utils';

import { addXp } from './gamification';
import { computeWeeklyPerformance, computeDailyPerformance, type WeeklyPerformance } from './grading';

/**
 * AUTH: Login user
 */
export async function loginUser(formData: FormData) {
  try {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) return { error: 'Username and password are required' };

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return { error: 'Invalid credentials' };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { error: 'Invalid credentials' };

    await login(user.id);
    return { success: true };
  } catch (error: any) {
    console.error('Login error:', error);
    return { error: error.message || 'An unexpected error occurred during login' };
  }
}

/**
 * AUTH: Register user
 */
export async function registerUser(formData: FormData) {
  try {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) return { error: 'Username and password are required' };

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { error: 'Username already taken' };

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash }
    });

    // Create initial progress for new user
    await prisma.userProgress.create({
      data: { userId: user.id, name: username }
    });

    // Seed default weekly schedule templates for the new user
    const defaultTemplates = [
      { dayOfWeek: 1, subject: 'Networking Fundamentals', startTime: '20:00', endTime: '20:30', deadlineDay: 'Monday', type: 'HOMEWORK' },
      { dayOfWeek: 1, subject: 'Develop Web Application Using JavaScript', startTime: '20:30', endTime: '21:30', deadlineDay: 'Monday', type: 'HOMEWORK' },
      { dayOfWeek: 1, subject: 'Design Embedded Systems Hardware', startTime: '20:00', endTime: '20:30', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
      { dayOfWeek: 2, subject: 'Design Web Application Using PHP', startTime: '20:00', endTime: '21:30', deadlineDay: 'Wednesday', type: 'HOMEWORK' },
      { dayOfWeek: 2, subject: 'ENTREPRENEURSHIP', startTime: '21:30', endTime: '22:00', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
      { dayOfWeek: 2, subject: 'ENGLISH', startTime: '22:00', endTime: '23:30', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
      { dayOfWeek: 3, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '19:00', endTime: '21:30', deadlineDay: 'Friday', type: 'HOMEWORK' },
      { dayOfWeek: 3, subject: 'Develop Basic Database', startTime: '21:30', endTime: '22:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
      { dayOfWeek: 3, subject: 'Foundamentals of Programming using C', startTime: '22:30', endTime: '23:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
      { dayOfWeek: 4, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '19:00', endTime: '21:30', deadlineDay: 'Sunday', type: 'HOMEWORK' },
      { dayOfWeek: 4, subject: 'Design Web User Interface', startTime: '21:30', endTime: '22:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
      { dayOfWeek: 4, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', deadlineDay: 'Thursday', type: 'HOMEWORK' },
      { dayOfWeek: 5, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '20:00', endTime: '21:30', deadlineDay: 'Friday', type: 'REVISION' },
      { dayOfWeek: 5, subject: 'Foundamentals of Programming using C', startTime: '21:30', endTime: '22:30', deadlineDay: 'Friday', type: 'REVISION' },
      { dayOfWeek: 5, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', deadlineDay: 'Friday', type: 'REVISION' },
      { dayOfWeek: 6, subject: 'Develop Web Application Using JavaScript', startTime: '18:00', endTime: '20:30', deadlineDay: 'Saturday', type: 'REVISION' },
      { dayOfWeek: 6, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '20:30', endTime: '22:00', deadlineDay: 'Saturday', type: 'REVISION' },
      { dayOfWeek: 0, subject: 'Design Embedded Systems Hardware', startTime: '19:00', endTime: '20:30', deadlineDay: 'Sunday', type: 'REVISION' },
      { dayOfWeek: 0, subject: 'Design Web Application Using PHP', startTime: '20:30', endTime: '22:00', deadlineDay: 'Sunday', type: 'REVISION' }
    ];

    await prisma.scheduleTemplate.createMany({
      data: defaultTemplates.map(t => ({ ...t, userId: user.id }))
    });

    await login(user.id);
    return { success: true };
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during registration';
    return { error: errorMessage };
  }
}

/**
 * AUTH: Update user password
 */
export async function updatePassword(formData: FormData) {
  try {
    const userId = await getUserId();
    if (!userId) return { error: 'Unauthorized' };

    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: 'All fields are required' };
    }

    if (newPassword !== confirmPassword) {
      return { error: 'New passwords do not match' };
    }

    if (newPassword.length < 6) {
      return { error: 'New password must be at least 6 characters' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found' };

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { error: 'Current password is incorrect' };

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Update password error:', error);
    return { error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * AUTH: Logout user
 */
export async function logoutUser() {
  await logout();
  redirect('/welcome');
}

/**
 * Normalization Utility: Clean subject names to group them correctly
 */
function normalizeSubject(subject: string) {
  if (!subject) return '';
  return subject
    .replace(/\s*\(revision\)\s*/gi, '') 
    .replace(/'/g, '')                    
    .trim();
}

/**
 * Utility: Generate tasks for a specific date range based on templates
 */
export async function ensureTasksGenerated(startDate: Date, endDate: Date) {
  const userId = await getUserId();
  if (!userId) return;

  const templates = await prisma.scheduleTemplate.findMany({ where: { userId } });
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);

  const existingTasks = await prisma.task.findMany({
    where: {
      userId,
      date: { gte: start, lte: end }
    },
    select: { templateId: true, date: true }
  });

  const lookup = new Set(
    existingTasks
      .filter(t => t.templateId !== null)
      .map(t => {
        const d = new Date(t.date);
        d.setUTCHours(d.getUTCHours() + 2);
        return `${t.templateId}|${d.toISOString().split('T')[0]}`;
      })
  );

  const tasksToCreate = [];
  let currentDate = start;

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
    
    const d = new Date(currentDate);
    d.setUTCHours(d.getUTCHours() + 2);
    const dateKey = d.toISOString().split('T')[0];
    
    for (const template of dayTemplates) {
      const compositeKey = `${template.id}|${dateKey}`;
      if (!lookup.has(compositeKey)) {
        tasksToCreate.push({
          userId,
          templateId: template.id,
          date: currentDate,
          startTime: template.startTime,
          endTime: template.endTime,
          subject: template.subject,
          type: template.type,
          isMissed: false,
          isDeleted: false
        });
        lookup.add(compositeKey);
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  if (tasksToCreate.length > 0) {
    await prisma.task.createMany({ data: tasksToCreate });
  }
}

/**
 * Utility: Find and mark tasks as missed if their scheduled time is past and they have no proof
 */
export async function checkAndMarkMissedTasks(userId: string) {
  const now = getRwandaTime();
  
  // Find all active tasks of today or earlier that are not done, not missed, have no proof, and are not deleted
  const activeTasks = await prisma.task.findMany({
    where: {
      userId,
      isDone: false,
      isMissed: false,
      isDeleted: false,
      workDescription: null,
      proofPdfUrl: null,
      date: { lte: endOfDay(now) }
    }
  });

  const tasksToMark = [];

  for (const task of activeTasks) {
    if (!task.endTime || !task.endTime.includes(':')) continue;
    
    const [endH, endM] = task.endTime.split(':').map(Number);
    const taskEndTime = new Date(task.date);
    taskEndTime.setHours(endH, endM, 0, 0);

    // If current time is past the end time of the task
    if (now.getTime() > taskEndTime.getTime()) {
      tasksToMark.push(task.id);
    }
  }

  if (tasksToMark.length > 0) {
    await prisma.task.updateMany({
      where: {
        id: { in: tasksToMark }
      },
      data: {
        isMissed: true
      }
    });
  }
}

/**
 * Fetch today's tasks with priority logic
 */
export async function getTodayTasks() {
  const userId = await getUserId();
  if (!userId) return [];

  const today = getRwandaTime();
  await ensureTasksGenerated(today, today);
  await checkAndMarkMissedTasks(userId);

  const start = startOfDay(today);
  const end = endOfDay(today);

  const tasks = await prisma.task.findMany({
    where: { 
      userId,
      date: { gte: start, lte: end },
      isDeleted: false 
    },
    include: { template: true },
    orderBy: { startTime: 'asc' }
  });

  const upcomingExams = await prisma.examEvent.findMany({
    where: {
      userId,
      date: { gte: start, lte: addDays(start, 7) }
    }
  });

  const urgentSubjects = new Set(upcomingExams.map(e => normalizeSubject(e.title)));

  return tasks.map(task => ({
    ...task,
    isUrgent: urgentSubjects.has(normalizeSubject(task.subject))
  })).sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    
    // Within groups, sort by startTime
    const [ah, am] = a.startTime.split(':').map(Number);
    const [bh, bm] = b.startTime.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });
}

/**
 * Fetch tomorrow's tasks
 */
export async function getTomorrowTasks() {
  const userId = await getUserId();
  if (!userId) return [];

  const tomorrow = addDays(getRwandaTime(), 1);
  await ensureTasksGenerated(tomorrow, tomorrow);

  const start = startOfDay(tomorrow);
  const end = endOfDay(tomorrow);

  return prisma.task.findMany({
    where: { 
      userId,
      date: { gte: start, lte: end },
      isDeleted: false 
    },
    include: { template: true },
    orderBy: { startTime: 'asc' }
  });
}

/**
 * Fetch yesterday's tasks (completed ones)
 */
export async function getYesterdayTasks() {
  const userId = await getUserId();
  if (!userId) return [];

  const yesterday = addDays(getRwandaTime(), -1);
  const start = startOfDay(yesterday);
  const end = endOfDay(yesterday);

  return prisma.task.findMany({
    where: { 
      userId,
      date: { gte: start, lte: end },
      isDeleted: false,
      isDone: true
    },
    include: { template: true },
    orderBy: { startTime: 'asc' }
  });
}

/**
 * Fetch all tasks (Calendar view)
 */
export async function getAllTasks() {
  const userId = await getUserId();
  if (!userId) return [];

  const today = getRwandaTime();
  const endOfJune = new Date(2026, 5, 30);
  await ensureTasksGenerated(today, endOfJune);
  await checkAndMarkMissedTasks(userId);

  return prisma.task.findMany({
    where: { userId, isDeleted: false }, 
    include: { template: true },
    orderBy: { startTime: 'asc' }
  });
}

/**
 * Toggle task completion status
 */
export async function toggleTaskDone(taskId: string, isDone: boolean) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { 
      isDone,
      isMissed: isDone ? false : undefined 
    }
  });

  if (isDone) {
    await addXp(userId, 100);
  }

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/calendar');
  revalidatePath('/timetable');
}

/**
 * Toggle task missed status
 */
export async function toggleTaskMissed(taskId: string, isMissed: boolean) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { 
      isMissed,
      isDone: isMissed ? false : undefined 
    }
  });
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/calendar');
  revalidatePath('/timetable');
}

export async function updateTaskProof(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const taskId = formData.get('taskId') as string;
  const description = formData.get('description') as string;
  const file = formData.get('file') as File;

  let proofPdfUrl = undefined;

  if (file && file.size > 0) {
    try {
      proofPdfUrl = await saveUpload(file, 'proof');
    } catch (e: any) {
      return { error: e.message || 'Failed to upload file.' };
    }
  }

  await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { 
      workDescription: description,
      ...(proofPdfUrl ? { proofPdfUrl } : {})
    }
  });

  revalidatePath('/');
  revalidatePath('/history');
  return { success: true };
}

export async function getSubjectStats(subject: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const normalized = normalizeSubject(subject);
  const tasks = await prisma.task.findMany({
    where: { 
      userId, 
      subject: { contains: normalized },
      isDeleted: false
    }
  });

  const doneTasks = tasks.filter(t => t.isDone);
  const totalMinutes = doneTasks.reduce((acc, t) => {
    const [sH, sM] = t.startTime.split(':').map(Number);
    const [eH, eM] = t.endTime.split(':').map(Number);
    let mins = (eH * 60 + eM) - (sH * 60 + sM);
    if (mins < 0) mins += 1440;
    return acc + mins;
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return {
    totalSessions: tasks.length,
    completedSessions: doneTasks.length,
    completionRate: tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0,
    timeSpent: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
    totalMinutes
  };
}

/**
 * Logic-based Deletion
 */
export async function deleteTask(taskId: string) {
  const userId = await getUserId();
  if (!userId) return { success: false };

  try {
    await prisma.task.updateMany({
      where: { id: taskId, userId },
      data: { isDeleted: true }
    });
    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/history');
    revalidatePath('/timetable');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Fetch history tasks
 */
export async function getHistoryTasks() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.task.findMany({
    where: {
      userId,
      isDeleted: false,
      OR: [ { isDone: true }, { isMissed: true } ]
    },
    include: { template: true },
    orderBy: { date: 'desc' }
  });
}

/**
 * Fetch all templates
 */
export async function getTemplates() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.scheduleTemplate.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.scheduleTemplate.deleteMany({ where: { id, userId } });
  revalidatePath('/manage');
}

/**
 * Create a new template
 */
export async function createTemplate(data: {
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
}) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.scheduleTemplate.create({ 
    data: { ...data, userId } 
  });
  revalidatePath('/manage');
}

/**
 * Update an existing task (move day or change time)
 */
export async function updateTask(taskId: string, data: { date?: Date, startTime?: string, endTime?: string }) {
  const userId = await getUserId();
  if (!userId) return;

  const existing = await prisma.task.findUnique({
    where: { id: taskId }
  });

  if (existing?.userId !== userId) return;

  if (!existing) return;

  if (data.date) {
    data.date = startOfDay(data.date);

    if (existing.templateId && !isSameDay(existing.date, data.date)) {
      await prisma.task.updateMany({
        where: { id: taskId, userId },
        data: { isDeleted: true }
      });

      await prisma.task.create({
        data: {
          userId,
          templateId: existing.templateId,
          subject: existing.subject,
          type: existing.type,
          startTime: data.startTime || existing.startTime,
          endTime: data.endTime || existing.endTime,
          date: data.date,
          isDone: existing.isDone,
          isMissed: existing.isMissed,
          isDeleted: false
        }
      });

      revalidatePath('/');
      revalidatePath('/calendar');
      return;
    }
  }

  await prisma.task.updateMany({
    where: { id: taskId, userId },
    data
  });

  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Fetch marked days
 */
export async function getMarkedDays() {
  const userId = await getUserId();
  if (!userId) return [];

  const marked = await prisma.markedDay.findMany({ where: { userId } });
  return marked.map(m => m.date);
}

/**
 * Toggle marked day
 */
export async function toggleMarkedDay(date: Date, isMarked: boolean) {
  const userId = await getUserId();
  if (!userId) return;

  const normalizedDate = startOfDay(date);
  if (isMarked) {
    await prisma.markedDay.upsert({
      where: { userId_date: { userId, date: normalizedDate } },
      update: {},
      create: { userId, date: normalizedDate }
    });
  } else {
    await prisma.markedDay.deleteMany({ where: { userId, date: normalizedDate } });
  }
  revalidatePath('/calendar');
}

/**
 * Sync and fetch user streak
 */
export async function syncStreak() {
  const userId = await getUserId();
  if (!userId) return null;

  const today = startOfDay(getRwandaTime());
  let progress = await prisma.userProgress.findUnique({ where: { userId } });

  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today }
    });
    return { ...progress, streakIncreased: false, streakPaused: false };
  }

  // School break: once the marked last day of school has passed, freeze the
  // streak (no reset, no increment) until the user resumes.
  if (progress.schoolEndDate && today > startOfDay(progress.schoolEndDate)) {
    return { ...progress, streakIncreased: false, streakPaused: true };
  }

  const lastDate = progress.lastActiveDate ? startOfDay(progress.lastActiveDate) : null;
  let streakIncreased = false;
  let yesterdayStats = null;

  if (!lastDate) {
    progress = await prisma.userProgress.update({
      where: { userId },
      data: { currentStreak: 1, lastActiveDate: today }
    });
  } else if (!isSameDay(lastDate, today)) {
    const diff = differenceInDays(today, lastDate);
    let newStreak = 1;
    
    if (diff === 1) {
      newStreak = progress.currentStreak + 1;
      streakIncreased = true;
      await addXp(userId, 50 * newStreak); // Streak bonus
      
      // Fetch yesterday's stats for celebration
      const yesterday = addDays(today, -1);
      const yesterdayTasks = await prisma.task.findMany({
        where: { 
          userId, 
          date: { gte: startOfDay(yesterday), lte: endOfDay(yesterday) },
          isDeleted: false 
        }
      });
      
      const completed = yesterdayTasks.filter(t => t.isDone).length;
      const totalTime = yesterdayTasks
        .filter(t => t.isDone)
        .reduce((acc, t) => {
          const [sH, sM] = t.startTime.split(':').map(Number);
          const [eH, eM] = t.endTime.split(':').map(Number);
          let mins = (eH * 60 + eM) - (sH * 60 + sM);
          if (mins < 0) mins += 1440;
          return acc + mins;
        }, 0);

      yesterdayStats = {
        tasksCompleted: completed,
        totalTasks: yesterdayTasks.length,
        focusMinutes: totalTime,
        xpEarned: 50 * newStreak + (completed * 100) + (totalTime * 10)
      };
    }

    const newLongest = Math.max(newStreak, progress.longestStreak);
    progress = await prisma.userProgress.update({
      where: { userId },
      data: { currentStreak: newStreak, longestStreak: newLongest, lastActiveDate: today }
    });
  }

  return {
    ...progress,
    streakIncreased,
    yesterdayStats,
    streakPaused: false
  };
}

/**
 * Set (or clear) the user's marked "last day of school". Passing null clears it.
 * After this date passes, syncStreak freezes the streak until resumeStreak().
 */
export async function setSchoolEndDate(date: Date | null) {
  const userId = await getUserId();
  if (!userId) return;

  const value = date ? startOfDay(date) : null;
  await prisma.userProgress.upsert({
    where: { userId },
    update: { schoolEndDate: value },
    create: { userId, schoolEndDate: value, currentStreak: 0, longestStreak: 0 },
  });
  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/streak');
}

/**
 * Fetch the user's marked last day of school (or null).
 */
export async function getSchoolEndDate() {
  const userId = await getUserId();
  if (!userId) return null;

  const progress = await prisma.userProgress.findUnique({
    where: { userId },
    select: { schoolEndDate: true },
  });
  return progress?.schoolEndDate ?? null;
}

/**
 * Resume the streak after a school break: clear the break and roll the active
 * day forward to today so the streak continues from its frozen value.
 */
export async function resumeStreak() {
  const userId = await getUserId();
  if (!userId) return;

  const today = startOfDay(getRwandaTime());
  await prisma.userProgress.updateMany({
    where: { userId },
    data: { schoolEndDate: null, lastActiveDate: today },
  });
  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/streak');
}

/**
 * Fetch full settings data for a user
 */
export async function getSettingsData() {
  const userId = await getUserId();
  if (!userId) return null;

  const [user, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
        currentTerm: true,
      }
    }),
    syncStreak()
  ]);

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    currentTerm: user.currentTerm,
    progress
  };
}

/**
 * Update current term
 */
export async function updateCurrentTerm(term: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { currentTerm: term }
    });
    revalidatePath('/settings');
    revalidatePath('/marks');
    return { success: true };
  } catch (error) {
    return { error: "Failed to update term." };
  }
}


/**
 * Update an existing template
 */
export async function updateTemplate(id: string, data: {
  dayOfWeek?: number;
  subject?: string;
  startTime?: string;
  endTime?: string;
  deadlineDay?: string;
  type?: string;
}) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.scheduleTemplate.updateMany({ 
    where: { id, userId }, 
    data 
  });
  revalidatePath('/manage');
}

/**
 * Fetch unique subjects from templates, resources and mastery items
 */
export async function getUniqueSubjects() {
  const userId = await getUserId();
  if (!userId) return [];

  const [templates, resources, mastery, grades] = await Promise.all([
    prisma.scheduleTemplate.findMany({
      where: { userId },
      select: { subject: true }
    }),
    prisma.resource.findMany({
      where: { userId },
      select: { subject: true }
    }),
    prisma.masteryItem.findMany({
      where: { userId },
      select: { subject: true }
    }),
    prisma.subjectGrade.findMany({
      where: { reportCard: { userId } },
      select: { subject: true }
    })
  ]);

  const allSubjectNames = [
    ...templates.map(t => t.subject),
    ...resources.map(r => r.subject),
    ...mastery.map(m => m.subject),
    ...grades.map(g => g.subject)
  ];

  const normalizedSet = new Set(allSubjectNames.map(s => normalizeSubject(s)));
  return Array.from(normalizedSet).sort();
}
/**
 * Delete all materials for a subject (Resources & Mastery)
 */
export async function deleteSubject(subject: string) {
  const userId = await getUserId();
  if (!userId) return;

  const normalized = normalizeSubject(subject);
  
  // 1. Delete all resources (and files)
  const resources = await prisma.resource.findMany({
    where: { userId, subject: normalized }
  });

  for (const res of resources) {
    if (res.type === 'FILE') {
      await deleteUpload(res.url);
    }
  }

  await prisma.resource.deleteMany({
    where: { userId, subject: normalized }
  });

  // 2. Delete all mastery items
  await prisma.masteryItem.deleteMany({
    where: { userId, subject: normalized }
  });

  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(normalized)}`);
}

/**
 * Fetch resources for a subject
 */
export async function getResources(subject: string) {
  const userId = await getUserId();
  if (!userId) return [];

  const normalized = normalizeSubject(subject);
  return prisma.resource.findMany({
    where: { userId, subject: normalized },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Add a new resource
 */
export async function addResource(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return;

  const rawSubject = formData.get('subject') as string;
  const subject = normalizeSubject(rawSubject);
  const title = formData.get('title') as string;
  const type = formData.get('type') as 'LINK' | 'FILE';
  let url = '';

  if (type === 'LINK') {
    url = formData.get('url') as string;
  } else {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file uploaded');
    url = await saveUpload(file, 'resource');
  }

  await prisma.resource.create({ 
    data: { userId, subject, title, type, url } 
  });
  
  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(subject)}`);
  revalidatePath(`/focus`);
}

/**
 * Delete a resource
 */
export async function deleteResource(id: string, subject: string) {
  const userId = await getUserId();
  if (!userId) return;

  const normalized = normalizeSubject(subject);
  const resource = await prisma.resource.findFirst({ where: { id, userId } });
  if (resource && resource.type === 'FILE') {
    await deleteUpload(resource.url);
  }
  await prisma.resource.deleteMany({ where: { id, userId } });
  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(normalized)}`);
  revalidatePath(`/focus`);
}

/**
 * Fetch a specific task
 */
export async function getTaskById(id: string) {
  const userId = await getUserId();
  if (!userId) {
    console.error("getTaskById: No userId found");
    return null;
  }

  try {
    const task = await prisma.task.findFirst({ 
      where: { 
        id: id.trim(),
        userId: userId 
      }, 
      include: { template: true } 
    });

    if (!task) {
      console.error(`getTaskById: Task not found or ownership mismatch. ID: ${id}, UserID: ${userId}`);
      return null;
    }
    
    return task;
  } catch (error) {
    console.error("getTaskById error:", error);
    return null;
  }
}

/**
 * Fetch upcoming exam events
 */
export async function getEvents() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.examEvent.findMany({ 
    where: { userId },
    orderBy: { date: 'asc' } 
  });
}

/**
 * Fetch a single exam event by id (ownership-checked)
 */
export async function getEventById(id: string) {
  const userId = await getUserId();
  if (!userId) return null;

  return prisma.examEvent.findFirst({ where: { id, userId } });
}

/**
 * Fetch the study/revision sessions logged for a subject (most recent first).
 * Matches any task whose subject contains the normalized subject name, so
 * "Math" picks up both "Math" and "Math (revision)".
 */
export async function getSubjectSessions(subject: string) {
  const userId = await getUserId();
  if (!userId) return [];

  const normalized = normalizeSubject(subject);
  return prisma.task.findMany({
    where: {
      userId,
      subject: { contains: normalized },
      isDeleted: false,
    },
    orderBy: { date: 'desc' },
    take: 30,
  });
}

/**
 * Create an exam event
 */
export async function createEvent(data: { title: string, date: Date, priority: string }) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.examEvent.create({ 
    data: { ...data, userId, date: startOfDay(data.date) } 
  });
  revalidatePath('/');
}

/**
 * Delete an exam event
 */
export async function deleteEvent(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.examEvent.deleteMany({ where: { id, userId } });
  revalidatePath('/');
}

/**
 * Create a quick task
 */
export async function createQuickTask(data: { subject: string, startTime: string, endTime: string, type: string, date?: string | Date }) {
  const userId = await getUserId();
  if (!userId) return;

  // Add 3-minute prep buffer
  const [h, m] = data.startTime.split(':').map(Number);
  let startMins = h * 60 + m + 3;
  const newH = Math.floor(startMins / 60);
  const newM = startMins % 60;
  const adjustedStartTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;

  let date: Date;
  if (typeof data.date === 'string') {
    const [y, m, d] = data.date.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else if (data.date instanceof Date) {
    date = startOfDay(data.date);
  } else {
    date = startOfDay(getRwandaTime());
  }

  await prisma.task.create({
    data: { 
      userId, 
      subject: data.subject, 
      startTime: adjustedStartTime, 
      endTime: data.endTime, 
      type: data.type, 
      date, 
      isDone: false, 
      isMissed: false, 
      isDeleted: false 
    }
  });
  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Weekly Summaries Logic
 * ----------------------------------------------------------------------
 * The stored WeeklySummary keeps the canonical grade + totals for the PDF
 * transcript, but the page is rendered from a richer, recomputed metrics
 * object (study hours, consistency, completion, streaks, improvement and a
 * daily breakdown) so the analytics dashboard always reflects real data.
 */

/** Duration of a single task in minutes, handling past-midnight blocks. */
function taskMinutes(t: { startTime: string; endTime: string }): number {
  const [sH, sM] = t.startTime.split(':').map(Number);
  const [eH, eM] = t.endTime.split(':').map(Number);
  let mins = (eH * 60 + eM) - (sH * 60 + sM);
  if (mins < 0) mins += 1440;
  return Math.max(0, mins);
}

type WeekTask = {
  date: Date;
  startTime: string;
  endTime: string;
  subject: string;
  isDone: boolean;
};

/**
 * Computes all per-week analytics from the week's tasks.
 *
 * "Study hours" = SCHEDULED time (every block on the timetable). This is the
 * headline effort metric and what drives the grade's hours floor. Completion
 * (done vs. scheduled) is tracked separately as a quality factor.
 */
function computeWeekMetrics(weekTasks: WeekTask[], start: Date, prevScheduledMinutes: number | null) {
  const completed = weekTasks.filter(t => t.isDone);

  const scheduledMinutes = weekTasks.reduce((acc, t) => acc + taskMinutes(t), 0);
  const completedMinutes = completed.reduce((acc, t) => acc + taskMinutes(t), 0);

  // Effort distribution across subjects (all scheduled study time).
  const breakdown: Record<string, number> = {};
  weekTasks.forEach(t => {
    const s = normalizeSubject(t.subject);
    breakdown[s] = (breakdown[s] || 0) + taskMinutes(t);
  });

  // Daily scheduled minutes, Monday(0) .. Sunday(6).
  const dailyMinutes = [0, 0, 0, 0, 0, 0, 0];
  const activeDaySet = new Set<number>();
  weekTasks.forEach(t => {
    const idx = Math.min(6, Math.max(0, differenceInDays(startOfDay(new Date(t.date)), start)));
    dailyMinutes[idx] += taskMinutes(t);
    activeDaySet.add(idx);
  });

  // Longest run of consecutive active days within the week.
  let weekStreak = 0;
  let run = 0;
  for (let d = 0; d < 7; d++) {
    if (activeDaySet.has(d)) { run++; weekStreak = Math.max(weekStreak, run); }
    else run = 0;
  }

  const performance = computeWeeklyPerformance({
    studiedMinutes: scheduledMinutes,
    scheduledMinutes,
    completedSessions: completed.length,
    totalSessions: weekTasks.length,
    activeDays: activeDaySet.size,
    weekStreak,
    prevStudiedMinutes: prevScheduledMinutes,
  });

  return {
    performance,
    scheduledMinutes,
    completedMinutes,
    breakdown,
    dailyMinutes,
    activeDays: activeDaySet.size,
    weekStreak,
    completedSessions: completed.length,
    totalSessions: weekTasks.length,
  };
}

export type EnrichedWeeklySummary = {
  id: string;
  startDate: Date;
  endDate: Date;
  grade: string;
  score: number;
  totalMinutes: number;       // scheduled study minutes (headline hours)
  completedMinutes: number;   // minutes actually marked done
  scheduledMinutes: number;
  subjectBreakdown: string;   // JSON: subject -> scheduled minutes
  performance: WeeklyPerformance;
  dailyMinutes: number[];     // Mon..Sun scheduled minutes
  activeDays: number;
  weekStreak: number;
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
};

/**
 * Builds an enriched summary for a legacy week that has no surviving tasks,
 * by reusing the values stored on the WeeklySummary row (sanitized). Prevents
 * old cards from rendering blank.
 */
function enrichFromStored(
  s: { id: string; startDate: Date; endDate: Date; grade: string; totalMinutes: number; subjectBreakdown: string },
  currentStreak: number,
  longestStreak: number,
): EnrichedWeeklySummary {
  const storedMinutes = Math.max(0, s.totalMinutes || 0);
  let breakdown: Record<string, number> = {};
  try { breakdown = JSON.parse(s.subjectBreakdown) || {}; } catch { /* ignore */ }
  // Drop any corrupt (negative) entries.
  breakdown = Object.fromEntries(Object.entries(breakdown).filter(([, v]) => Number(v) > 0));
  const breakdownTotal = Object.values(breakdown).reduce((a, v) => a + Number(v), 0);
  const minutes = storedMinutes > 0 ? storedMinutes : breakdownTotal;

  const performance = computeWeeklyPerformance({
    studiedMinutes: minutes,
    scheduledMinutes: minutes,
    completedSessions: 0,
    totalSessions: 0,
    activeDays: 0,
    weekStreak: 0,
    prevStudiedMinutes: null,
  });

  return {
    id: s.id,
    startDate: s.startDate,
    endDate: s.endDate,
    grade: performance.grade,
    score: performance.score,
    totalMinutes: minutes,
    completedMinutes: minutes,
    scheduledMinutes: minutes,
    subjectBreakdown: JSON.stringify(breakdown),
    performance,
    dailyMinutes: [0, 0, 0, 0, 0, 0, 0],
    activeDays: 0,
    weekStreak: 0,
    completedSessions: 0,
    totalSessions: 0,
    currentStreak,
    longestStreak,
  };
}

export async function getWeeklySummaries(): Promise<EnrichedWeeklySummary[]> {
  const userId = await getUserId();
  if (!userId) return [];

  // Auto-sync persisted summaries for the last few weeks (for PDF/history).
  await syncWeeklySummaries();

  const [summaries, progress] = await Promise.all([
    prisma.weeklySummary.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);

  if (summaries.length === 0) return [];

  // Fetch every task across the full span of summaries in one query.
  const earliest = summaries[summaries.length - 1].startDate;
  const latest = summaries[0].endDate;
  const tasks = await prisma.task.findMany({
    where: { userId, date: { gte: earliest, lte: latest }, isDeleted: false },
    select: { date: true, startTime: true, endTime: true, subject: true, isDone: true },
  });

  // Scheduled minutes per week start (ISO date key) for improvement comparisons.
  const scheduledByWeek = new Map<string, number>();
  for (const s of summaries) {
    const start = startOfDay(new Date(s.startDate));
    const end = endOfDay(new Date(s.endDate));
    const wt = tasks.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
    scheduledByWeek.set(start.toISOString(), wt.reduce((acc, t) => acc + taskMinutes(t), 0));
  }

  const currentStreak = progress?.currentStreak ?? 0;
  const longestStreak = progress?.longestStreak ?? 0;

  return summaries.map((s): EnrichedWeeklySummary => {
    const start = startOfDay(new Date(s.startDate));
    const end = endOfDay(new Date(s.endDate));
    const weekTasks = tasks.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    // Legacy week with no surviving tasks: fall back to the stored row so the
    // card never renders blank.
    if (weekTasks.length === 0) {
      return enrichFromStored(s, currentStreak, longestStreak);
    }

    const prevKey = startOfDay(addDays(start, -7)).toISOString();
    const prevScheduled = scheduledByWeek.has(prevKey) ? scheduledByWeek.get(prevKey)! : null;

    const m = computeWeekMetrics(weekTasks, start, prevScheduled);

    return {
      id: s.id,
      startDate: s.startDate,
      endDate: s.endDate,
      grade: m.performance.grade,
      score: m.performance.score,
      totalMinutes: m.scheduledMinutes,
      completedMinutes: m.completedMinutes,
      scheduledMinutes: m.scheduledMinutes,
      subjectBreakdown: JSON.stringify(m.breakdown),
      performance: m.performance,
      dailyMinutes: m.dailyMinutes,
      activeDays: m.activeDays,
      weekStreak: m.weekStreak,
      completedSessions: m.completedSessions,
      totalSessions: m.totalSessions,
      currentStreak,
      longestStreak,
    };
  });
}

export async function syncWeeklySummaries() {
  const userId = await getUserId();
  if (!userId) return;

  const now = getRwandaTime();
  const currentMonday = startOfDay(addDays(now, -(now.getDay() === 0 ? 6 : now.getDay() - 1)));

  // Generate summaries for the last 4 weeks (excluding current week if it hasn't ended)
  for (let i = 1; i <= 4; i++) {
    const monday = addDays(currentMonday, -7 * i);
    await generateWeeklySummary(monday);
  }
}

export async function generateWeeklySummary(mondayDate: Date) {
  const userId = await getUserId();
  if (!userId) return null;

  const start = startOfDay(mondayDate);
  const end = endOfDay(addDays(start, 6));

  const weekTasks = await prisma.task.findMany({
    where: { userId, date: { gte: start, lte: end }, isDeleted: false },
    select: { date: true, startTime: true, endTime: true, subject: true, isDone: true },
  });
  if (weekTasks.length === 0) return null;

  // Compare against previous week's scheduled study time for the improvement signal.
  const prevStart = startOfDay(addDays(start, -7));
  const prevEnd = endOfDay(addDays(prevStart, 6));
  const prevTasks = await prisma.task.findMany({
    where: { userId, date: { gte: prevStart, lte: prevEnd }, isDeleted: false },
    select: { startTime: true, endTime: true },
  });
  const prevScheduledMinutes = prevTasks.length > 0
    ? prevTasks.reduce((acc, t) => acc + taskMinutes(t), 0)
    : null;

  const m = computeWeekMetrics(weekTasks, start, prevScheduledMinutes);

  return prisma.weeklySummary.upsert({
    where: { userId_startDate_endDate: { userId, startDate: start, endDate: end } },
    update: { grade: m.performance.grade, totalMinutes: m.scheduledMinutes, subjectBreakdown: JSON.stringify(m.breakdown) },
    create: { userId, startDate: start, endDate: end, grade: m.performance.grade, totalMinutes: m.scheduledMinutes, subjectBreakdown: JSON.stringify(m.breakdown) },
  });
}

/**
 * Daily Summaries Logic
 * ----------------------------------------------------------------------
 * Mirrors the weekly summary engine above but scoped to a single calendar
 * day. A summary is auto-generated once the user's chosen
 * `dailySummaryTime` has passed for "today"; recent days that have tasks
 * but no stored summary yet are backfilled the same way.
 */

type DayTask = {
  startTime: string;
  endTime: string;
  subject: string;
  isDone: boolean;
};

function computeDayMetrics(dayTasks: DayTask[], prevDayMinutes: number | null, currentStreak: number) {
  const completed = dayTasks.filter(t => t.isDone);

  const scheduledMinutes = dayTasks.reduce((acc, t) => acc + taskMinutes(t), 0);
  const completedMinutes = completed.reduce((acc, t) => acc + taskMinutes(t), 0);

  const breakdown: Record<string, number> = {};
  dayTasks.forEach(t => {
    const s = normalizeSubject(t.subject);
    breakdown[s] = (breakdown[s] || 0) + taskMinutes(t);
  });

  const performance = computeDailyPerformance({
    studiedMinutes: scheduledMinutes,
    completedSessions: completed.length,
    totalSessions: dayTasks.length,
    currentStreak,
    prevDayMinutes,
  });

  return {
    performance,
    scheduledMinutes,
    completedMinutes,
    breakdown,
    completedSessions: completed.length,
    totalSessions: dayTasks.length,
  };
}

export type EnrichedDailySummary = {
  id: string;
  date: Date;
  grade: string;
  score: number;
  totalMinutes: number;
  completedMinutes: number;
  subjectBreakdown: string;
  performance: WeeklyPerformance;
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
  tasks: { subject: string; startTime: string; endTime: string; isDone: boolean }[];
};

export async function getDailySummaries(): Promise<EnrichedDailySummary[]> {
  const userId = await getUserId();
  if (!userId) return [];

  await syncDailySummaries();

  const [summaries, progress] = await Promise.all([
    prisma.dailySummary.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 14 }),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);

  if (summaries.length === 0) return [];

  const currentStreak = progress?.currentStreak ?? 0;

  const earliest = summaries[summaries.length - 1].date;
  const latest = summaries[0].date;
  const tasks = await prisma.task.findMany({
    where: { userId, date: { gte: startOfDay(earliest), lte: endOfDay(latest) }, isDeleted: false },
    select: { date: true, startTime: true, endTime: true, subject: true, isDone: true },
    orderBy: { startTime: 'asc' },
  });

  const minutesByDay = new Map<string, number>();
  for (const t of tasks) {
    const key = startOfDay(new Date(t.date)).toISOString();
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + taskMinutes(t));
  }

  return summaries.map((s): EnrichedDailySummary => {
    const dayStart = startOfDay(new Date(s.date));
    const dayEnd = endOfDay(dayStart);
    const dayTasks = tasks.filter(t => {
      const d = new Date(t.date);
      return d >= dayStart && d <= dayEnd;
    });

    // Legacy day with no surviving tasks: fall back to the stored row so the
    // card never renders blank.
    if (dayTasks.length === 0) {
      const performance = computeDailyPerformance({
        studiedMinutes: s.totalMinutes, completedSessions: 0, totalSessions: 0, currentStreak, prevDayMinutes: null,
      });
      return {
        id: s.id, date: s.date, grade: performance.grade, score: performance.score,
        totalMinutes: s.totalMinutes, completedMinutes: s.completedMinutes, subjectBreakdown: s.subjectBreakdown,
        performance, completedSessions: 0, totalSessions: 0, currentStreak, tasks: [],
      };
    }

    const prevKey = startOfDay(addDays(dayStart, -1)).toISOString();
    const prevMinutes = minutesByDay.has(prevKey) ? minutesByDay.get(prevKey)! : null;

    const m = computeDayMetrics(dayTasks, prevMinutes, currentStreak);

    return {
      id: s.id,
      date: s.date,
      grade: m.performance.grade,
      score: m.performance.score,
      totalMinutes: m.scheduledMinutes,
      completedMinutes: m.completedMinutes,
      subjectBreakdown: JSON.stringify(m.breakdown),
      performance: m.performance,
      completedSessions: m.completedSessions,
      totalSessions: m.totalSessions,
      currentStreak,
      tasks: dayTasks.map(t => ({ subject: t.subject, startTime: t.startTime, endTime: t.endTime, isDone: t.isDone })),
    };
  });
}

export async function syncDailySummaries() {
  const userId = await getUserId();
  if (!userId) return;

  const progress = await prisma.userProgress.findUnique({ where: { userId }, select: { dailySummaryTime: true } });
  const summaryTime = progress?.dailySummaryTime || "21:00";
  const [sh, sm] = summaryTime.split(':').map(Number);

  const now = getRwandaTime();
  const today = startOfDay(now);
  const generationMoment = new Date(today);
  generationMoment.setHours(sh || 0, sm || 0, 0, 0);
  const includeToday = now >= generationMoment;

  // Backfill the last two weeks, plus today once its generation time has passed.
  for (let i = includeToday ? 0 : 1; i <= 13; i++) {
    await generateDailySummary(addDays(today, -i));
  }
}

export async function generateDailySummary(date: Date) {
  const userId = await getUserId();
  if (!userId) return null;

  const start = startOfDay(date);
  const end = endOfDay(start);

  const [dayTasks, prevTasks, progress] = await Promise.all([
    prisma.task.findMany({
      where: { userId, date: { gte: start, lte: end }, isDeleted: false },
      select: { startTime: true, endTime: true, subject: true, isDone: true },
    }),
    prisma.task.findMany({
      where: { userId, date: { gte: startOfDay(addDays(start, -1)), lte: endOfDay(addDays(start, -1)) }, isDeleted: false },
      select: { startTime: true, endTime: true },
    }),
    prisma.userProgress.findUnique({ where: { userId }, select: { currentStreak: true } }),
  ]);
  if (dayTasks.length === 0) return null;

  const prevMinutes = prevTasks.length > 0 ? prevTasks.reduce((acc, t) => acc + taskMinutes(t), 0) : null;
  const m = computeDayMetrics(dayTasks, prevMinutes, progress?.currentStreak ?? 0);

  return prisma.dailySummary.upsert({
    where: { userId_date: { userId, date: start } },
    update: { grade: m.performance.grade, totalMinutes: m.scheduledMinutes, completedMinutes: m.completedMinutes, subjectBreakdown: JSON.stringify(m.breakdown) },
    create: { userId, date: start, grade: m.performance.grade, totalMinutes: m.scheduledMinutes, completedMinutes: m.completedMinutes, subjectBreakdown: JSON.stringify(m.breakdown) },
  });
}

/**
 * Updates the local time-of-day ("HH:MM") at which the daily summary should
 * auto-generate. Validated as a strict 24h time string.
 */
export async function updateDailySummaryTime(time: string) {
  const userId = await getUserId();
  if (!userId) return;
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) return;

  await prisma.userProgress.upsert({
    where: { userId },
    update: { dailySummaryTime: time },
    create: { userId, dailySummaryTime: time },
  });
  revalidatePath('/daily-summary');
}

/**
 * Overall (lifetime) Summary
 * ----------------------------------------------------------------------
 * Computed on demand (not persisted) when the user clicks "Generate Overall
 * Summary". The grade reflects the AVERAGE weekly performance across the
 * user's entire tracked history, so the existing weekly grading scale stays
 * meaningful instead of needing a third set of thresholds.
 */
export type OverallSummary = {
  grade: string;
  score: number;
  totalMinutes: number;
  completedMinutes: number;
  subjectBreakdown: string;
  performance: WeeklyPerformance;
  weekdayMinutes: number[]; // Mon..Sun, lifetime totals
  activeDays: number;
  totalDaysSpanned: number;
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  firstDate: Date;
  lastDate: Date;
};

export async function getOverallSummary(): Promise<OverallSummary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const [tasks, progress] = await Promise.all([
    prisma.task.findMany({
      where: { userId, isDeleted: false },
      select: { date: true, startTime: true, endTime: true, subject: true, isDone: true },
      orderBy: { date: 'asc' },
    }),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);
  if (tasks.length === 0) return null;

  const completed = tasks.filter(t => t.isDone);
  const scheduledMinutes = tasks.reduce((acc, t) => acc + taskMinutes(t), 0);
  const completedMinutes = completed.reduce((acc, t) => acc + taskMinutes(t), 0);

  const breakdown: Record<string, number> = {};
  const weekdayMinutes = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
  const activeDaySet = new Set<string>();
  tasks.forEach(t => {
    const s = normalizeSubject(t.subject);
    breakdown[s] = (breakdown[s] || 0) + taskMinutes(t);

    const d = new Date(t.date);
    const jsDay = d.getDay(); // 0=Sun..6=Sat
    weekdayMinutes[jsDay === 0 ? 6 : jsDay - 1] += taskMinutes(t);
    activeDaySet.add(startOfDay(d).toISOString());
  });

  const firstDate = tasks[0].date;
  const lastDate = tasks[tasks.length - 1].date;
  const totalDaysSpanned = Math.max(1, differenceInDays(startOfDay(new Date(lastDate)), startOfDay(new Date(firstDate))) + 1);
  const weeks = Math.max(1, totalDaysSpanned / 7);

  const currentStreak = progress?.currentStreak ?? 0;
  const longestStreak = progress?.longestStreak ?? 0;

  const performance = computeWeeklyPerformance({
    studiedMinutes: scheduledMinutes / weeks,
    scheduledMinutes: scheduledMinutes / weeks,
    completedSessions: completed.length,
    totalSessions: tasks.length,
    activeDays: Math.min(7, Math.round(activeDaySet.size / weeks)),
    weekStreak: Math.min(7, longestStreak),
    prevStudiedMinutes: null,
  });

  return {
    grade: performance.grade,
    score: performance.score,
    totalMinutes: scheduledMinutes,
    completedMinutes,
    subjectBreakdown: JSON.stringify(breakdown),
    performance,
    weekdayMinutes,
    activeDays: activeDaySet.size,
    totalDaysSpanned,
    completedSessions: completed.length,
    totalSessions: tasks.length,
    currentStreak,
    longestStreak,
    firstDate,
    lastDate,
  };
}

/**
 * Fetch mastery items for a subject
 */
export async function getMasteryItems(subject: string) {
  const userId = await getUserId();
  if (!userId) return [];

  const normalized = normalizeSubject(subject);
  return prisma.masteryItem.findMany({
    where: { userId, subject: normalized },
    orderBy: { createdAt: 'asc' }
  });
}

/**
 * Add a new mastery item
 */
export async function addMasteryItem(subject: string, title: string) {
  const userId = await getUserId();
  if (!userId) return;

  const normalized = normalizeSubject(subject);
  await prisma.masteryItem.create({
    data: {
      userId,
      subject: normalized,
      title,
      isCompleted: false
    }
  });
  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(normalized)}`);
  revalidatePath('/exams/[examId]', 'page');
}

/**
 * Toggle mastery item completion
 */
export async function toggleMasteryItem(id: string, isCompleted: boolean, subject: string) {
  const userId = await getUserId();
  if (!userId) return;

  const normalized = normalizeSubject(subject);
  await prisma.masteryItem.updateMany({
    where: { id, userId },
    data: { isCompleted }
  });
  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(normalized)}`);
  revalidatePath('/exams/[examId]', 'page');
}

/**
 * Delete a mastery item
 */
export async function deleteMasteryItem(id: string, subject: string) {
  const userId = await getUserId();
  if (!userId) return;

  const normalized = normalizeSubject(subject);
  await prisma.masteryItem.deleteMany({ where: { id, userId } });
  revalidatePath('/resources');
  revalidatePath(`/resources/${encodeURIComponent(normalized)}`);
  revalidatePath('/exams/[examId]', 'page');
}

/**
 * Update user profile name
 */
export async function updateUserName(name: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.userProgress.upsert({
    where: { userId },
    update: { name },
    create: { userId, name }
  });
  revalidatePath('/');
}

/**
 * Update Gemini API Key
 */
export async function updateGeminiKey(key: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.userProgress.upsert({
    where: { userId },
    update: { geminiApiKey: key },
    create: { userId, geminiApiKey: key }
  });
  revalidatePath('/settings');
  revalidatePath('/ai');
}

/**
 * DEBUG/MAINTENANCE: Clear all tasks
 */
export async function clearAllTasks() {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.task.deleteMany({ where: { userId } });
  revalidatePath('/');
  revalidatePath('/calendar');
}

/**
 * Log a focus session completion
 */
export async function logFocusSession(durationMinutes: number, earnedXp: number) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.userProgress.upsert({
    where: { userId },
    update: {
      focusSessions: { increment: 1 },
      totalFocusMinutes: { increment: durationMinutes }
    },
    create: {
      userId,
      focusSessions: 1,
      totalFocusMinutes: durationMinutes
    },
  });

  // Grant the exact XP earned during the session
  await addXp(userId, earnedXp);

  revalidatePath('/history');
}

/**
 * Sticky Notes Actions
 */
export async function getStickyNotes() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.stickyNote.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createStickyNote(title: string, content: string, color: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const note = await prisma.stickyNote.create({
    data: { userId, title, content, color }
  });
  revalidatePath('/notes');
  return note;
}

export async function updateStickyNote(id: string, data: { title?: string, content?: string, color?: string, isDone?: boolean }) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.stickyNote.updateMany({
    where: { id, userId },
    data
  });
  revalidatePath('/notes');
}

export async function toggleStickyNoteDone(id: string, isDone: boolean) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.stickyNote.updateMany({
    where: { id, userId },
    data: { isDone }
  });
  revalidatePath('/notes');
}

export async function updateStickyNotePosition(id: string, x: number, y: number) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.stickyNote.updateMany({
    where: { id, userId },
    data: { x, y }
  });
  // Note: We don't revalidatePath here to avoid jarring UI resets during active dragging.
  // The UI is optimistic.
}

export async function deleteStickyNote(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.stickyNote.deleteMany({
    where: { id, userId }
  });
  revalidatePath('/notes');
}

export async function clearAllStickyNotes() {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.stickyNote.deleteMany({
    where: { userId }
  });
  revalidatePath('/notes');
}

/**
 * Universal Search Action
 */
export async function universalSearch(query: string) {
  const userId = await getUserId();
  if (!userId || !query || query.length < 2) return { 
    tasks: [], stickyNotes: [], tutorModules: [], projects: [], homeworks: [] 
  };

  const [tasks, stickyNotes, tutorModules, projects, homeworks] = await Promise.all([
    prisma.task.findMany({
      where: { userId, subject: { contains: query } },
      take: 5
    }),
    prisma.stickyNote.findMany({
      where: { 
        userId, 
        OR: [
          { title: { contains: query } },
          { content: { contains: query } }
        ] 
      },
      take: 5
    }),
    prisma.tutorModule.findMany({
      where: { 
        userId, 
        OR: [
          { title: { contains: query } },
          { subject: { contains: query } },
          { notes: { contains: query } }
        ] 
      },
      take: 5
    }),
    prisma.project.findMany({
      where: { userId, title: { contains: query } },
      take: 5
    }),
    prisma.homework.findMany({
      where: { 
        userId, 
        OR: [
          { title: { contains: query } },
          { subject: { contains: query } }
        ] 
      },
      take: 5
    })
  ]);

  return { tasks, stickyNotes, tutorModules, projects, homeworks };
}

/**
 * DATA PORTABILITY: Export all user-specific data to JSON format
 */
export async function exportUserData() {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        currentTerm: true,
        progress: true,
        templates: true,
        tasks: true,
        resources: true,
        examEvents: true,
        markedDays: true,
        stickyNotes: true,
        studioNotes: true,
        homeworks: true,
        projects: true,
        tutorModules: true,
      }
    });

    if (!user) return { error: "User not found" };

    return {
      success: true,
      data: {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        username: user.username,
        currentTerm: user.currentTerm,
        progress: user.progress ? {
          name: user.progress.name,
          geminiApiKey: user.progress.geminiApiKey,
          focusSessions: user.progress.focusSessions,
          totalFocusMinutes: user.progress.totalFocusMinutes,
          xp: user.progress.xp,
          level: user.progress.level,
          currentStreak: user.progress.currentStreak,
          longestStreak: user.progress.longestStreak,
        } : null,
        templates: user.templates.map(t => ({
          dayOfWeek: t.dayOfWeek,
          subject: t.subject,
          startTime: t.startTime,
          endTime: t.endTime,
          deadlineDay: t.deadlineDay,
          type: t.type
        })),
        tasks: user.tasks.map(t => ({
          date: t.date.toISOString(),
          startTime: t.startTime,
          endTime: t.endTime,
          subject: t.subject,
          isDone: t.isDone,
          isMissed: t.isMissed,
          isDeleted: t.isDeleted,
          type: t.type,
          workDescription: t.workDescription,
          proofPdfUrl: t.proofPdfUrl
        })),
        resources: user.resources.map(r => ({
          subject: r.subject,
          title: r.title,
          type: r.type,
          url: r.url
        })),
        examEvents: user.examEvents.map(e => ({
          title: e.title,
          date: e.date.toISOString(),
          priority: e.priority
        })),
        markedDays: user.markedDays.map(m => ({
          date: m.date.toISOString()
        })),
        stickyNotes: user.stickyNotes.map(s => ({
          title: s.title,
          content: s.content,
          color: s.color,
          isDone: s.isDone,
          x: s.x,
          y: s.y
        })),
        studioNotes: user.studioNotes.map(n => ({
          subject: n.subject,
          content: n.content
        })),
        homeworks: user.homeworks.map(h => ({
          subject: h.subject,
          title: h.title,
          description: h.description,
          dueDate: h.dueDate.toISOString(),
          plannedDate: h.plannedDate ? h.plannedDate.toISOString() : null,
          isCompleted: h.isCompleted,
          completedAt: h.completedAt ? h.completedAt.toISOString() : null,
          proofUrl: h.proofUrl
        })),
        projects: user.projects.map(p => ({
          title: p.title,
          description: p.description,
          status: p.status,
          progress: p.progress
        }))
      }
    };
  } catch (error: any) {
    console.error("Export failed:", error);
    return { error: `Export failed: ${error.message}` };
  }
}

/**
 * DATA PORTABILITY: Import and restore all user-specific data from JSON
 */
export async function importUserData(importData: any) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    if (!importData || typeof importData !== 'object') {
      return { error: "Invalid import format." };
    }

    const { 
      currentTerm, 
      progress, 
      templates, 
      tasks, 
      resources, 
      examEvents, 
      markedDays, 
      stickyNotes, 
      studioNotes,
      homeworks,
      projects
    } = importData;

    await prisma.$transaction(async (tx) => {
      // 1. Update user settings
      if (currentTerm) {
        await tx.user.update({
          where: { id: userId },
          data: { currentTerm }
        });
      }

      // 2. Update UserProgress
      if (progress) {
        await tx.userProgress.upsert({
          where: { userId },
          update: {
            name: progress.name || "Student",
            geminiApiKey: progress.geminiApiKey || null,
            focusSessions: progress.focusSessions || 0,
            totalFocusMinutes: progress.totalFocusMinutes || 0,
            xp: progress.xp || 0,
            level: progress.level || 1,
            currentStreak: progress.currentStreak || 0,
            longestStreak: progress.longestStreak || 0,
          },
          create: {
            userId,
            name: progress.name || "Student",
            geminiApiKey: progress.geminiApiKey || null,
            focusSessions: progress.focusSessions || 0,
            totalFocusMinutes: progress.totalFocusMinutes || 0,
            xp: progress.xp || 0,
            level: progress.level || 1,
            currentStreak: progress.currentStreak || 0,
            longestStreak: progress.longestStreak || 0,
          }
        });
      }

      // 3. Import Templates
      if (Array.isArray(templates)) {
        await tx.scheduleTemplate.deleteMany({ where: { userId } });
        for (const t of templates) {
          await tx.scheduleTemplate.create({
            data: {
              userId,
              dayOfWeek: t.dayOfWeek,
              subject: t.subject,
              startTime: t.startTime,
              endTime: t.endTime,
              deadlineDay: t.deadlineDay,
              type: t.type
            }
          });
        }
      }

      // 4. Import Tasks
      if (Array.isArray(tasks)) {
        await tx.task.deleteMany({ where: { userId } });
        for (const t of tasks) {
          await tx.task.create({
            data: {
              userId,
              date: new Date(t.date),
              startTime: t.startTime,
              endTime: t.endTime,
              subject: t.subject,
              isDone: t.isDone || false,
              isMissed: t.isMissed || false,
              isDeleted: t.isDeleted || false,
              type: t.type,
              workDescription: t.workDescription || null,
              proofPdfUrl: t.proofPdfUrl || null
            }
          });
        }
      }

      // 5. Import Resources
      if (Array.isArray(resources)) {
        await tx.resource.deleteMany({ where: { userId } });
        for (const r of resources) {
          await tx.resource.create({
            data: {
              userId,
              subject: r.subject,
              title: r.title,
              type: r.type,
              url: r.url
            }
          });
        }
      }

      // 6. Import ExamEvents
      if (Array.isArray(examEvents)) {
        await tx.examEvent.deleteMany({ where: { userId } });
        for (const e of examEvents) {
          await tx.examEvent.create({
            data: {
              userId,
              title: e.title,
              date: new Date(e.date),
              priority: e.priority || "NORMAL"
            }
          });
        }
      }

      // 7. Import MarkedDays
      if (Array.isArray(markedDays)) {
        await tx.markedDay.deleteMany({ where: { userId } });
        for (const m of markedDays) {
          await tx.markedDay.create({
            data: {
              userId,
              date: new Date(m.date)
            }
          });
        }
      }

      // 8. Import StickyNotes
      if (Array.isArray(stickyNotes)) {
        await tx.stickyNote.deleteMany({ where: { userId } });
        for (const s of stickyNotes) {
          await tx.stickyNote.create({
            data: {
              userId,
              title: s.title,
              content: s.content,
              color: s.color,
              isDone: s.isDone || false,
              x: s.x || 0,
              y: s.y || 0
            }
          });
        }
      }

      // 9. Import StudioNotes
      if (Array.isArray(studioNotes)) {
        await tx.studioNote.deleteMany({ where: { userId } });
        for (const n of studioNotes) {
          await tx.studioNote.create({
            data: {
              userId,
              subject: n.subject,
              content: n.content
            }
          });
        }
      }

      // 10. Import Homeworks
      if (Array.isArray(homeworks)) {
        await tx.homework.deleteMany({ where: { userId } });
        for (const h of homeworks) {
          await tx.homework.create({
            data: {
              userId,
              subject: h.subject,
              title: h.title,
              description: h.description || null,
              dueDate: new Date(h.dueDate),
              plannedDate: h.plannedDate ? new Date(h.plannedDate) : null,
              isCompleted: h.isCompleted || false,
              completedAt: h.completedAt ? new Date(h.completedAt) : null,
              proofUrl: h.proofUrl || null
            }
          });
        }
      }

      // 11. Import Projects
      if (Array.isArray(projects)) {
        await tx.project.deleteMany({ where: { userId } });
        for (const p of projects) {
          await tx.project.create({
            data: {
              userId,
              title: p.title,
              description: p.description || null,
              status: p.status || "ACTIVE",
              progress: p.progress || 0
            }
          });
        }
      }
    });

    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/manage');
    revalidatePath('/settings');
    revalidatePath('/history');
    revalidatePath('/marks');
    return { success: true };
  } catch (error: any) {
    console.error("Import failed:", error);
    return { error: `Import failed: ${error.message}` };
  }
}

/**
 * MAINTENANCE: Verify integrity and count objects in SQLite database
 */
export async function verifyDbIntegrity() {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    const [userCount, taskCount, templateCount, homeworkCount, projectCount] = await Promise.all([
      prisma.user.count(),
      prisma.task.count({ where: { userId } }),
      prisma.scheduleTemplate.count({ where: { userId } }),
      prisma.homework.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
    ]);

    return {
      success: true,
      details: {
        connected: true,
        provider: "sqlite",
        users: userCount,
        tasks: taskCount,
        templates: templateCount,
        homeworks: homeworkCount,
        projects: projectCount
      }
    };
  } catch (error: any) {
    console.error("Integrity validation failed:", error);
    return { error: `Integrity verification failed: ${error.message}` };
  }
}
