/**
 * Sharing Resources: what goes in the zip a student sends, and how a zip
 * turns back into folders, files and links on the other side.
 *
 * The share is an ordinary zip, so it can travel any way a file can (chat,
 * email, USB) and can be opened without the app. Inside:
 *   study-flow.json         what this is, who sent it, the subject, the links
 *   <folder>/<file>         every file, at its folder path in the subject
 * A zip made outside the app (no study-flow.json) imports too: its files and
 * folders come in as they are.
 *
 * Everything read from a zip is checked here: names are cleaned the way the
 * app names folders, nothing can climb out of the subject ("../"), links must
 * be web addresses, and the counts are capped. The server still applies its
 * own rules to every file (type and size) when it is uploaded.
 *
 * Pure and free of `@/` imports so `node --test` can load it.
 */

export const PACK_KIND = 'study-flow-resources';
export const PACK_VERSION = 1;
export const PACK_MANIFEST = 'study-flow.json';

export const MAX_PACK_FILES = 500;
export const MAX_PACK_LINKS = 500;
export const MAX_PACK_FOLDERS = 300;

export type PackLink = { title: string; url: string; folder: string };

export type PackManifest = {
  kind: typeof PACK_KIND;
  version: number;
  exportedAt: string;
  /** The sender's name, shown as "From …". */
  from: string | null;
  subject: string;
  /** Every folder path, including empty folders (files imply their own). */
  folders: string[];
  links: PackLink[];
};

/** One file to import: where it goes, under what name, and its path in the zip. */
export type PackFile = { zipPath: string; folder: string; name: string; size: number };

export type ImportPlan = {
  /** From the manifest; null for a zip made outside the app. */
  from: string | null;
  /** The subject it was shared from, as a suggestion for where it goes. */
  subject: string | null;
  /** Parents before children, so each can be created in turn. */
  folders: string[];
  files: PackFile[];
  links: PackLink[];
  /** Things left out, in words. */
  skipped: string[];
};

/* ------------------------------------------------------------------ names */

/** System files zip tools add that nobody meant to share. */
const JUNK = /^(\.ds_store|thumbs\.db|desktop\.ini|__macosx)$/i;

/** One folder or file name, cleaned; null when nothing usable is left. */
export function cleanName(name: string): string | null {
  const cleaned = name.replace(/[\u0000-\u001f<>:"|?*\\/]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  return cleaned.slice(0, 120);
}

/** A "/"-joined folder path, each part cleaned; "" for the subject's own folder. */
export function cleanFolder(path: string): string | null {
  const parts = path.split(/[/\\]+/).filter((p) => p !== '' && p !== '.');
  if (parts.some((p) => p === '..')) return null;
  const cleaned: string[] = [];
  for (const part of parts) {
    if (JUNK.test(part)) return null;
    const name = cleanName(part);
    if (!name) return null;
    cleaned.push(name);
  }
  return cleaned.join('/');
}

const isWebAddress = (url: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

/* ----------------------------------------------------------------- export */

export function buildManifest(input: {
  subject: string;
  from: string | null;
  folders: string[];
  links: PackLink[];
  now?: Date;
}): PackManifest {
  return {
    kind: PACK_KIND,
    version: PACK_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    from: input.from,
    subject: input.subject,
    folders: input.folders,
    links: input.links,
  };
}

/** Where a file sits in the zip: its folder path, then its name. */
export function zipPathOf(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

/** A name for the downloaded share: "Physics resources.zip". */
export function packFileName(subject: string): string {
  return `${cleanName(subject) ?? 'Study Flow'} resources.zip`;
}

/* ----------------------------------------------------------------- import */

function readManifest(raw: unknown, skipped: string[]): PackManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<PackManifest>;
  if (m.kind !== PACK_KIND) return null;
  if (typeof m.version !== 'number' || m.version > PACK_VERSION) {
    skipped.push('This share was made by a newer version of the app, so only its files are imported. Update the app to get its links too.');
    return null;
  }
  return m as PackManifest;
}

/**
 * What importing this zip would do. `entries` are the zip's files (path and
 * size); `manifestText` is study-flow.json's text when the zip has one.
 */
export function planImport(entries: { path: string; size: number }[], manifestText: string | null): ImportPlan {
  const skipped: string[] = [];
  let manifest: PackManifest | null = null;
  if (manifestText !== null) {
    try {
      manifest = readManifest(JSON.parse(manifestText), skipped);
    } catch {
      skipped.push('The list of links in this share could not be read, so only its files are imported.');
    }
  }

  // System files (macOS's __MACOSX copies, .DS_Store, Thumbs.db) are dropped
  // first, so they cannot hide a zip's one wrapping folder below.
  const isJunk = (path: string) => path.split('/').some((part) => JUNK.test(part) || part.startsWith('._'));
  const all = entries.filter((e) => e.path !== PACK_MANIFEST);
  let fileEntries = all.filter((e) => !isJunk(e.path));
  let junk = all.length - fileEntries.length;

  // A zip made by "compress this folder" wraps everything in that folder.
  // Without our list, that wrapper is the subject, not a folder inside it.
  let wrapper: string | null = null;
  if (!manifest && fileEntries.length > 0) {
    const tops = new Set(fileEntries.map((e) => (e.path.includes('/') ? e.path.split('/')[0] : '')));
    if (tops.size === 1 && !tops.has('')) {
      wrapper = [...tops][0];
      fileEntries = fileEntries.map((e) => ({ ...e, path: e.path.slice(wrapper!.length + 1) }));
    }
  }

  const folders = new Set<string>();
  const addFolder = (path: string) => {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  };

  const files: PackFile[] = [];
  const seen = new Set<string>();
  for (const entry of fileEntries) {
    const slash = entry.path.lastIndexOf('/');
    const rawName = entry.path.slice(slash + 1);
    const folder = cleanFolder(slash < 0 ? '' : entry.path.slice(0, slash));
    const name = cleanName(rawName);
    if (folder === null || name === null) {
      junk++;
      continue;
    }
    const key = `${folder}/${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    files.push({ zipPath: wrapper ? `${wrapper}/${entry.path}` : entry.path, folder, name, size: entry.size });
    if (folder) addFolder(folder);
  }
  if (junk > 0) skipped.push(`${junk} system ${junk === 1 ? 'file' : 'files'} left out.`);
  if (files.length > MAX_PACK_FILES) {
    skipped.push(`${files.length - MAX_PACK_FILES} files left out: import at most ${MAX_PACK_FILES} at a time.`);
    files.length = MAX_PACK_FILES;
  }

  const links: PackLink[] = [];
  if (manifest) {
    for (const path of Array.isArray(manifest.folders) ? manifest.folders : []) {
      const folder = typeof path === 'string' ? cleanFolder(path) : null;
      if (folder) addFolder(folder);
    }
    let badLinks = 0;
    for (const raw of Array.isArray(manifest.links) ? manifest.links : []) {
      const title = typeof raw?.title === 'string' ? raw.title.trim().slice(0, 200) : '';
      const url = typeof raw?.url === 'string' ? raw.url.trim() : '';
      const folder = typeof raw?.folder === 'string' ? cleanFolder(raw.folder) : '';
      if (!title || !isWebAddress(url) || folder === null) {
        badLinks++;
        continue;
      }
      links.push({ title, url, folder });
      if (folder) addFolder(folder);
    }
    if (badLinks > 0) skipped.push(`${badLinks} ${badLinks === 1 ? 'link' : 'links'} left out: not a web address.`);
    if (links.length > MAX_PACK_LINKS) {
      skipped.push(`${links.length - MAX_PACK_LINKS} links left out: import at most ${MAX_PACK_LINKS} at a time.`);
      links.length = MAX_PACK_LINKS;
    }
  }

  const ordered = [...folders].filter(Boolean).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  if (ordered.length > MAX_PACK_FOLDERS) {
    throw new Error(`That zip has ${ordered.length} folders; import at most ${MAX_PACK_FOLDERS} at a time.`);
  }

  const subject = manifest && typeof manifest.subject === 'string' ? cleanName(manifest.subject) : wrapper ? cleanName(wrapper) : null;
  return {
    from: manifest && typeof manifest.from === 'string' ? manifest.from.slice(0, 120) : null,
    subject,
    folders: ordered,
    files,
    links,
    skipped,
  };
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
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

/** A file's type from its extension, so an imported PDF previews as one. "" when unknown. */
export function mimeOf(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return MIME[ext] ?? '';
}

/** Group files by folder, in batches small enough for one upload request each. */
export function uploadBatches(files: PackFile[], maxFiles = 10, maxBytes = 40 * 1024 * 1024): PackFile[][] {
  const byFolder = new Map<string, PackFile[]>();
  for (const f of files) byFolder.set(f.folder, [...(byFolder.get(f.folder) ?? []), f]);
  const batches: PackFile[][] = [];
  for (const group of byFolder.values()) {
    let batch: PackFile[] = [];
    let bytes = 0;
    for (const f of group) {
      if (batch.length > 0 && (batch.length >= maxFiles || bytes + f.size > maxBytes)) {
        batches.push(batch);
        batch = [];
        bytes = 0;
      }
      batch.push(f);
      bytes += f.size;
    }
    if (batch.length) batches.push(batch);
  }
  return batches;
}
