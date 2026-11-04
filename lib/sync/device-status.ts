import type { prisma } from '../prisma';

/** Server-side status only; pairing credentials are never stored in this report. */
export async function recordDeviceStatus(
  db: Pick<typeof prisma, 'syncState'>,
  userId: string,
  deviceId: string | null,
  data: { pushed?: number; pulled?: number; error?: string | null },
  now = new Date(),
) {
  if (!deviceId || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(deviceId)) return;
  const status = {
    lastSyncAt: now,
    ...(data.pushed !== undefined ? { lastPushed: data.pushed } : {}),
    ...(data.pulled !== undefined ? { lastPulled: data.pulled } : {}),
    ...(data.error !== undefined ? { lastError: data.error } : {}),
  };
  await db.syncState.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    create: { userId, deviceId, ...status },
    update: status,
  });
}
