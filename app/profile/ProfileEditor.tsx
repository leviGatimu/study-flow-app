'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/profile-actions';
import { MAX_AVATAR_BYTES, profilePhotoUrl } from '@/lib/profile-input';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';

export type EditableProfile = { name: string; bio: string | null; school: string | null; timezone: string; avatarUrl: string | null };

export function ProfileEditor({ profile, username }: { profile: EditableProfile; username: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [school, setSchool] = useState(profile.school ?? '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  const reset = () => {
    setName(profile.name); setBio(profile.bio ?? ''); setSchool(profile.school ?? ''); setTimezone(profile.timezone);
    setPhoto(null); setPreview(null); setRemovePhoto(false); setError(null);
    if (fileInput.current) fileInput.current.value = '';
  };
  const changed = name !== profile.name || bio !== (profile.bio ?? '') || school !== (profile.school ?? '') || timezone !== profile.timezone || photo !== null || removePhoto;
  return <Panel padded={false} className="overflow-hidden"><form onSubmit={(e) => {
    e.preventDefault();
    setError(null);
    const data = new FormData();
    data.set('name', name); data.set('bio', bio); data.set('school', school); data.set('timezone', timezone);
    data.set('removePhoto', String(removePhoto));
    if (photo) data.set('photo', photo);
    startTransition(async () => {
      try {
        const result = await updateProfile(data);
        if (result.error) return setError(result.error);
        toast.success('Profile updated.');
        router.refresh();
      } catch { setError('Your profile could not be saved. Your edits are still here; please try again.'); }
    });
  }}>
    <fieldset disabled={pending} className="min-w-0">
      <div className="flex flex-col gap-5 border-b border-border bg-primary/5 p-6 sm:flex-row sm:items-center md:p-8">
        {photo && preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="New profile photo preview" className="size-28 rounded-full object-cover ring-4 ring-background" />
          : <ProfileAvatar name={name} url={removePhoto ? null : profile.avatarUrl} className="size-28 bg-card text-3xl ring-4 ring-background" />}
        <div className="min-w-0 space-y-3">
          <div><h2 className="truncate font-heading text-2xl font-semibold">{name || 'Your profile'}</h2><p className="text-sm text-muted-foreground">@{username}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><Camera />Change photo</Button>
            {(photo || profilePhotoUrl(profile.avatarUrl)) && !removePhoto && <Button type="button" variant="ghost" onClick={() => { setPhoto(null); setPreview(null); setRemovePhoto(true); if (fileInput.current) fileInput.current.value = ''; }}><Trash2 />Remove</Button>}
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB. Photos are cropped to a square.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_AVATAR_BYTES) {
              setError('Choose a JPG, PNG or WebP photo smaller than 5 MB.'); e.target.value = ''; return;
            }
            setError(null); setRemovePhoto(false); setPhoto(file); setPreview(URL.createObjectURL(file));
          }} />
        </div>
      </div>
      <div className="space-y-5 p-6 md:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="profile-name">Display name</Label><Input id="profile-name" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="profile-school">School or college</Label><Input id="profile-school" maxLength={120} autoComplete="organization" placeholder="Where you study" value={school} onChange={(e) => setSchool(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="profile-bio">About you</Label><textarea id="profile-bio" maxLength={500} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What are you studying? What are you working towards?" className="w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-right text-xs text-muted-foreground">{bio.length}/500</p></div>
        <div className="space-y-2"><Label htmlFor="profile-timezone">Timezone</Label><Input id="profile-timezone" required list="profile-timezones" value={timezone} onChange={(e) => setTimezone(e.target.value)} aria-describedby="timezone-hint" /><datalist id="profile-timezones">{['Africa/Johannesburg', 'Africa/Kigali', 'Africa/Nairobi', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'].map((zone) => <option key={zone} value={zone} />)}</datalist><p id="timezone-hint" className="text-xs text-muted-foreground">Your schedule, exam times and daily progress use this timezone.</p></div>
      </div>
    </fieldset>
    <div className="border-t border-border px-6 py-4 md:px-8">
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Your profile is private to your account.</p><div className="flex gap-2"><Button type="button" variant="ghost" disabled={pending || !changed} onClick={reset}>Cancel</Button><Button type="submit" disabled={pending || !changed}>{pending && <Loader2 className="animate-spin" />}{pending ? 'Saving…' : 'Save changes'}</Button></div></div>
    </div>
  </form></Panel>;
}
