/**
 * What may be called what. Windows is the strictest of the filesystems this
 * will meet, so its rules are the rules everywhere: a name accepted on the
 * web has to be creatable on the desktop it later syncs to.
 *
 * Dependency-free so the client bundle and `node --test` can both load it.
 */

export const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
export const MAX_NAME_LENGTH = 120;

/**
 * Why a user-typed folder or file name is unacceptable, or null when it is
 * fine. Worded for the person who typed it, since the dialog shows it as is.
 */
export function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give it a name.';
  if (trimmed === '.' || trimmed === '..') return 'That name is not allowed.';
  if (INVALID_CHARS.test(trimmed)) {
    return 'A name cannot contain any of these characters: < > : " / \\ | ? *';
  }
  if (/[. ]$/.test(trimmed)) return 'A name cannot end with a dot or a space.';
  if (RESERVED.test(trimmed)) return 'That name is reserved by Windows.';
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `That name is too long (${MAX_NAME_LENGTH} characters max).`;
  }
  return null;
}

/**
 * Coerce a name the user did NOT type as a folder name - a subject, a year
 * label, an uploaded file's original name - into something Windows accepts.
 * "2025/2026" becomes "2025-2026"; "Physics?" becomes "Physics".
 */
export function safeSegment(name: string): string {
  let s = name
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s || s === '.' || s === '..') s = 'Untitled';
  if (RESERVED.test(s)) s = `_${s}`;
  return s.slice(0, MAX_NAME_LENGTH);
}

