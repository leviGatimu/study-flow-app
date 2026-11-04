import type { prisma } from './prisma';

type MetricsDb = Pick<
  typeof prisma,
  | 'task'
  | 'schoolLesson'
  | 'resource'
  | 'tutorModule'
  | 'quizAttempt'
  | 'attemptDraft'
  | 'xpEvent'
>;

/** Current product activity, excluding deleted records and their children. */
export async function collectAdminMetrics(db: MetricsDb) {
  const [
    completedBlocks,
    lessons,
    resources,
    practiceSets,
    attempts,
    pendingMarks,
    drafts,
    focus,
  ] = await Promise.all([
    db.task.count({
      where: { deletedAt: null, isDeleted: false, isDone: true },
    }),
    db.schoolLesson.count({ where: { deletedAt: null } }),
    db.resource.count({ where: { deletedAt: null, type: { not: 'FOLDER' } } }),
    db.tutorModule.count({ where: { deletedAt: null } }),
    db.quizAttempt.count({
      where: { deletedAt: null, module: { deletedAt: null } },
    }),
    db.quizAttempt.count({
      where: {
        deletedAt: null,
        module: { deletedAt: null },
        markingStatus: { in: ['PENDING', 'PARTIAL'] },
      },
    }),
    db.attemptDraft.count({
      where: { deletedAt: null, module: { deletedAt: null } },
    }),
    db.xpEvent.aggregate({
      where: { deletedAt: null, source: 'FOCUS', focusSeconds: { not: null } },
      _count: true,
      _sum: { focusSeconds: true },
    }),
  ]);
  return {
    completedBlocks,
    lessons,
    resources,
    practiceSets,
    attempts,
    pendingMarks,
    drafts,
    measuredSessions: focus._count,
    focusSeconds: focus._sum.focusSeconds ?? 0,
  };
}

export async function hasAdminRole(
  db: Pick<typeof prisma, 'user'>,
  userId: string | null,
) {
  if (!userId) return false;
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}
