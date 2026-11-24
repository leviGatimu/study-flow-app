/**
 * Just enough ZIP to share Resources: write a zip, and read one back.
 *
 * Writing stores files without compressing them. What a student shares is
 * mostly PDFs, slides and pictures, which are compressed already, so
 * compressing again saves little and costs a lot of time on a phone.
 * Reading takes "stored" and "deflated" entries (what Windows, macOS and
 * every zip tool make), using the platform's DecompressionStream, so a zip
 * made anywhere can be imported. Encrypted entries and ZIP64 (archives over
 * 4 GB or 65,535 files) are refused with a message.
 *
 * No `@/` imports and no dependencies, so `node --test` loads it
 * (test/zip.test.mjs).
 */

export type ZipEntry = { path: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Date and time in the two 16-bit MS-DOS fields zip headers use. */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** The largest archive written: past 4 GB a zip needs ZIP64, which this does not write. */
export const MAX_ZIP_BYTES = 0xffffffff - 1024 * 1024;

/** A zip of the entries, uncompressed, with UTF-8 names. */
export function makeZip(entries: ZipEntry[], when = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(when);
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true); // made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, day, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);

    parts.push(local, entry.data as BlobPart);
    offset += local.length + size;
    if (offset > MAX_ZIP_BYTES) throw new Error('That is too much to put in one file (over 4 GB).');
  }

  const centralSize = central.reduce((n, d) => n + d.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...(central as BlobPart[]), end], { type: 'application/zip' });
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Every file in a zip (folders are skipped: a file's path says where it goes).
 * Throws an Error with a message a person can act on when it cannot be read.
 */
export async function readZip(buffer: ArrayBuffer, limits = { maxEntries: 2000, maxBytes: 2 * 1024 ** 3 }): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const notZip = new Error('That file is not a zip, or it is damaged.');

  // The end record sits in the last 22 bytes, or before a comment of up to 64 KB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw notZip;

  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  if (count === 0xffff || pos === 0xffffffff) throw new Error('That zip is too big to import here (ZIP64). Split it into smaller zips.');
  if (count > limits.maxEntries) throw new Error(`That zip holds ${count} items; import at most ${limits.maxEntries} at a time.`);

  const decoder = new TextDecoder();
  const legacy = new TextDecoder('ibm866');
  const files: ZipEntry[] = [];
  let total = 0;

  for (let n = 0; n < count; n++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) throw notZip;
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const size = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const rawName = bytes.subarray(pos + 46, pos + 46 + nameLength);
    const path = (flags & 0x0800 ? decoder : legacy).decode(rawName).replace(/\\/g, '/');
    pos += 46 + nameLength + extraLength + commentLength;

    if (path.endsWith('/')) continue;
    if (flags & 0x0001) throw new Error(`"${path}" is password protected. Make the zip without a password.`);
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('That zip is too big to import here (ZIP64). Split it into smaller zips.');
    }
    total += size;
    if (total > limits.maxBytes) throw new Error('That zip is too big to import in one go. Split it into smaller zips.');

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw notZip;
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const stored = bytes.subarray(start, start + compressedSize);
    if (stored.length !== compressedSize) throw notZip;

    let data: Uint8Array;
    if (method === 0) data = stored;
    else if (method === 8) data = await inflateRaw(stored);
    else throw new Error(`"${path}" is packed in a way this app cannot open. Make the zip with Windows or macOS "compress".`);
    if (data.length !== size) throw notZip;

    files.push({ path, data });
  }
  return files;
}
