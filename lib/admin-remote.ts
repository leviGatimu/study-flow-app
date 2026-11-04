export type AdminSource = {
  mode: 'web' | 'server' | 'device';
  serverUrl: string | null;
  checkedAt: Date;
};

export type AdminContentKind =
  | 'notes'
  | 'sticky'
  | 'ai'
  | 'homework'
  | 'practice'
  | 'focus';
export type AdminRead =
  | { operation: 'snapshot' }
  | { operation: 'user'; userId: string }
  | { operation: 'content'; userId: string; kind: AdminContentKind };

const dateKeys = new Set([
  'checkedAt',
  'createdAt',
  'lastActiveDate',
  'startedAt',
  'startDate',
  'endDate',
  'lastSyncAt',
  'date',
  'appliedAt',
  'when',
]);

/** Only known date fields are revived; private content is never interpreted. */
export function decodeAdminReport<T>(json: string): T {
  return JSON.parse(json, (key, value: unknown) =>
    dateKeys.has(key) &&
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
      ? new Date(value)
      : value,
  ) as T;
}

/** Runs on the desktop's server. The pairing token never reaches a client component. */
export async function fetchAdminReport<T>(
  connection: { serverUrl: string; token: string },
  read: AdminRead,
  request = fetch,
): Promise<T> {
  const url = new URL(`${connection.serverUrl.replace(/\/+$/, '')}/api/admin`);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('The connected server address is invalid.');
  for (const [key, value] of Object.entries(read))
    url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await request(url, {
      headers: { authorization: `Bearer ${connection.token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(
      'The connected server could not be reached. Retry when you are online, or view this device only.',
    );
  }
  if (response.status === 401)
    throw new Error(
      'Your server sign-in has expired. Reconnect the device in Settings → Sync.',
    );
  if (response.status === 403)
    throw new Error(
      'This account does not have admin access on the connected server.',
    );
  if (response.status === 404)
    throw new Error(
      'The connected server needs the admin-console update before desktop reports can load.',
    );
  if (!response.ok)
    throw new Error(
      'The server could not load its admin report. Try refreshing in a moment.',
    );
  try {
    return decodeAdminReport<T>(await response.text());
  } catch {
    throw new Error(
      'The server returned an unreadable admin report. Try refreshing in a moment.',
    );
  }
}
