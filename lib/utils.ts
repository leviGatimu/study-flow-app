import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The timezone used for users who haven't picked one. Africa/Kigali (UTC+2)
 * keeps the original behavior for Levi and any pre-existing users.
 */
export const DEFAULT_TIMEZONE = 'Africa/Kigali';

/**
 * Get the current wall-clock date/time in a given IANA timezone, returned as a
 * Date whose local fields (getHours, getDate, ...) match that timezone. This is
 * the building block for all "what day/time is it for this user" logic.
 */
export function getZonedNow(timeZone: string = DEFAULT_TIMEZONE) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const findPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");

  // Intl can emit hour "24" at midnight in some locales; normalize to 0.
  const hour = findPart('hour') % 24;

  return new Date(
    findPart('year'),
    findPart('month') - 1,
    findPart('day'),
    hour,
    findPart('minute'),
    findPart('second')
  );
}

/**
 * Offset (in minutes) of an IANA timezone from UTC at a given instant, e.g.
 * +120 for Africa/Kigali. DST-aware via the supplied instant. Used to turn a
 * UTC-stored date into the right calendar day-key for that timezone.
 */
export function getTimeZoneOffsetMinutes(timeZone: string = DEFAULT_TIMEZONE, at: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(at);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value);
  }

  const hour = (map.hour ?? 0) % 24;
  const asUTC = Date.UTC(map.year, (map.month ?? 1) - 1, map.day ?? 1, hour, map.minute ?? 0, map.second ?? 0);
  return Math.round((asUTC - at.getTime()) / 60000);
}

/**
 * Backwards-compatible alias: current time in Rwanda (Africa/Kigali).
 * @deprecated Prefer getZonedNow(userTimezone) so per-user timezones are respected.
 */
export function getRwandaTime() {
  return getZonedNow(DEFAULT_TIMEZONE);
}

/**
 * Human-friendly city label for an IANA timezone, e.g.
 * "America/New_York" -> "New York", "Africa/Kigali" -> "Kigali".
 */
export function formatTimeZoneLabel(timeZone: string = DEFAULT_TIMEZONE): string {
  const city = timeZone.split('/').pop() || timeZone;
  return city.replace(/_/g, ' ');
}

/**
 * Normalization Utility: Clean subject names to group them correctly
 */
export function normalizeSubject(subject: string) {
  if (!subject) return '';
  return subject
    .replace(/\s*\(revision\)\s*/gi, '')
    .replace(/'/g, '')
    .trim();
}

/**
 * Subject Similarity Matcher: Group shorthand and spelling variants cleanly
 */
export function isSubjectSimilar(a: string, b: string): boolean {
  const normA = normalizeSubject(a).toLowerCase();
  const normB = normalizeSubject(b).toLowerCase();
  
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  
  // Check if one is a substring of the other
  if (normA.includes(normB) || normB.includes(normA)) return true;
  
  // Check common abbreviations/synonyms
  if ((normA.includes('javascript') || normA.includes('js')) && (normB.includes('javascript') || normB.includes('js'))) return true;
  if ((normA.includes('php') || normA.includes('web php')) && (normB.includes('php') || normB.includes('web php'))) return true;
  if ((normA.includes('embedded') || normA.includes('embeded')) && (normB.includes('embedded') || normB.includes('embeded'))) return true;
  if ((normA.includes('networking') || normA.includes('network')) && (normB.includes('networking') || normB.includes('network'))) return true;
  if ((normA.includes('database') || normA.includes('db')) && (normB.includes('database') || normB.includes('db'))) return true;
  if ((normA.includes('kinyarwanda') || normA.includes('ikinyarwanda')) && (normB.includes('kinyarwanda') || normB.includes('ikinyarwanda'))) return true;
  if ((normA.includes('c prog') || normA === 'c' || normA === 'c++') && (normB.includes('c prog') || normB === 'c' || normB === 'c++' || normB.includes('programming using c'))) return true;
  if (normB.includes(normA) || normA.includes(normB)) return true;

  return false;
}
