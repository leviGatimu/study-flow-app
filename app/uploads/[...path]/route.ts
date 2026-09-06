import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

import { getUserId } from '@/lib/auth';
import { resolveUploadPath, readRemoteUpload } from '@/lib/upload';

/**
 * Serve a locally-stored upload.
 *
 * On the web build, uploads sit in public/uploads and Next serves them as
 * static assets before this route is ever consulted - or they live in Supabase
 * Storage and are fetched from an absolute URL, so this route is not involved
 * at all. It exists for the desktop build, where uploads had to move out of the
 * application directory (an auto-update deletes that) into userData, which
 * puts them outside public/ and therefore out of reach of static serving.
 *
 * Reads are authenticated: these are the user's own PDFs, proofs of work and
 * report cards, and on the web build the same files would otherwise be
 * enumerable by anyone who guessed a filename.
 */

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  opus: 'audio/opus',
};

function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const userId = await getUserId();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { path } = await params;
  // Uploads are stored flat, so only the last segment can name a real file.
  const name = path[path.length - 1] ?? '';

  // Object storage (the web build, once configured) holds the bytes remotely.
  const remote = await readRemoteUpload(name);
  if (remote) {
    return new Response(remote.body, {
      headers: {
        'Content-Type': remote.contentType ?? mimeFor(name),
        'Content-Length': String(remote.body.byteLength),
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // resolveUploadPath rejects anything that escapes the uploads directory.
  const full = resolveUploadPath(name);
  if (!full) return new Response('Not found', { status: 404 });

  let size: number;
  try {
    const info = await stat(full);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    size = info.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': mimeFor(full),
      'Content-Length': String(size),
      // The filename carries a timestamp and content never changes in place,
      // so this is safe to cache hard. Private: it is the user's own file.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      // Never let a stored file be interpreted as something else.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
