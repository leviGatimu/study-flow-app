import { getUserId, userIdFromBearer } from '@/lib/auth';
import { resolveLibraryUrl } from '@/lib/library';
import { serveLocalFile } from '@/lib/serve-file';

/**
 * Serve a file out of the desktop's library folder.
 *
 * Resource rows on the desktop point at real files under
 * Documents\Study Tracker (see lib/library.ts), which sit nowhere near
 * public/, so they are streamed through here - authenticated, because a
 * subject folder holds the student's own notes and past papers.
 *
 * The URL IS the path, relative to the library root, so containment is the
 * whole security story: resolveLibraryUrl refuses anything that decodes to a
 * dot segment, an invalid character or a path outside the root.
 *
 * Not cached as immutable, unlike /uploads: a library file keeps its human
 * name and can be overwritten in place from Windows Explorer.
 */
export async function GET(request: Request) {
  const userId =
    (await userIdFromBearer(request.headers.get('authorization'))) ?? (await getUserId());
  if (!userId) return new Response('Unauthorized', { status: 401 });

  // The raw pathname keeps the percent-encoding the row stores; Next would
  // hand us decoded params, and a file literally named "a%2Fb" must not be
  // read as a directory boundary.
  const full = resolveLibraryUrl(new URL(request.url).pathname);
  if (!full) return new Response('Not found', { status: 404 });

  return serveLocalFile(full, request, { immutable: false });
}
