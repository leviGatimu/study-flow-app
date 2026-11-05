/**
 * The rules for a homework's written work, kept pure so they can be tested
 * and shared by the form and the server action.
 */

/** Long enough for a full essay; short enough that a paste of a whole book is refused. */
export const HOMEWORK_TEXT_MAX = 20_000;
export const HOMEWORK_TITLE_MAX = 160;

/** Trim the outside, keep the inside (line breaks matter in answers). Empty means none. */
export function cleanWork(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\r\n/g, '\n').trim();
  return text ? text : null;
}

export function workError(label: string, text: string | null): string | null {
  if (text && text.length > HOMEWORK_TEXT_MAX) {
    return `${label} is too long (${text.length.toLocaleString()} characters; the limit is ${HOMEWORK_TEXT_MAX.toLocaleString()}).`;
  }
  return null;
}

/** A "yyyy-MM-dd" due date as UTC midnight, the way homework due dates are stored. */
export function parseDueDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value) ? date : null;
}

/** Image files show inline; anything else is a file to open. */
export function isImageUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.(png|jpe?g|gif|webp)$/i.test(url));
}
