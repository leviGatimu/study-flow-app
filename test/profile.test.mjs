import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateProfile, profilePhotoUrl, MAX_AVATAR_BYTES } from '../lib/profile-input.ts';
import { normalizeProfilePhoto } from '../lib/profile-photo.ts';

const input = { name: '  Alex Student  ', bio: ' Physics ', school: ' College ', timezone: 'Africa/Johannesburg' };
test('profile details are trimmed and bounded', () => {
  assert.deepEqual(validateProfile(input).data, { name: 'Alex Student', bio: 'Physics', school: 'College', timezone: 'Africa/Johannesburg' });
  for (const patch of [{ name: '' }, { name: 'x'.repeat(81) }, { bio: 'x'.repeat(501) }, { school: 'x'.repeat(121) }, { timezone: 'Mars/City' }, { timezone: '' }]) assert.ok(validateProfile({ ...input, ...patch }).error);
});
test('profile photos can only reference normalized private uploads', () => {
  assert.equal(profilePhotoUrl('/uploads/avatar-abc-123-photo.webp'), '/uploads/avatar-abc-123-photo.webp');
  for (const value of ['https://example.com/track.png', 'javascript:alert(1)', '/uploads/../../secret.webp', '/uploads/avatar-a.svg', '/uploads/other.webp']) assert.equal(profilePhotoUrl(value), null);
});
test('photo uploads are decoded, resized and re-encoded as WebP without metadata', async () => {
  const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#3366aa' } }).png().withMetadata().toBuffer();
  const bytes = await normalizeProfilePhoto(new File([input], 'photo.png', { type: 'image/png' }));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 384);
  assert.equal(metadata.height, 384);
  assert.equal(metadata.exif, undefined);
  assert.ok(bytes.length < 100_000);
});
test('spoofed images, active SVG content and oversized uploads are refused', async () => {
  for (const content of ['not an image', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>']) {
    await assert.rejects(normalizeProfilePhoto(new File([content], 'photo.png', { type: 'image/png' })), /valid JPG/);
  }
  await assert.rejects(normalizeProfilePhoto(new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], 'huge.png')), /5 MB/);
});
