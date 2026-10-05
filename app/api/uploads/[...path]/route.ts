import { getUserId, userIdFromBearer } from '@/lib/auth';
import { resolveUploadPath, readRemoteUpload } from '@/lib/upload';
import { mimeFor, serveLocalFile } from '@/lib/serve-file';

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
 *
 * Streaming, content types and Range handling live in lib/serve-file.ts,
 * shared with the library route.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // A paired desktop install fetches these too, and it has a bearer token
  // rather than a cookie. Same session, same secret, different envelope.
  const userId =
    (await userIdFromBearer(request.headers.get('authorization'))) ?? (await getUserId());
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

  // The filename carries a timestamp and content never changes in place, so
  // this URL can be cached hard.
  return serveLocalFile(full, request, { immutable: true });
}
