import { basename, join } from 'path';
import { writeFile, unlink } from 'fs/promises';

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

/**
 * Validate an uploaded file and persist it to /public/uploads with a safe,
 * collision-resistant name. Returns the public URL (e.g. "/uploads/xxx.pdf").
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
  const path = join(UPLOAD_DIR, filename);

  await writeFile(path, buffer);
  return `/uploads/${filename}`;
}

/**
 * Safely delete a previously-uploaded file given its public URL.
 * basename() prevents a malicious/corrupt url value from escaping the
 * uploads directory (e.g. "/uploads/../../etc/passwd").
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const filename = basename(url);
  if (!filename) return;
  try {
    await unlink(join(UPLOAD_DIR, filename));
  } catch {
    // File may already be gone; ignore.
  }
}
