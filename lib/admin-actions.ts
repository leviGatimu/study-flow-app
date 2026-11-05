'use server';

/**
 * The admin view of the deployment.
 *
 * THE ONE RULE HERE
 * -----------------
 * Every exported function calls requireAdmin() itself. Not the page, not a
 * layout, not middleware - each function, every time. A route guard protects a
 * URL; these are server actions, and a server action is an HTTP endpoint that
 * anyone who can read the page's JavaScript can call directly with any
 * arguments they like. Guarding /admin and trusting the actions behind it would
 * mean any signed-in student could read every other student's notes by calling
 * getAdminUser with an id they guessed.
 *
 * WHAT AN ADMIN CAN SEE
 * ---------------------
 * Everything, by the deployment owner's explicit decision: full content of any
 * account, not just metadata. That is a real power over six other people's
 * private work, so it is at least made visible rather than silent - the UI says
 * whose data is on screen, and admin rights can only be granted by another
 * admin or by scripts/make-admin.mjs, which needs database access.
 *
 * WHAT AN ADMIN CANNOT DO
 * -----------------------
 * Lock the deployment out of itself. You cannot remove your own admin rights
 * and you cannot delete your own account from here; both are how a system ends
 * up with no administrator and no way to appoint one without a database client.
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';

import { collectAdminMetrics, hasAdminRole } from './admin-metrics';
import {
  fetchAdminReport,
  type AdminSource,
  type AdminContentKind,
} from './admin-remote';
import { UPLOAD_DIR, usesRemoteStorage } from './upload';
import { prisma, IS_SQLITE } from '@/lib/prisma';
import { getUserId, userIdFromBearer } from '@/lib/auth';

/** The caller's id if they are an admin, otherwise null. */
const adminId = cache(async function adminId(): Promise<string | null> {
  const userId =
    (await userIdFromBearer((await headers()).get('authorization'))) ??
    (await getUserId());
  return (await hasAdminRole(prisma, userId)) ? userId : null;
});

async function adminConnection() {
  const userId = await requireAdmin();
  if (!IS_SQLITE) return null;
  const state = await prisma.syncState.findFirst({
    where: { userId, serverUrl: { not: null }, token: { not: null } },
    select: { serverUrl: true, token: true },
  });
  return state?.serverUrl && state.token
    ? { serverUrl: state.serverUrl, token: state.token }
    : null;
}

export type AdminConsole = {
  overview: AdminOverview;
  users: AdminUserRow[];
  health: SystemHealth;
  source: AdminSource;
};

export async function getAdminConsole(
  deviceOnly = false,
): Promise<AdminConsole> {
  await requireAdmin();
  const connection = !deviceOnly && (await adminConnection());
  if (connection) {
    const result = await fetchAdminReport<AdminConsole>(connection, {
      operation: 'snapshot',
    });
    return {
      ...result,
      source: {
        ...result.source,
        mode: 'server',
        serverUrl: connection.serverUrl,
      },
    };
  }
  const [overview, users, health] = await Promise.all([
    getAdminOverview(),
    getAdminUsers(),
    getSystemHealth(),
  ]);
  return {
    overview,
    users,
    health,
    source: {
      mode: IS_SQLITE ? 'device' : 'web',
      serverUrl: null,
      checkedAt: new Date(),
    },
  };
}

export async function getAdminSource(deviceOnly = false): Promise<AdminSource> {
  await requireAdmin();
  const connection = !deviceOnly && (await adminConnection());
  return {
    mode: connection ? 'server' : IS_SQLITE ? 'device' : 'web',
    serverUrl: connection ? connection.serverUrl : null,
    checkedAt: new Date(),
  };
}

/** Throwing guard for the read paths, so a non-admin gets nothing at all. */
async function requireAdmin(): Promise<string> {
  const id = await adminId();
  if (!id) throw new Error('Not authorised.');
  return id;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await adminId()) !== null;
}

/* ------------------------------------------------------------------ overview */

export type AdminOverview = {
  totals: {
    users: number;
    tasks: number;
    subjects: number;
    exams: number;
    homework: number;
    notes: number;
    aiSessions: number;
    focusMinutes: number;
  } & Awaited<ReturnType<typeof collectAdminMetrics>>;
  storageBackend: 'object' | 'disk';

  activeLast7: number;
  activeLast30: number;
  neverActive: number;
  aiConfigured: number;
  onboardingIncomplete: number;
  syncDevices: number;
  /** Signups per month, oldest first. */
  signups: { month: string; count: number }[];
  storage: { uploadsBytes: number; fileCount: number } | null;
};

/**
 * Recursive size of a directory, or null if it is not there.
 *
 * Walked rather than cached: uploads is the one thing on this box that grows
 * without limit - it was 71 MB of one student's PDFs and photographs when it
 * leaked into an installer - so the number has to be current to be worth
 * showing at all.
 */
async function directorySize(
  dir: string,
): Promise<{ uploadsBytes: number; fileCount: number } | null> {
  let uploadsBytes = 0;
  let fileCount = 0;

  async function walk(path: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      return; // missing or unreadable: not an error worth failing the page for
    }
    for (const entry of entries) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        try {
          const info = await stat(full);
          uploadsBytes += info.size;
          fileCount++;
        } catch {
          // vanished between readdir and stat; nothing to count
        }
      }
    }
  }

  try {
    await stat(dir);
  } catch {
    return null;
  }
  await walk(dir);
  return { uploadsBytes, fileCount };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 86400000);

  const [
    users,
    tasks,
    subjects,
    exams,
    homework,
    notes,
    aiSessions,
    progressRows,
    syncDevices,
    userRows,
    metrics,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.task.count({ where: { isDeleted: false } }),
    prisma.subject.count(),
    prisma.examEvent.count(),
    prisma.homework.count(),
    prisma.studioNote.count(),
    prisma.chatSession.count(),
    prisma.userProgress.findMany({
      select: {
        lastActiveDate: true,
        totalFocusMinutes: true,
        geminiApiKey: true,
        openaiApiKey: true,
        ollamaEnabled: true,
        setupCompletedAt: true,
        onboardedAt: true,
      },
    }),
    prisma.syncState.count(),
    prisma.user.findMany({ select: { createdAt: true } }),
    collectAdminMetrics(prisma),
  ]);

  const signupsByMonth = new Map<string, number>();
  for (const u of userRows) {
    const key = `${u.createdAt.getUTCFullYear()}-${String(u.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
    signupsByMonth.set(key, (signupsByMonth.get(key) ?? 0) + 1);
  }

  return {
    totals: {
      ...metrics,
      users,
      tasks,
      subjects,
      exams,
      homework,
      notes,
      aiSessions,
      focusMinutes: progressRows.reduce(
        (sum, p) => sum + (p.totalFocusMinutes ?? 0),
        0,
      ),
    },
    activeLast7: progressRows.filter(
      (p) => p.lastActiveDate && p.lastActiveDate >= days(7),
    ).length,
    activeLast30: progressRows.filter(
      (p) => p.lastActiveDate && p.lastActiveDate >= days(30),
    ).length,
    neverActive: users - progressRows.filter((p) => p.lastActiveDate).length,
    aiConfigured: progressRows.filter(
      (p) => p.geminiApiKey || p.openaiApiKey || p.ollamaEnabled,
    ).length,
    onboardingIncomplete: progressRows.filter(
      (p) => !p.onboardedAt || !p.setupCompletedAt,
    ).length,
    syncDevices,
    signups: [...signupsByMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    storageBackend: usesRemoteStorage() ? 'object' : 'disk',
    storage: usesRemoteStorage() ? null : await directorySize(UPLOAD_DIR),
  };
}

/* --------------------------------------------------------------------- users */

export type AdminUserRow = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
  name: string | null;
  school: string | null;
  lastActiveDate: Date | null;
  currentStreak: number;
  xp: number;
  level: number;
  timezone: string;
  /** Support at a glance: why is this person stuck? */
  hasAi: boolean;
  finishedSetup: boolean;
  sawTour: boolean;
  counts: {
    subjects: number;
    tasks: number;
    templates: number;
    exams: number;
    notes: number;
  };
  devices: number;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      progress: {
        select: {
          name: true,
          school: true,
          lastActiveDate: true,
          currentStreak: true,
          xp: true,
          level: true,
          timezone: true,
          geminiApiKey: true,
          openaiApiKey: true,
          ollamaEnabled: true,
          setupCompletedAt: true,
          onboardedAt: true,
        },
      },
      _count: {
        select: {
          subjects: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null, isDeleted: false } },
          templates: { where: { deletedAt: null } },
          examEvents: { where: { deletedAt: null } },
          studioNotes: { where: { deletedAt: null } },
        },
      },
    },
  });

  // One grouped query rather than one per user: this list is small today and
  // must not become N+1 the day it is not.
  const deviceRows = await prisma.syncState.groupBy({
    by: ['userId'],
    _count: { _all: true },
  });
  const devices = new Map(deviceRows.map((d) => [d.userId, d._count._all]));

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
    name: u.progress?.name ?? null,
    school: u.progress?.school ?? null,
    lastActiveDate: u.progress?.lastActiveDate ?? null,
    currentStreak: u.progress?.currentStreak ?? 0,
    xp: u.progress?.xp ?? 0,
    level: u.progress?.level ?? 1,
    timezone: u.progress?.timezone ?? '—',
    hasAi: Boolean(
      u.progress?.geminiApiKey ||
        u.progress?.openaiApiKey ||
        u.progress?.ollamaEnabled,
    ),
    finishedSetup: Boolean(u.progress?.setupCompletedAt),
    sawTour: Boolean(u.progress?.onboardedAt),
    counts: {
      subjects: u._count.subjects,
      tasks: u._count.tasks,
      templates: u._count.templates,
      exams: u._count.examEvents,
      notes: u._count.studioNotes,
    },
    devices: devices.get(u.id) ?? 0,
  }));
}

export type AdminUserDetail = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
  /** Never the key itself - only whether one is set, and its last four. */
  aiKeys: { gemini: string | null; openai: string | null; ollama: boolean };
  progress: {
    name: string;
    school: string | null;
    bio: string | null;
    timezone: string;
    currentStreak: number;
    longestStreak: number;
    xp: number;
    level: number;
    focusSessions: number;
    totalFocusMinutes: number;
    lastActiveDate: Date | null;
    onboardedAt: Date | null;
    setupCompletedAt: Date | null;
  } | null;
  classes: {
    id: string;
    label: string;
    status: string;
    startedAt: Date;
    terms: {
      id: string;
      name: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
    }[];
  }[];
  counts: Record<string, number>;
  devices: {
    deviceId: string;
    lastSyncAt: Date | null;
    lastError: string | null;
    lastPushed: number;
    lastPulled: number;
  }[];
  recentTasks: {
    id: string;
    date: Date;
    subject: string;
    type: string;
    isDone: boolean;
  }[];
  subjects: string[];
};

export async function getAdminUser(
  userId: string,
  deviceOnly = false,
): Promise<AdminUserDetail | null> {
  await requireAdmin();

  const connection = !deviceOnly && (await adminConnection());
  if (connection)
    return fetchAdminReport<AdminUserDetail | null>(connection, {
      operation: 'user',
      userId,
    });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, isAdmin: true, createdAt: true },
  });
  if (!user) return null;

  const [progress, classes, devices, recentTasks, subjects, counts] =
    await Promise.all([
      prisma.userProgress.findUnique({
        where: { userId },
        select: {
          name: true,
          school: true,
          bio: true,
          timezone: true,
          currentStreak: true,
          longestStreak: true,
          xp: true,
          level: true,
          focusSessions: true,
          totalFocusMinutes: true,
          lastActiveDate: true,
          onboardedAt: true,
          setupCompletedAt: true,
          geminiApiKey: true,
          openaiApiKey: true,
          ollamaEnabled: true,
        },
      }),
      prisma.class.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          label: true,
          status: true,
          startedAt: true,
          terms: {
            orderBy: { index: 'asc' },
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
      prisma.syncState.findMany({
        where: { userId },
        select: {
          deviceId: true,
          lastSyncAt: true,
          lastError: true,
          lastPushed: true,
          lastPulled: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { userId, isDeleted: false },
        orderBy: { date: 'desc' },
        take: 15,
        select: {
          id: true,
          date: true,
          subject: true,
          type: true,
          isDone: true,
        },
      }),
      prisma.subject.findMany({
        where: { userId },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      Promise.all([
        prisma.task.count({ where: { userId, isDeleted: false } }),
        prisma.scheduleTemplate.count({ where: { userId } }),
        prisma.schoolLesson.count({ where: { userId } }),
        prisma.homework.count({ where: { userId } }),
        prisma.examEvent.count({ where: { userId } }),
        prisma.studioNote.count({ where: { userId } }),
        prisma.stickyNote.count({ where: { userId } }),
        prisma.chatSession.count({ where: { userId } }),
        prisma.reportCard.count({ where: { userId } }),
        prisma.project.count({ where: { userId } }),
        prisma.resource.count({ where: { userId } }),
        prisma.song.count({ where: { userId } }),
        prisma.tutorModule.count({ where: { userId } }),
        prisma.quizAttempt.count({
          where: { module: { userId, deletedAt: null } },
        }),
        prisma.attemptDraft.count({
          where: { userId, module: { deletedAt: null } },
        }),
        prisma.xpEvent.count({
          where: { userId, source: 'FOCUS', focusSeconds: { not: null } },
        }),
      ]),
    ]);

  const [
    tasks,
    templates,
    lessons,
    homework,
    exams,
    studioNotes,
    stickyNotes,
    aiSessions,
    reportCards,
    projects,
    resources,
    songs,
    practiceSets,
    attempts,
    drafts,
    measuredFocusSessions,
  ] = counts;

  const last4 = (key: string | null | undefined) =>
    key ? `…${key.slice(-4)}` : null;

  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    aiKeys: {
      gemini: last4(progress?.geminiApiKey),
      openai: last4(progress?.openaiApiKey),
      ollama: Boolean(progress?.ollamaEnabled),
    },
    progress: progress
      ? {
          name: progress.name,
          school: progress.school,
          bio: progress.bio,
          timezone: progress.timezone,
          currentStreak: progress.currentStreak,
          longestStreak: progress.longestStreak,
          xp: progress.xp,
          level: progress.level,
          focusSessions: progress.focusSessions,
          totalFocusMinutes: progress.totalFocusMinutes,
          lastActiveDate: progress.lastActiveDate,
          onboardedAt: progress.onboardedAt,
          setupCompletedAt: progress.setupCompletedAt,
        }
      : null,
    classes,
    counts: {
      tasks,
      templates,
      lessons,
      homework,
      exams,
      studioNotes,
      stickyNotes,
      aiSessions,
      reportCards,
      projects,
      resources,
      songs,
      practiceSets,
      attempts,
      drafts,
      measuredFocusSessions,
    },
    devices,
    recentTasks,
    subjects: subjects.map((s) => s.name),
  };
}

/**
 * A user's actual written content.
 *
 * Split from getAdminUser and fetched on demand, because opening somebody's
 * account to check why their sync is failing should not silently load
 * everything they have ever written.
 */
export async function getAdminUserContent(
  userId: string,
  kind: AdminContentKind,
  deviceOnly = false,
): Promise<{ id: string; title: string; body: string; when: Date }[]> {
  await requireAdmin();

  const connection = !deviceOnly && (await adminConnection());
  if (connection)
    return fetchAdminReport<
      { id: string; title: string; body: string; when: Date }[]
    >(connection, { operation: 'content', userId, kind });
  if (kind === 'practice') {
    const sets = await prisma.tutorModule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        subject: true,
        questions: true,
        createdAt: true,
      },
    });
    return sets.map((set) => ({
      id: set.id,
      title: `${set.subject} · ${set.title}`,
      body: set.questions,
      when: set.createdAt,
    }));
  }
  if (kind === 'focus') {
    const sessions = await prisma.xpEvent.findMany({
      where: { userId, source: 'FOCUS', focusSeconds: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        focusSeconds: true,
        amount: true,
        createdAt: true,
        task: { select: { subject: true, workDescription: true } },
      },
    });
    return sessions.map((session) => ({
      id: session.id,
      title: session.task?.subject ?? 'Free focus',
      body: `${session.focusSeconds}s focused · ${session.amount} XP\n${session.task?.workDescription ?? ''}`,
      when: session.createdAt,
    }));
  }

  if (kind === 'notes') {
    const rows = await prisma.studioNote.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, subject: true, content: true, updatedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.subject,
      body: r.content,
      when: r.updatedAt,
    }));
  }

  if (kind === 'sticky') {
    const rows = await prisma.stickyNote.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, content: true, updatedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.content,
      when: r.updatedAt,
    }));
  }

  if (kind === 'homework') {
    const rows = await prisma.homework.findMany({
      where: { userId },
      orderBy: { dueDate: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        title: true,
        description: true,
        dueDate: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: `${r.subject}: ${r.title}`,
      body: r.description ?? '',
      when: r.dueDate,
    }));
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 25,
    select: {
      id: true,
      title: true,
      mode: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { role: true, content: true },
      },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    title: `${s.mode} · ${s.title}`,
    body: s.messages
      .reverse()
      .map((m) => `${m.role === 'user' ? '>' : 'AI'} ${m.content}`)
      .join('\n\n'),
    when: s.updatedAt,
  }));
}

/* ------------------------------------------------------------------- health */

export type SystemHealth = {
  database: { reachable: boolean; provider: string; error: string | null };
  migrations: { name: string; appliedAt: Date | null; rolledBack: boolean }[];
  /** Rows whose owner no longer exists, or whose scope points nowhere. */
  orphans: { label: string; count: number }[];
  tombstones: { label: string; count: number }[];
  syncErrors: {
    userId: string;
    deviceId: string;
    lastError: string;
    lastSyncAt: Date | null;
  }[];
};

export async function getSystemHealth(): Promise<SystemHealth> {
  await requireAdmin();

  let reachable = true;
  let error: string | null = null;
  let migrations: SystemHealth['migrations'] = [];

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    reachable = false;
    error = 'The database connection failed.';
  }
  try {
    const rows = IS_SQLITE
      ? await prisma.$queryRawUnsafe<
          {
            migration_name: string;
            finished_at: Date | null;
            rolled_back_at: Date | null;
          }[]
        >(
          'SELECT name AS migration_name, applied_at AS finished_at, NULL AS rolled_back_at FROM "_local_migrations" ORDER BY applied_at DESC, name DESC LIMIT 20',
        )
      : await prisma.$queryRawUnsafe<
          {
            migration_name: string;
            finished_at: Date | null;
            rolled_back_at: Date | null;
          }[]
        >(
          'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 20',
        );
    migrations = rows.map((row) => ({
      name: row.migration_name,
      appliedAt: row.finished_at,
      rolledBack: row.rolled_back_at !== null,
    }));
  } catch {
    /* Migration history may be unavailable without losing DB connectivity. */
  }

  const [
    progressOrphans,
    taskNoTerm,
    subjectNoClass,
    deletedTasks,
    deletedSubjects,
    deletedSessions,
    syncErrorRows,
  ] = await Promise.all([
    // Not "UserProgress with no user" - that relation is required and cascades,
    // so it cannot happen. The real failure is the other way round: an account
    // with no progress row, which breaks the dashboard, the streak and the
    // greeting, and which registration has been able to produce.
    prisma.user.count({ where: { progress: { is: null } } }),
    prisma.task.count({ where: { termId: null } }),
    prisma.subject.count({ where: { classId: null } }),
    prisma.task.count({ where: { deletedAt: { not: null } } }),
    prisma.subject.count({ where: { deletedAt: { not: null } } }),
    prisma.chatSession.count({ where: { deletedAt: { not: null } } }),
    prisma.syncState.findMany({
      where: { lastError: { not: null } },
      select: {
        userId: true,
        deviceId: true,
        lastError: true,
        lastSyncAt: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return {
    database: {
      reachable,
      provider: IS_SQLITE ? 'sqlite' : 'postgresql',
      error,
    },
    migrations,
    orphans: [
      { label: 'Accounts with no progress row', count: progressOrphans },
      { label: 'Tasks with no term', count: taskNoTerm },
      { label: 'Subjects with no year', count: subjectNoClass },
    ],
    tombstones: [
      { label: 'Deleted tasks', count: deletedTasks },
      { label: 'Deleted subjects', count: deletedSubjects },
      { label: 'Deleted AI sessions', count: deletedSessions },
    ],
    syncErrors: syncErrorRows.map((s) => ({
      userId: s.userId,
      deviceId: s.deviceId,
      lastError: s.lastError ?? '',
      lastSyncAt: s.lastSyncAt,
    })),
  };
}

/* ------------------------------------------------------------------ actions */

export async function setUserAdmin(userId: string, makeAdmin: boolean) {
  const me = await adminId();
  if (!me) return { error: 'Not authorised.' };
  if (await adminConnection())
    return {
      error:
        'Open the connected server’s admin page to change accounts. Desktop reports are read-only.',
    };

  // No self-demotion: a deployment with no admin has no way back except a
  // database client, and the person locked out is the one who needs it.
  if (userId === me && !makeAdmin) {
    return { error: 'You cannot remove your own admin rights.' };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return { error: 'No such user.' };

  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: makeAdmin },
  });
  revalidatePath('/admin');
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const me = await adminId();
  if (!me) return { error: 'Not authorised.' };
  if (await adminConnection())
    return {
      error:
        'Open the connected server’s admin page to change accounts. Desktop reports are read-only.',
    };

  if (newPassword.length < 6)
    return { error: 'Password must be at least 6 characters.' };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!target) return { error: 'No such user.' };

  // The point of a reset is that the old password is gone, so every session
  // and desktop sync token opened with it stops working too.
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), sessionVersion: { increment: 1 } },
  });
  revalidatePath('/admin');
  return { success: true, username: target.username };
}

/**
 * Show the setup wizard and the tour to somebody again.
 *
 * The support action this deployment actually needed: the usual reason a person
 * is stuck is that they skipped onboarding and have no idea the weekly
 * timetable exists.
 */
export async function resetUserOnboarding(userId: string) {
  const me = await adminId();
  if (!me) return { error: 'Not authorised.' };
  if (await adminConnection())
    return {
      error:
        'Open the connected server’s admin page to change accounts. Desktop reports are read-only.',
    };

  const { count } = await prisma.userProgress.updateMany({
    where: { userId },
    data: { onboardedAt: null, setupCompletedAt: null },
  });
  if (count === 0) return { error: 'That account has no progress row.' };

  revalidatePath('/admin');
  return { success: true };
}

/**
 * Delete an account and everything in it.
 *
 * Guarded three ways, because this is the only irreversible thing on the page:
 * the caller must be an admin, must not be deleting themselves, and must have
 * typed the target's username exactly.
 */
export async function deleteUserAccount(userId: string, typedUsername: string) {
  const me = await adminId();
  if (!me) return { error: 'Not authorised.' };
  if (await adminConnection())
    return {
      error:
        'Open the connected server’s admin page to change accounts. Desktop reports are read-only.',
    };
  if (userId === me)
    return { error: 'You cannot delete your own account here.' };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!target) return { error: 'No such user.' };
  if (typedUsername.trim() !== target.username) {
    return { error: 'The username did not match. Nothing was deleted.' };
  }

  // Prisma's cascades cover the owned rows; SyncState has no relation, so it is
  // removed explicitly rather than left pointing at a user that is gone.
  await prisma.syncState.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  revalidatePath('/admin');
  return { success: true, username: target.username };
}
