import type { prisma } from './prisma';

/** Keep the ownership check ahead of every measurement query. */
export async function readStudyLog(db: Pick<typeof prisma, 'task' | 'xpEvent'>, id: string, userId: string, termIds?: string[]) {
  const task = await db.task.findFirst({
    where: { id, userId, deletedAt: null, isDeleted: false, ...(termIds ? { termId: { in: termIds } } : {}) },
    include: { template: true, exam: { select: { id: true, subject: true } } },
  });
  if (!task) return null;
  const where = { userId, taskId: id, source: 'FOCUS', deletedAt: null, focusSeconds: { not: null } };
  const [summary, sessions] = await Promise.all([
    db.xpEvent.aggregate({ where, _count: true, _sum: { focusSeconds: true, amount: true }, _max: { focusSeconds: true }, _avg: { focusSeconds: true } }),
    db.xpEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
      select: { id: true, createdAt: true, focusSeconds: true, amount: true } }),
  ]);
  return { task, summary, sessions };
}
