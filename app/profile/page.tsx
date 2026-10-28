import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Flame, GraduationCap, Timer, Trophy } from 'lucide-react';
import { getSettingsData } from '@/lib/actions';
import { getUserId } from '@/lib/auth';
import { getActiveScope } from '@/lib/scope';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { ProfileSettings } from '@/app/settings/ProfileSettings';
import { ProfileEditor } from './ProfileEditor';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');
  const [data, scope] = await Promise.all([getSettingsData(), getActiveScope(userId)]);
  if (!data?.progress) redirect('/welcome');
  const progress = data.progress;
  return <Page>
    <PageHeader title="Your profile" description="Make Study Flow yours. Update your details, photo and account settings." />
    <PageBody>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-6">
          <ProfileEditor key={progress.updatedAt.toISOString()} profile={{ name: progress.name, bio: progress.bio, school: progress.school, timezone: progress.timezone, avatarUrl: progress.avatarUrl }} username={data.username} />
          <ProfileSettings data={data} showDetails={false} />
        </div>
        <aside className="space-y-6">
          <Panel>
            <PanelTitle icon={<GraduationCap />}>Your study journey</PanelTitle>
            <p className="font-heading text-2xl font-semibold">{scope?.label ?? 'Your next chapter'}</p>
            <p className="mt-2 text-sm text-muted-foreground">{scope ? 'Keep showing up. Every session counts.' : 'Set up your academic year to start tracking your progress.'}</p>
            <Link href="/year" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Manage year & terms</Link>
            <div className="mt-6 divide-y divide-border border-t border-border">
              {[
                { icon: Trophy, label: 'Level', value: `${progress.level} · ${progress.xp.toLocaleString()} XP` },
                { icon: Flame, label: 'Current streak', value: `${progress.currentStreak} days` },
                { icon: Timer, label: 'Focus time', value: `${Math.floor(progress.totalFocusMinutes / 60)}h ${progress.totalFocusMinutes % 60}m` },
                { icon: CalendarDays, label: 'Joined', value: new Date(data.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: progress.timezone }) },
              ].map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center gap-3 py-4 text-sm"><Icon className="size-4 text-muted-foreground" /><span className="text-muted-foreground">{label}</span><span className="ml-auto font-semibold">{value}</span></div>)}
            </div>
          </Panel>
        </aside>
      </div>
    </PageBody>
  </Page>;
}
