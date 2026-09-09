/**
 * The one place devices and the web app meet.
 *
 * GET  /api/sync?cursor=<syncedAt>|<id>   everything the server has since then
 * POST /api/sync                          this device's local changes
 *
 * Hub and spoke on purpose: devices never talk to each other. That keeps the
 * merge to two participants at a time, which is the difference between rules
 * you can reason about and a distributed system.
 *
 * EVERY QUERY HERE IS SCOPED TO THE SIGNED-IN USER. A sync endpoint is the one
 * place in the app where forgetting that would hand somebody a copy of another
 * student's entire academic record, so the scoping is done once, at the top,
 * and the model list is walked rather than hand-written per model.
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma, IS_SQLITE } from '@/lib/prisma';
import { getUserId, userIdFromBearer } from '@/lib/auth';
import { SYNC_RULES } from '@/lib/sync/identity';
import { applyRows, scrub, APPLY_ORDER, type SyncRow } from '@/lib/sync/merge';
import {
  afterCursor,
  CURSOR_ORDER,
  PULL_PAGE_SIZE,
  PUSH_LIMIT,
  type Cursor,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '@/lib/sync/protocol';

export const dynamic = 'force-dynamic';

/**
 * Who is asking: a paired device by bearer token, or the browser by cookie.
 *
 * The bearer is checked first because a desktop install has no cookie jar, and
 * because a request that carries one is unambiguously the sync client rather
 * than a page.
 */
async function requester(request: NextRequest): Promise<string | null> {
  return (
    (await userIdFromBearer(request.headers.get('authorization'))) ?? (await getUserId())
  );
}

/**
 * The server's own identity in a merge.
 *
 * Only ever used to break an exact updatedAt tie, and it has to be a value both
 * sides compute identically. A constant does that; a hostname would not survive
 * a redeploy onto different infrastructure.
 */
const SERVER_DEVICE = 'server';

/**
 * How each model is filtered down to one user.
 *
 * Most carry userId. SubjectGrade does not - it hangs off ReportCard - so it is
 * reached through the relation. Anything added here without an owner path is a
 * cross-tenant leak, which is why the default is to throw rather than to fall
 * back to "no filter".
 */
function ownedBy(model: string, userId: string): Record<string, unknown> {
  if (model === 'subjectGrade') return { reportCard: { userId } };
  if (model === 'user') return { id: userId };
  return { userId };
}

/** Pull: everything the server has changed since the device's cursor. */
export async function GET(request: NextRequest) {
  const userId = await requester(request);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // The desktop build serves this route too, from its own local database, where
  // it would be answering itself. Refuse rather than pretend.
  if (IS_SQLITE) {
    return NextResponse.json({ error: 'This build is a sync client, not a server' }, { status: 400 });
  }

  const raw = request.nextUrl.searchParams.get('cursor');
  const cursor = parseCursor(raw);
  const since = afterCursor(cursor);

  // One page per model, then merged. Taking PULL_PAGE_SIZE from each and
  // slicing the same number off the front of the merge is what makes the result
  // a true prefix of the global (syncedAt, id) order: no model can hold a row
  // earlier than the ones it already returned.
  const collected: { model: string; row: Record<string, unknown> }[] = [];
  for (const model of APPLY_ORDER) {
    const rows = await prisma[model as 'task'].findMany({
      where: {
        ...(ownedBy(model, userId) as object),
        ...(since as object),
        // Tombstones are the point: a deletion has to travel.
        deletedAt: undefined,
      },
      orderBy: CURSOR_ORDER,
      take: PULL_PAGE_SIZE,
    });
    for (const row of rows) collected.push({ model, row: row as Record<string, unknown> });
  }

  collected.sort((a, b) => {
    const at = (a.row.syncedAt as Date)?.getTime() ?? 0;
    const bt = (b.row.syncedAt as Date)?.getTime() ?? 0;
    return at - bt || String(a.row.id).localeCompare(String(b.row.id));
  });

  const page = collected.slice(0, PULL_PAGE_SIZE);
  const last = page[page.length - 1];

  const response: PullResponse = {
    serverTime: new Date().toISOString(),
    rows: page.map(({ model, row }) => ({ model, data: scrub(model, row, 'down') })),
    cursor: last
      ? { syncedAt: (last.row.syncedAt as Date).toISOString(), id: String(last.row.id) }
      : cursor,
    hasMore: collected.length > page.length,
  };
  return NextResponse.json(response);
}

/** Push: the device's local changes, merged into the server. */
export async function POST(request: NextRequest) {
  const userId = await requester(request);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (IS_SQLITE) {
    return NextResponse.json({ error: 'This build is a sync client, not a server' }, { status: 400 });
  }

  let body: PushRequest;
  try {
    body = (await request.json()) as PushRequest;
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const deviceId = String(body?.deviceId ?? '').trim();
  if (!deviceId) return NextResponse.json({ error: 'A device id is required' }, { status: 400 });
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }
  if (body.rows.length > PUSH_LIMIT) {
    return NextResponse.json(
      { error: `Too many rows in one push (max ${PUSH_LIMIT})` },
      { status: 413 }
    );
  }

  // THE TRUST BOUNDARY. A device sends whatever it likes, so userId is
  // OVERWRITTEN with the signed-in user rather than merely checked - a check
  // can be forgotten on the one model that does not carry the column, while an
  // overwrite cannot be aimed at somebody else's account in the first place.
  const rows: SyncRow[] = [];
  for (const row of body.rows) {
    const rule = SYNC_RULES[row?.model];
    if (!rule || (rule.match !== 'ID' && rule.match !== 'NATURAL_KEY')) continue;
    if (!row.data || typeof row.data !== 'object') continue;

    const data = scrub(row.model, row.data as Record<string, unknown>, 'up');
    if (row.model === 'user') {
      // A device may not rename an account into somebody else's, nor promote
      // itself. Its own id is the only thing it is allowed to assert.
      if (String(data.id) !== userId) continue;
    } else if ('userId' in data) {
      data.userId = userId;
    }
    rows.push({ model: row.model, data });
  }

  const now = new Date();
  const outcome = await applyRows(prisma, rows, {
    stamp: now,
    localDevice: SERVER_DEVICE,
    incomingDevice: deviceId,
    now,
  });

  const response: PushResponse = {
    serverTime: now.toISOString(),
    applied: outcome.applied,
    rejected: outcome.rejected,
    reconciled: outcome.reconciled,
    remapped: outcome.remapped,
    errors: outcome.errors,
  };
  return NextResponse.json(response);
}

/** "<iso>|<id>", or null. Anything unparseable restarts from the beginning. */
function parseCursor(raw: string | null): Cursor {
  if (!raw) return null;
  const at = raw.lastIndexOf('|');
  if (at === -1) return null;
  const syncedAt = raw.slice(0, at);
  const id = raw.slice(at + 1);
  if (!id || Number.isNaN(new Date(syncedAt).getTime())) return null;
  return { syncedAt, id };
}
