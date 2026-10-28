import sharp from 'sharp';
import { MAX_AVATAR_BYTES } from './profile-input.ts';

/** Decode and re-encode: filenames and claimed MIME types are not proof of an image. */
export async function normalizeProfilePhoto(file: File): Promise<Buffer> {
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) throw new Error('Choose a photo smaller than 5 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const photo = sharp(buffer, { limitInputPixels: 25_000_000, animated: false, failOn: 'error' });
    const metadata = await photo.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
      throw new Error('unsupported');
    }
    // Metadata (including GPS) is dropped. Keep uploads small for desktop sync.
    return await photo.rotate().resize(384, 384, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error('Choose a valid JPG, PNG or WebP photo, up to 25 megapixels.');
  }
}
