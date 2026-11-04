import type { prisma } from './prisma';

export type FocusMeasurement = { sessionId: string; taskId?: string | null; seconds: number; ownerId?: string };

/** The ledger grant and counters commit together; replaying a window's save is harmless. */
export async function recordFocus(
  db: Pick<typeof prisma, '$transaction'>,
  userId: string,
  durationMinutes: number,
  earnedXp: number,
  measurement: FocusMeasurement,
) {
  if ((measurement.ownerId && measurement.ownerId !== userId)
    || !/^[a-zA-Z0-9:_.-]{1,160}$/.test(measurement.sessionId)
    || !Number.isInteger(measurement.seconds) || measurement.seconds < 0 || measurement.seconds > 86400
    || !Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440
    || !Number.isFinite(earnedXp) || earnedXp < 0 || earnedXp > 172800) {
    throw new Error('This focus session has invalid measurements.');
  }
  try {
    await db.$transaction(async tx => {
      const taskId = measurement.taskId && measurement.taskId !== 'free' ? measurement.taskId : null;
      if (taskId && !await tx.task.findFirst({ where: { id: taskId, userId, deletedAt: null, isDeleted: false } })) {
        throw new Error('This study block is no longer available.');
      }
      await tx.xpEvent.create({ data: {
        userId, source: 'FOCUS', sourceKey: `focus:${measurement.sessionId}`,
        amount: Math.round(earnedXp), focusSeconds: measurement.seconds, taskId,
      } });
      await tx.userProgress.upsert({
        where: { userId },
        update: { focusSessions: { increment: 1 }, totalFocusMinutes: { increment: durationMinutes } },
        create: { userId, focusSessions: 1, totalFocusMinutes: durationMinutes },
      });
    });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return false;
    throw error;
  }
}

export function focusDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const remaining = value % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}
