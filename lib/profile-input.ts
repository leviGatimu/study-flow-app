export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function validateProfile(input: { name: unknown; bio: unknown; school: unknown; timezone: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const bio = typeof input.bio === 'string' ? input.bio.trim() : '';
  const school = typeof input.school === 'string' ? input.school.trim() : '';
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : '';
  if (!name || name.length > 80) return { error: 'Enter a display name between 1 and 80 characters.' } as const;
  if (bio.length > 500) return { error: 'Keep your bio to 500 characters or fewer.' } as const;
  if (school.length > 120) return { error: 'Keep your school name to 120 characters or fewer.' } as const;
  try {
    if (!timezone) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch { return { error: 'Choose a valid timezone, such as Africa/Johannesburg.' } as const; }
  return { data: { name, bio: bio || null, school: school || null, timezone } } as const;
}

/** Only our own normalized uploads may render as account photos. */
export function profilePhotoUrl(value?: string | null): string | null {
  return value && /^\/uploads\/avatar-[a-zA-Z0-9_.-]+\.webp$/.test(value) ? value : null;
}
