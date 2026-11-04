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

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export default async function ProfilePage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');
  const [data, scope] = await Promise.all([getSettingsData(), getActiveScope(userId)]);
  if (!data?.progress) redirect('/welcome');
  const progress = data.progress;
  const stats = [
    { icon: Trophy, label: 'Level', value: String(progress.level), detail: `${progress.xp.toLocaleString()} XP` },
    { icon: Flame, label: 'Streak', value: plural(progress.currentStreak, 'day'), detail: `Best ${plural(progress.longestStreak, 'day')}` },
    { icon: Timer, label: 'Focus time', value: `${Math.floor(progress.totalFocusMinutes / 60)}h ${progress.totalFocusMinutes % 60}m`, detail: 'All time' },
    { icon: CalendarDays, label: 'Joined', value: new Date(data.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: progress.timezone }), detail: new Date(data.createdAt).toLocaleDateString('en-GB', { year: 'numeric', timeZone: progress.timezone }) },
  ];
  return <Page>
    <PageHeader title="Your profile" description="Your details, photo and account." />
    <PageBody>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <ProfileEditor key={progress.updatedAt.toISOString()} profile={{ name: progress.name, bio: progress.bio, school: progress.school, timezone: progress.timezone, avatarUrl: progress.avatarUrl }} username={data.username} />
        <Panel>
          <PanelTitle icon={<GraduationCap />}>Your study journey</PanelTitle>
          <p className="font-heading text-2xl font-semibold">{scope?.label ?? 'No year set up'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{scope ? 'Your current academic year.' : 'Set up your academic year to start tracking your progress.'}</p>
          <Link href="/year" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Manage year &amp; terms</Link>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            {stats.map(({ icon: Icon, label, value, detail }) => (
              <div key={label} className="min-w-0 rounded-xl border border-border/60 bg-muted/40 p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" />{label}</dt>
                <dd className="mt-2 truncate font-heading text-xl font-bold tabular-nums">{value}</dd>
                <dd className="truncate text-xs text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <ProfileSettings data={data} showDetails={false} />
    </PageBody>
  </Page>;
}
