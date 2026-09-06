import { basename, join } from 'path';
import { writeFile, unlink } from 'fs/promises';

/**
 * File uploads, with a pluggable backend.
 *
 * WHY THIS EXISTS: uploads were written to public/uploads on the local disk.
 * That is correct for the desktop build - the files live on the user's own
 * machine - but on Vercel the filesystem is ephemeral and read-only at runtime,
 * so every PDF, proof and song uploaded on the deployed app is lost on the next
 * deploy. Same code, two environments, one of them silently broken.
 *
 * The backend is chosen by environment:
 *   SUPABASE_STORAGE_BUCKET + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *      -> Supabase Storage  (use this on Vercel)
 *   otherwise
 *      -> local disk        (correct for the desktop build; the default)
 *
 * The disk path is unchanged, so nothing differs until the variables are set.
 */

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

// 25 MB cap per upload to prevent disk-exhaustion abuse.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Audio files (focus-mode music library) get a higher cap.
export const MAX_AUDIO_UPLOAD_BYTES = 60 * 1024 * 1024;

// Allowlist of document/image/audio types the app is expected to handle.
// Note: SVG is intentionally excluded — it can carry inline scripts and is
// served from /uploads, which would create a stored-XSS vector.
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx', 'txt',
  'mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function isAllowedType(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;

  const mime = (file.type || '').toLowerCase();
  if (!mime) return true; // some browsers omit type; extension already vetted
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some(prefix => mime.startsWith(prefix));
}

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !key || !bucket) return null;
  return { url, key, bucket };
}

/** True when uploads go to object storage rather than the local disk. */
export function usesRemoteStorage(): boolean {
  return storageConfig() !== null;
}

async function getStorageClient(cfg: NonNullable<ReturnType<typeof storageConfig>>) {
  const { createClient } = await import('@supabase/supabase-js');
  // The service role key bypasses RLS; it must only ever be used server-side.
  return createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
}

/**
 * Validate an uploaded file and persist it. Returns the URL to store on the
 * record — a "/uploads/..." path on disk, or a public object URL in storage.
 * Throws on validation failure so callers can surface a friendly message.
 */
export async function saveUpload(file: File, prefix = 'upload', maxBytes = MAX_UPLOAD_BYTES): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error('No file provided.');
  }
  if (file.size > maxBytes) {
    throw new Error(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  }
  if (!isAllowedType(file)) {
    throw new Error('Unsupported file type.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // basename() strips any path components; the regex removes everything else
  // that isn't a safe filename character, neutralising path traversal.
  const safeName = basename(file.name).replace(/[^a-zA-Z0-9.]/g, '_');
  const filename = `${prefix}-${Date.now()}-${safeName}`;

  const cfg = storageConfig();
  if (cfg) {
    const supabase = await getStorageClient(cfg);
    const { error } = await supabase.storage
      .from(cfg.bucket)
      .upload(filename, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = supabase.storage.from(cfg.bucket).getPublicUrl(filename);
    return data.publicUrl;
  }

  await writeFile(join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Safely delete a previously-uploaded file given its stored URL.
 * basename() prevents a malicious/corrupt url value from escaping the
 * uploads directory (e.g. "/uploads/../../etc/passwd").
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const filename = basename(url.split('?')[0]);
  if (!filename) return;

  const cfg = storageConfig();
  // A record may hold a disk path from before storage was switched on, so route
  // by the URL's shape rather than by the current configuration alone.
  if (cfg && !url.startsWith('/uploads/')) {
    try {
      const supabase = await getStorageClient(cfg);
      await supabase.storage.from(cfg.bucket).remove([filename]);
    } catch {
      // Already gone, or storage unreachable; nothing useful to do here.
    }
    return;
  }

  try {
    await unlink(join(UPLOAD_DIR, filename));
  } catch {
    // File may already be gone; ignore.
  }
}
