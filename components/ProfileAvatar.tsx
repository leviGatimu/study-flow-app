'use client';

import { useState } from 'react';
import { profilePhotoUrl } from '@/lib/profile-input';
import { cn } from '@/lib/utils';

export function ProfileAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = profilePhotoUrl(url);
  return <span className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-heading font-bold text-primary', className)}>
    {photo && failed !== photo
      // Authenticated uploads are served directly; the image optimizer has no session cookie.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={photo} alt={`${name}'s profile photo`} onError={() => setFailed(photo)} className="size-full object-cover" />
      : <span aria-hidden>{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'}</span>}
  </span>;
}
