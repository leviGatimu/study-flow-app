import { basename, join, resolve, sep } from 'path';
import { writeFile, unlink, mkdir } from 'fs/promises';

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

/**
 * Where uploads live on disk.
 *
 * Defaults to public/uploads, which is right for `next dev` and for the web
 * build. The desktop launcher overrides it with UPLOADS_DIR pointing inside
 * userData, NEXT TO THE DATABASE, because the default resolves to a directory
 * inside the installed application: electron-updater runs the NSIS uninstaller
 * before installing a new version, so every auto-update would have deleted
 * every PDF, proof of work and track the user had uploaded.
 *
 * Files stored outside public/ are not static assets any more, so they are
 * served by app/api/uploads/[...path]/route.ts.
 */
export const UPLOAD_DIR =
  process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');

/**
 * Resolve a stored filename to an absolute path inside UPLOAD_DIR, or null if
 * it tries to escape. basename() already strips directories; this is the
 * belt-and-braces check for the read path, which serves whatever it is given.
 */
export function resolveUploadPath(filename: string): string | null {
  const safe = basename(filename);
  if (!safe || safe === '.' || safe === '..') return null;
  const full = resolve(UPLOAD_DIR, safe);
  const root = resolve(UPLOAD_DIR);
  return full === root || full.startsWith(root + sep) ? full : null;
}

// 25 MB cap per upload to prevent disk-exhaustion abuse.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Audio files (focus-mode music library) get a higher cap.
export const MAX_AUDIO_UPLOAD_BYTES = 60 * 1024 * 1024;

// Allowlist of document/image/audio types the app is expected to handle.
// Note: SVG is intentionally excluded — it can carry inline scripts and is
// served from /uploads, which would create a stored-XSS vector.
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv',
  'mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus',
  'mp4', 'webm',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
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
 * record: always "/uploads/<filename>", whichever backend holds the bytes.
 *
 * That URL used to be an absolute public Supabase URL when storage was on,
 * which would have made every report card and proof of work readable by
 * anyone who had the link. Both backends now go through the app's own
 * authenticated /uploads route, so the bucket can stay private and the stored
 * value does not change meaning when the backend is switched.
 *
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

    return `/uploads/${filename}`;
  }

  // The directory may not exist yet on a fresh desktop profile, where it lives
  // in userData rather than being shipped with the app.
  await mkdir(UPLOAD_DIR, { recursive: true });
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
  // Both backends now store the same "/uploads/<name>" shape, so the URL no
  // longer says where the bytes are. When storage is configured, remove the
  // object AND fall through to the disk: a record written before storage was
  // switched on still has its file sitting on the local filesystem.
  if (cfg) {
    try {
      const supabase = await getStorageClient(cfg);
      await supabase.storage.from(cfg.bucket).remove([filename]);
    } catch {
      // Already gone, or storage unreachable; nothing useful to do here.
    }
  }

  try {
    await unlink(join(UPLOAD_DIR, filename));
  } catch {
    // File may already be gone; ignore.
  }
}

// ---------------------------------------------------------------- direct uploads
//
// Vercel refuses any function request or response body over about 4.5 MB, so
// on the website a normal-sized PowerPoint can neither be posted to a server
// action nor streamed back through /uploads. With the bucket configured, the
// bytes skip the app entirely: the server checks the request and hands out a
// signed upload URL for one exact object name, the client PUTs the file to
// it, and reads are answered with a short-lived signed download URL.

// Supabase's free plan refuses single files over 50 MB.
export const MAX_REMOTE_UPLOAD_BYTES = 50 * 1024 * 1024;

/** A fresh object name: the prefix and timestamp saveUpload uses, plus randomness so it cannot be guessed. */
export function mintUploadName(prefix: string, originalName: string): string {
  const safeName = basename(originalName).replace(/[^a-zA-Z0-9.]/g, '_').slice(-120) || 'file';
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now()}-${random}-${safeName}`;
}

/** Whether a file name and MIME type pass the same allowlist saveUpload applies. */
export function isAllowedUpload(name: string, mime: string): boolean {
  return isAllowedType({ name, type: mime } as File);
}

/**
 * A signed URL the client may PUT exactly one object to. Null when the bucket
 * is not configured (the desktop, or a web build without storage).
 */
export async function createDirectUpload(filename: string): Promise<{ uploadUrl: string } | null> {
  const cfg = storageConfig();
  if (!cfg) return null;
  const safe = basename(filename);
  const supabase = await getStorageClient(cfg);
  const { data, error } = await supabase.storage.from(cfg.bucket).createSignedUploadUrl(safe);
  if (error || !data) throw new Error(`Upload could not start: ${error?.message ?? 'no URL returned'}`);
  return { uploadUrl: data.signedUrl };
}

/** Size of a stored object, or null when it is not in the bucket. */
export async function remoteUploadSize(filename: string): Promise<number | null> {
  const cfg = storageConfig();
  if (!cfg) return null;
  const safe = basename(filename);
  const supabase = await getStorageClient(cfg);
  const { data, error } = await supabase.storage.from(cfg.bucket).list('', { search: safe, limit: 10 });
  if (error || !data) return null;
  const match = data.find((entry) => entry.name === safe);
  if (!match) return null;
  const size = (match.metadata as { size?: unknown } | null)?.size;
  return typeof size === 'number' ? size : 0;
}

/**
 * A short-lived link straight to the object, for the /uploads route to
 * redirect to after it has checked ownership. 60 seconds is enough to start
 * a download or a media stream; the link is useless after that.
 */
export async function signedDownloadUrl(filename: string, downloadAs?: string): Promise<string | null> {
  const cfg = storageConfig();
  if (!cfg) return null;
  const safe = basename(filename);
  const supabase = await getStorageClient(cfg);
  const { data, error } = await supabase.storage
    .from(cfg.bucket)
    .createSignedUrl(safe, 60, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Store bytes under an exact name. Used by desktop file sync, whose rows
 * already carry the name: unlike saveUpload, nothing new may be minted.
 * An object that is already there counts as success.
 */
export async function saveRemoteUploadAs(filename: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const cfg = storageConfig();
  if (!cfg) throw new Error('Remote storage is not configured.');
  const safe = basename(filename);
  const supabase = await getStorageClient(cfg);
  const { error } = await supabase.storage
    .from(cfg.bucket)
    .upload(safe, Buffer.from(body), { contentType: contentType || 'application/octet-stream', upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`Upload failed: ${error.message}`);
}

