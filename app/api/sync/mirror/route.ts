/**
 * The server's side of "make one side match the other": hand over this account's
 * rows, or write what the device decided. Everything is scoped to the signed-in
 * account, by the same rules as the sync route.
 */

import { NextRequest, NextResponse } from 'next/server';

import { userIdFromBearer } from '@/lib/auth';
import { IS_SQLITE, prisma } from '@/lib/prisma';
import { scrub } from '@/lib/sync/merge';
import { applyMirrorRemovals, applyMirrorRows, chunkRows, MIRROR_MODELS, mirrorReadWhere } from '@/lib/sync/mirror';
import { trustedRows, keepOwnedRows } from '@/lib/sync/ownership';

export const dynamic = 'force-dynamic';

const PAGE_ROWS = 300;
const MAX_REMOVE = 500;

export async function GET(request: NextRequest) {
  const userId = await userIdFromBearer(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (IS_SQLITE) return NextResponse.json({ error: 'This build is a sync client, not a server' }, { status: 400 });

  const model = request.nextUrl.searchParams.get('model') ?? '';
  if (!MIRROR_MODELS.includes(model)) return NextResponse.json({ error: 'Unknown model' }, { status: 400 });
  const after = request.nextUrl.searchParams.get('after') ?? '';

  const serverTime = new Date().toISOString();
  const found: Record<string, unknown>[] = await prisma[model as 'task'].findMany({
    where: { ...(mirrorReadWhere(model, userId) as object), ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: 'asc' },
    take: PAGE_ROWS,
  });

  // A page of long chat messages can pass the response size limit, so it ends early.
  const rows = found.map((row) => scrub(model, row, 'down'));
  const page = chunkRows(rows, PAGE_ROWS)[0] ?? [];
  const more = page.length < rows.length || found.length === PAGE_ROWS;
  return NextResponse.json({ rows: page, next: more && page.length > 0 ? String(page[page.length - 1].id) : null, serverTime });
}

export async function POST(request: NextRequest) {
  const userId = await userIdFromBearer(request.headers.get('authorization'));
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (IS_SQLITE) return NextResponse.json({ error: 'This build is a sync client, not a server' }, { status: 400 });

  let body: { op?: string; rows?: unknown; model?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const stamp = new Date();

  if (body.op === 'remove') {
    const model = String(body.model ?? '');
    const ids = body.ids;
    if (!MIRROR_MODELS.includes(model)) return NextResponse.json({ error: 'Unknown model' }, { status: 400 });
    if (!Array.isArray(ids) || ids.length > MAX_REMOVE || !ids.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'ids must be a short list of ids' }, { status: 400 });
    }
    const removed = await applyMirrorRemovals(prisma, model, ids, userId, stamp);
    return NextResponse.json({ removed });
  }

  if (body.op === 'upsert') {
    if (!Array.isArray(body.rows) || body.rows.length > 500) {
      return NextResponse.json({ error: 'rows must be a short list' }, { status: 400 });
    }
    const allowed = trustedRows(body.rows, userId).filter((row) => MIRROR_MODELS.includes(row.model));
    const owned = await keepOwnedRows(prisma, allowed, userId);
    const errors = await applyMirrorRows(prisma, owned.rows, stamp);
    return NextResponse.json({ errors, dropped: owned.dropped + (body.rows.length - allowed.length) });
  }

  return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
}
