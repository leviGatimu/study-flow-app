import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get current date/time in Rwanda (Africa/Kigali)
 */
export function getRwandaTime() {
  const now = new Date();
  // We use Intl to get a string in Rwanda's time, then parse it back or use its parts
  // But simpler for logic is to adjust the date object for calculations
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Kigali',
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

  const rwandaNow = new Date(
    findPart('year'),
    findPart('month') - 1,
    findPart('day'),
    findPart('hour'),
    findPart('minute'),
    findPart('second')
  );
  
  return rwandaNow;
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
