/**
 * POST /api/sync/file/ticket  { name, size }  ->  { uploadUrl }
 *
 * A desktop pushing a file larger than the ~4.5 MB Vercel lets through a
 * function asks here for a signed URL and PUTs the bytes straight into the
 * bucket under the row's exact name. Same checks as POST /api/sync/file: a
 * paired device, a name inside the uploads store, and a file one of this
 * user's synced records already names.
 *
 * 501 when the bucket is not configured: the device then posts the file to
 * /api/sync/file as before.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getMentorSession, getUserId, userIdFromBearer } from '@/lib/auth';
import { ownsUpload } from '@/lib/file-access';
import {
  createDirectUpload,
  MAX_REMOTE_UPLOAD_BYTES,
  remoteUploadSize,
  resolveUploadPath,
  usesRemoteStorage,
} from '@/lib/upload';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const userId =
    (await userIdFromBearer(request.headers.get('authorization'))) ??
    // A mentor's browser session is read-only; this route writes.
    ((await getMentorSession()) ? null : await getUserId());
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  if (!usesRemoteStorage()) {
    return NextResponse.json({ error: 'Direct uploads are not available here.' }, { status: 501 });
  }

  let body: { name?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name : '';
  const size = typeof body.size === 'number' ? body.size : NaN;
  if (!name || !resolveUploadPath(name)) return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
  if (size > MAX_REMOTE_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'That file is too large to sync' }, { status: 413 });
  }
  if (!(await ownsUpload(userId, name))) {
    return NextResponse.json({ error: 'No record of yours uses that file' }, { status: 403 });
  }
  // Never overwrite: an object that is there already is the same file.
  if ((await remoteUploadSize(name)) !== null) return NextResponse.json({ alreadyHad: true });

  const direct = await createDirectUpload(name);
  if (!direct) return NextResponse.json({ error: 'Direct uploads are not available here.' }, { status: 501 });
  return NextResponse.json({ uploadUrl: direct.uploadUrl });
}
