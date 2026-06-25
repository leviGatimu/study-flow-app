/**
 * Minimal client-side ID3v2 reader for MP3 uploads.
 * Extracts title (TIT2/TT2), artist (TPE1/TP1) and embedded album art (APIC/PIC)
 * so uploaded songs look like a real music library without manual data entry.
 * Anything it can't parse simply falls back to the filename.
 */

export interface SongMetadata {
  title?: string;
  artist?: string;
  picture?: Blob;
  lyrics?: string;
}

function syncsafeToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length < 1) return '';
  const encoding = bytes[0];
  const data = bytes.subarray(1);
  try {
    if (encoding === 0) return new TextDecoder('latin1').decode(data).replace(/\0+$/, '');
    if (encoding === 1) return new TextDecoder('utf-16').decode(data).replace(/\0+$/, '');
    if (encoding === 2) return new TextDecoder('utf-16be').decode(data).replace(/\0+$/, '');
    return new TextDecoder('utf-8').decode(data).replace(/\0+$/, '');
  } catch {
    return '';
  }
}

/** Find the index just past the text terminator for the given encoding. */
function skipTerminatedString(bytes: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2;
    }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i++) {
    if (bytes[i] === 0) return i + 1;
  }
  return bytes.length;
}

/** USLT/ULT frame: encoding(1) + language(3) + descriptor(terminated) + text. */
function parseUslt(frame: Uint8Array): string | undefined {
  if (frame.length < 6) return undefined;
  const encoding = frame[0];
  let offset = 4; // skip encoding + 3-byte language code
  offset = skipTerminatedString(frame, offset, encoding);
  if (offset >= frame.length) return undefined;
  // decodeText expects the encoding byte up front, so re-prefix it.
  const joined = new Uint8Array(frame.length - offset + 1);
  joined[0] = encoding;
  joined.set(frame.subarray(offset), 1);
  const text = decodeText(joined).trim();
  return text || undefined;
}

function parseApic(frame: Uint8Array, isV22: boolean): Blob | undefined {
  if (frame.length < 4) return undefined;
  const encoding = frame[0];
  let offset = 1;
  let mime = 'image/jpeg';

  if (isV22) {
    // v2.2 PIC: 3-char image format instead of a mime string
    const format = new TextDecoder('latin1').decode(frame.subarray(1, 4)).toLowerCase();
    mime = format.includes('png') ? 'image/png' : 'image/jpeg';
    offset = 4;
  } else {
    let end = offset;
    while (end < frame.length && frame[end] !== 0) end++;
    mime = new TextDecoder('latin1').decode(frame.subarray(offset, end)) || 'image/jpeg';
    offset = end + 1;
  }

  offset += 1; // picture type byte
  offset = skipTerminatedString(frame, offset, encoding); // description

  if (offset >= frame.length) return undefined;
  // slice() copies into a fresh ArrayBuffer, which Blob's typing requires
  return new Blob([frame.slice(offset)], { type: mime });
}

export async function extractSongMetadata(file: File): Promise<SongMetadata> {
  const result: SongMetadata = {};
  try {
    // Tags live at the start of the file; 2 MB covers virtually all album art.
    const head = new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer());
    if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) {
      return result; // no ID3v2 tag
    }

    const major = head[3];
    const tagSize = syncsafeToInt(head, 6);
    const isV22 = major === 2;
    const idLen = isV22 ? 3 : 4;
    const headerLen = isV22 ? 6 : 10;

    let pos = 10;
    const end = Math.min(10 + tagSize, head.length);

    while (pos + headerLen <= end) {
      const id = new TextDecoder('latin1').decode(head.subarray(pos, pos + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break; // hit padding

      let size: number;
      if (isV22) {
        size = (head[pos + 3] << 16) | (head[pos + 4] << 8) | head[pos + 5];
      } else if (major === 4) {
        size = syncsafeToInt(head, pos + 4);
      } else {
        size = readUint32(head, pos + 4);
      }
      if (size <= 0 || pos + headerLen + size > end) break;

      const body = head.subarray(pos + headerLen, pos + headerLen + size);
      if (id === 'TIT2' || id === 'TT2') result.title = decodeText(body) || result.title;
      else if (id === 'TPE1' || id === 'TP1') result.artist = decodeText(body) || result.artist;
      else if ((id === 'APIC' || id === 'PIC') && !result.picture) result.picture = parseApic(body, isV22);
      else if ((id === 'USLT' || id === 'ULT') && !result.lyrics) result.lyrics = parseUslt(body);

      pos += headerLen + size;
    }
  } catch {
    // Corrupt/unsupported tags are fine — caller falls back to the filename.
  }
  return result;
}

/** Measure track length by loading metadata into a detached audio element. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.addEventListener('loadedmetadata', () => {
      cleanup(Number.isFinite(audio.duration) ? audio.duration : null);
    });
    audio.addEventListener('error', () => cleanup(null));
    setTimeout(() => cleanup(null), 8000);
    audio.preload = 'metadata';
    audio.src = url;
  });
}
