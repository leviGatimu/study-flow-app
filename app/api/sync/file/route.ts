/**
 * The bytes behind a synced row.
 *
 * HEAD  /api/sync/file?name=x   does the server already have this file?
 * POST  /api/sync/file          take this one (multipart: name + file)
 * POST  /api/sync/file/ticket   a signed URL to PUT a large one to (bucket only)
 *
 * Reading is not here: devices fetch through the existing authenticated
 * /uploads route, which already handles Range requests and content types. This
 * endpoint exists for the two things that route cannot do - answer "have you got
 * it" without transferring it, and accept one.
 *
 * DELIBERATELY NOT A GENERAL UPLOAD ENDPOINT. It only accepts a name that
 * resolves inside the uploads directory, only from a paired device, and it
 * never overwrites: a file that is already there is left alone, because the
 * name embeds a random suffix and a collision therefore means the same file,
 * not a newer one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

import { getMentorSession, getUserId, userIdFromBearer } from '@/lib/auth';
import { ownsUpload } from '@/lib/file-access';
import {
  MAX_AUDIO_UPLOAD_BYTES,
  remoteUploadSize,
  resolveUploadPath,
  saveRemoteUploadAs,
  usesRemoteStorage,
} from '@/lib/upload';

export const dynamic = 'force-dynamic';

async function requester(request: NextRequest): Promise<string | null> {
  return (
    (await userIdFromBearer(request.headers.get('authorization'))) ??
    // A mentor's browser session is read-only; this route writes.
    ((await getMentorSession()) ? null : await getUserId())
  );
}

/** Does the server hold this file already? */
export async function HEAD(request: NextRequest) {
  const userId = await requester(request);
  if (!userId) return new NextResponse(null, { status: 401 });

  const name = request.nextUrl.searchParams.get('name');
  const path = name ? resolveUploadPath(name) : null;
  if (!path) return new NextResponse(null, { status: 400 });
  // Rows are pushed before their files, so the server already knows whether
  // one of this user's records names this file. Anyone else's is not theirs to
  // probe for.
  if (!(await ownsUpload(userId, name!))) return new NextResponse(null, { status: 404 });

  // With remote storage configured, the bucket is where the file would be.
  if (usesRemoteStorage()) {
    return new NextResponse(null, { status: (await remoteUploadSize(name!)) !== null ? 200 : 404 });
  }

  return new NextResponse(null, { status: existsSync(path) ? 200 : 404 });
}

export async function POST(request: NextRequest) {
  const userId = await requester(request);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart upload' }, { status: 400 });
  }

  const name = String(form.get('name') ?? '');
  const file = form.get('file');
  if (!name || !(file instanceof File)) {
    return NextResponse.json({ error: 'name and file are both required' }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'That file is too large to sync' }, { status: 413 });
  }

  // The only thing standing between a device and writing anywhere on the
  // server's disk. resolveUploadPath rejects any name that escapes the uploads
  // directory; a null here is an attack or a bug, and either way it stops.
  const path = resolveUploadPath(name);
  if (!path) return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  // Only a file one of this user's synced records points at may be written.
  if (!(await ownsUpload(userId, name))) {
    return NextResponse.json({ error: 'No record of yours uses that file' }, { status: 403 });
  }

  if (usesRemoteStorage()) {
    // The row already carries this exact name, so it is stored under it; a
    // copy that is already there is the same file (the name embeds a random
    // suffix) and counts as success.
    await saveRemoteUploadAs(name, await file.arrayBuffer(), file.type);
    return NextResponse.json({ success: true });
  }

  if (existsSync(path)) return NextResponse.json({ success: true, alreadyHad: true });

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ success: true });
}
