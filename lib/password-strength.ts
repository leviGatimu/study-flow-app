/**
 * Advisory password strength for the register and change-password forms.
 * The server only requires 8+ characters; this just nudges toward better.
 */
export type PasswordStrength = { score: 1 | 2 | 3 | 4; label: string; tone: string };

const LEVELS: Record<1 | 2 | 3 | 4, PasswordStrength> = {
  1: { score: 1, label: 'Weak', tone: 'bg-red-500' },
  2: { score: 2, label: 'Fair', tone: 'bg-orange-500' },
  3: { score: 3, label: 'Good', tone: 'bg-blue-500' },
  4: { score: 4, label: 'Strong', tone: 'bg-emerald-500' },
};

export function passwordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  if (password.length < 8) return { score: 1, label: 'Too short', tone: 'bg-red-500' };
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return LEVELS[Math.min(score, 4) as 1 | 2 | 3 | 4];
}
