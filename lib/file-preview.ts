/**
 * Which in-app viewer opens a file, by extension.
 *
 * Pure and free of `@/` imports so `node --test` can load it. The binary
 * Office formats from before 2007 (.doc/.ppt/.xls) are named separately: no
 * browser library reads them, and converting them would need LibreOffice on
 * the server, which the website cannot run. They get a plain explanation and
 * a download instead of a broken viewer.
 */

export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'csv'
  | 'text'
  | 'legacy-office'
  | 'none';

const BY_EXT: Record<string, PreviewKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  pdf: 'pdf',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  oga: 'audio',
  flac: 'audio',
  opus: 'audio',
  mp4: 'video',
  webm: 'video',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx',
  csv: 'csv',
  txt: 'text',
  md: 'text',
  doc: 'legacy-office',
  ppt: 'legacy-office',
  xls: 'legacy-office',
};

export function previewKind(ext: string): PreviewKind {
  return BY_EXT[ext.toLowerCase().replace(/^\./, '')] ?? 'none';
}

/** Files above this are offered as a download only: parsing them in a tab would stall it. */
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

/** The newer format to save an old Office file as, for the explanation shown instead of a preview. */
export function modernFormatFor(ext: string): { app: string; ext: string } | null {
  switch (ext.toLowerCase()) {
    case 'doc':
      return { app: 'Word', ext: 'docx' };
    case 'ppt':
      return { app: 'PowerPoint', ext: 'pptx' };
    case 'xls':
      return { app: 'Excel', ext: 'xlsx' };
    default:
      return null;
  }
}

/**
 * Split CSV text into rows. Handles quoted fields, doubled quotes inside
 * them, and line breaks inside quotes. Stops at `maxRows` so a huge export
 * cannot freeze the tab.
 */
export function parseCsv(text: string, maxRows = 5000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length >= maxRows) return rows;
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Whether a link inside a rendered document may stay clickable. Documents are
 * untrusted: a `javascript:` or `data:` href would run in the app's origin.
 */
export function isSafeDocumentHref(href: string | null): boolean {
  if (!href) return false;
  const value = href.trim().toLowerCase();
  if (value.startsWith('#')) return true;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:');
}
