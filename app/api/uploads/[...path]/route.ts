import { getUserId, userIdFromBearer } from '@/lib/auth';
import { resolveUploadPath, signedDownloadUrl, usesRemoteStorage } from '@/lib/upload';
import { serveLocalFile } from '@/lib/serve-file';
import { ownsUpload } from '@/lib/file-access';

/**
 * Serve a locally-stored upload. Reached as /uploads/<name>: proxy.ts rewrites
 * every such URL here, so a copy in public/uploads is never served statically.
 *
 * On the desktop, uploads sit in userData (an auto-update deletes the
 * application directory), outside public/, so they are streamed from here.
 * On the website with the Supabase bucket configured, the bytes are in the
 * bucket and this route answers with a short-lived signed link to them.
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

  // Signed in is not enough: the file must belong to one of YOUR records.
  // 404 rather than 403, so the route does not confirm another user's file
  // exists.
  if (!(await ownsUpload(userId, name))) return new Response('Not found', { status: 404 });

  // Object storage (the web build, once configured) holds the bytes remotely.
  // Answer with a 60-second signed link instead of the bytes: Vercel refuses
  // function responses over about 4.5 MB, which most slide decks are.
  if (usesRemoteStorage()) {
    const download = new URL(request.url).searchParams.get('download') === '1';
    const signed = await signedDownloadUrl(name, download ? name : undefined);
    if (signed) {
      return new Response(null, {
        status: 302,
        headers: { Location: signed, 'Cache-Control': 'private, no-store' },
      });
    }
    // Not in the bucket: a record made before storage was switched on may
    // still have its file on this disk, so fall through.
  }

  // resolveUploadPath rejects anything that escapes the uploads directory.
  const full = resolveUploadPath(name);
  if (!full) return new Response('Not found', { status: 404 });

  // The filename carries a timestamp and content never changes in place, so
  // this URL can be cached hard.
  return serveLocalFile(full, request, { immutable: true });
}
