import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

/**
 * Stream a file off the local disk as an HTTP response, with Range support.
 *
 * Shared by app/uploads/[...path] (the flat upload store) and
 * app/library/[...path] (the desktop's per-subject library folders). Both
 * routes decide WHAT may be read - authentication and path containment - and
 * hand the resolved absolute path here to decide HOW it goes out.
 *
 * Imports nothing but Node, so test/uploads-range.test.mjs can load the real
 * parser rather than a copy of it.
 */

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  opus: 'audio/opus',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

/**
 * Parse a single-range `Range: bytes=start-end` header against a known size.
 *
 * Returns undefined when there is no range to honour, or null when the range
 * is unsatisfiable (which the caller answers with a 416). Only one range is
 * supported: multipart/byteranges buys nothing for audio seeking or a PDF
 * reader, and every client falls back gracefully to a full response.
 */
export function parseRange(header: string | null, size: number) {
  if (!header) return undefined;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return undefined;

  let start: number;
  let end: number;

  if (rawStart === '') {
    // "bytes=-500" means the LAST 500 bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size || end < start) return null;

  return { start, end: Math.min(end, size - 1) };
}

/**
 * Respond with the file at `full`, honouring a Range header.
 *
 * `immutable` says whether the URL can ever come to mean different bytes. The
 * flat upload store embeds a timestamp in every name, so it can be cached for
 * a year; a library file keeps its human name and can be overwritten from
 * Windows Explorer, so it is revalidated on every open.
 */
export async function serveLocalFile(
  full: string,
  request: Request,
  { immutable }: { immutable: boolean }
): Promise<Response> {
  let size: number;
  let mtime: Date;
  try {
    const info = await stat(full);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    size = info.size;
    mtime = info.mtime;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const common = {
    'Content-Type': mimeFor(full),
    // Private either way: it is the user's own file.
    'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache',
    'Last-Modified': mtime.toUTCString(),
    'Content-Disposition': 'inline',
    // Never let a stored file be interpreted as something else.
    'X-Content-Type-Options': 'nosniff',
    // Advertised on every response, not just partial ones - it is how a client
    // learns it may range-request at all.
    'Accept-Ranges': 'bytes',
  };

  // Without this the <audio> element cannot seek: it issues a ranged request,
  // gets a 200 with the whole body instead of a 206, and Chromium then treats
  // the resource as non-seekable. It also lets a PDF reader fetch page by page
  // rather than pulling the whole file before showing anything.
  const range = parseRange(request.headers.get('range'), size);

  if (range === null) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: { ...common, 'Content-Range': `bytes */${size}` },
    });
  }

  if (range) {
    const { start, end } = range;
    const partial = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;

    return new Response(partial, {
      status: 206,
      headers: {
        ...common,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;

  return new Response(stream, {
    headers: { ...common, 'Content-Length': String(size) },
  });
}
