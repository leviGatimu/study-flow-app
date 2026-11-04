import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminConsole,
  getAdminUser,
  getAdminUserContent,
  isCurrentUserAdmin,
} from '@/lib/admin-actions';
import { IS_SQLITE } from '@/lib/prisma';
import type { AdminContentKind } from '@/lib/admin-remote';

export const dynamic = 'force-dynamic';

/** Read-only reports for an administrator's paired desktop. Rights are checked live. */
export async function GET(request: NextRequest) {
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  if (!(await isCurrentUserAdmin()))
    return respond({ error: 'Admin access is required.' }, 403);
  if (IS_SQLITE)
    return respond({ error: 'This device is not the deployment server.' }, 503);
  const operation = request.nextUrl.searchParams.get('operation');
  const userId = request.nextUrl.searchParams.get('userId');
  try {
    if (operation === 'snapshot') return respond(await getAdminConsole());
    if (!userId || userId.length > 200)
      return respond({ error: 'Choose a valid account.' }, 400);
    if (operation === 'user') return respond(await getAdminUser(userId));
    const kind = request.nextUrl.searchParams.get('kind');
    if (
      operation === 'content' &&
      kind &&
      ['notes', 'sticky', 'ai', 'homework', 'practice', 'focus'].includes(kind)
    ) {
      return respond(
        await getAdminUserContent(userId, kind as AdminContentKind),
      );
    }
    return respond({ error: 'Unknown report.' }, 400);
  } catch {
    return respond({ error: 'The admin report could not be loaded.' }, 500);
  }
}
