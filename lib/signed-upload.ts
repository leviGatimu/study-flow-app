/**
 * The client half of a direct upload (see lib/upload.ts "direct uploads").
 * No Node imports: the browser (Resources) and the desktop's file sync both
 * load it.
 */

/**
 * PUT a file to a signed upload URL. Shared by the browser (Resources) and
 * the desktop's file sync, which both run fetch.
 */
export async function putToSignedUrl(uploadUrl: string, body: Blob, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': 'max-age=3600',
      'x-upsert': 'false',
    },
    body,
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = ((await response.json()) as { message?: string }).message ?? '';
    } catch {
      // Not JSON; the status is all there is.
    }
    throw new Error(`Upload failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
}
