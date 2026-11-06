'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ArrowUpRight, BookOpen, ChevronRight, Database, HardDrive, LayoutDashboard, RefreshCw, Search, ShieldCheck, TriangleAlert, UserPlus, Users } from 'lucide-react';

import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { focusDuration } from '@/lib/focus-record';
import { isOnline, lastSeenLabel } from '@/lib/last-seen';
import { cn } from '@/lib/utils';
import type { AdminConsole, SystemHealth } from '@/lib/admin-actions';

type Section = 'overview' | 'accounts' | 'activity' | 'system';

const SECTIONS = [
  ['overview', 'Overview', LayoutDashboard],
  ['accounts', 'Accounts', Users],
  ['activity', 'Activity', Activity],
  ['system', 'System', ShieldCheck],
] as const;

export function AdminDashboard({ overview, users, health, source }: AdminConsole) {
  const [section, setSection] = useState<Section>('overview');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const local = source.mode === 'device';

  const attention = needsAttention(overview, health);

  return (
    <Page bleed className="min-h-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold leading-tight tracking-tight text-foreground">Admin console</h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground" role="status">
            <Database aria-hidden="true" className="size-3" />
            {source.mode === 'server' ? `Connected server${source.serverUrl ? `, ${new URL(source.serverUrl).host}` : ''}` : local ? 'This device only' : 'All accounts on this deployment'}
            <span>· Updated {dateTime(source.checkedAt)}</span>
            {local && (
              <Link href="/settings?tab=sync" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                Connect sync for server reports <ArrowUpRight className="size-3" />
              </Link>
            )}
            {source.mode === 'server' && (
              <Link href="/admin?source=device" className="font-medium text-primary hover:underline">View device records</Link>
            )}
          </p>
        </div>
        <Button variant="outline" className="ml-auto" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          <RefreshCw className={cn(pending && 'animate-spin')} />
          {pending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Admin sections" className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 p-2 md:w-52 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
          {SECTIONS.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? 'page' : undefined}
              onClick={() => setSection(id)}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                section === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
              {id === 'accounts' && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{users.length}</span>}
              {id === 'system' && attention.length > 0 && <span className="ml-auto size-2 rounded-full bg-orange-500" aria-label="Has items needing attention" />}
            </button>
          ))}
        </nav>

        <div aria-busy={pending} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl">
            {section === 'overview' && <Overview overview={overview} attention={attention} onOpenSystem={() => setSection('system')} />}
            {section === 'accounts' && <Accounts users={users} suffix={local ? '?source=device' : ''} />}
            {section === 'activity' && <ActivitySection overview={overview} />}
            {section === 'system' && <System health={health} overview={overview} />}
          </div>
        </div>
      </div>
    </Page>
  );
}

type Overview = AdminConsole['overview'];

function needsAttention(overview: Overview, health: SystemHealth): string[] {
  const items: string[] = [];
  if (!health.database.reachable) items.push(`The database is unavailable${health.database.error ? `: ${health.database.error}` : ''}`);
  if (health.syncErrors.length) items.push(`${health.syncErrors.length} device${health.syncErrors.length === 1 ? '' : 's'} reported a sync error`);
  const notApplied = health.migrations.filter((m) => m.rolledBack || !m.appliedAt).length;
  if (notApplied) items.push(`${notApplied} database migration${notApplied === 1 ? ' is' : 's are'} not applied`);
  const orphans = health.orphans.reduce((sum, o) => sum + o.count, 0);
  if (orphans) items.push(`${orphans} record${orphans === 1 ? ' has' : 's have'} no valid owner or year`);
  if (overview.totals.pendingMarks) items.push(`${overview.totals.pendingMarks} practice attempt${overview.totals.pendingMarks === 1 ? ' is' : 's are'} waiting for marks`);
  return items;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</dd>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Facts({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-border/60 text-sm">
      {rows.map(([label, value], i) => (
        <div key={i} className="flex justify-between gap-4 py-2">
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Registrations({ overview }: { overview: Overview }) {
  const months = overview.signups.slice(-12);
  const most = Math.max(1, ...months.map((m) => m.count));
  return (
    <Panel>
      <PanelTitle icon={<UserPlus />}>Registrations by month</PanelTitle>
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">No registrations recorded.</p>
      ) : (
        <ol className="space-y-1.5">
          {months.map((m) => (
            <li key={m.month} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{m.month}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${m.count} registrations`}>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(m.count / most) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">{m.count}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Overview({ overview, attention, onOpenSystem }: { overview: Overview; attention: string[]; onOpenSystem: () => void }) {
  const t = overview.totals;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Accounts" value={t.users} hint={`${overview.activeLast7} active in 7 days`} />
        <Metric label="Recorded focus" value={focusDuration(t.focusSeconds)} hint={`${t.measuredSessions} measured sessions`} />
        <Metric label="Completed blocks" value={t.completedBlocks} hint={`${t.tasks} study blocks in total`} />
        <Metric label="Practice attempts" value={t.attempts} hint={`${t.practiceSets} saved sets`} />
      </dl>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            icon={<TriangleAlert />}
            action={
              <Button variant="ghost" size="sm" onClick={onOpenSystem}>
                System <ChevronRight />
              </Button>
            }
          >
            Needs attention
          </PanelTitle>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs your attention.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attention.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-orange-500" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Registrations overview={overview} />
      </div>
    </div>
  );
}

function Accounts({ users, suffix }: { users: AdminConsole['users']; suffix: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [now] = useState(() => Date.now());
  const matches = users.filter(
    (u) =>
      `${u.username} ${u.name ?? ''} ${u.school ?? ''}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter !== 'admin' || u.isAdmin) &&
      (filter !== 'recent' || (u.lastActiveDate && now - new Date(u.lastActiveDate).getTime() < 7 * 86400000))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search accounts" placeholder="Search name, username or school" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger aria-label="Filter accounts" className="h-10 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="admin">Administrators</SelectItem>
            <SelectItem value="recent">Active in 7 days</SelectItem>
          </SelectContent>
        </Select>
        <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">{matches.length} accounts</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Last seen</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Study records</th>
              <th scope="col" className="px-4 py-2.5 font-medium">AI</th>
              <th scope="col" className="w-10 px-4 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {matches.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(u.name || u.username).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-foreground">
                        <span className="truncate">{u.name || u.username}</span>
                        {u.isAdmin && <Pill tone="success">Admin</Pill>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">@{u.username}{u.school ? ` · ${u.school}` : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(isOnline(u.lastActiveDate, now) && 'font-medium text-success')}>{lastSeenLabel(u.lastActiveDate, now)}</span>
                  <p className="text-xs text-muted-foreground">Joined {date(u.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  {u.counts.tasks} blocks
                  <p className="text-xs text-muted-foreground">{u.counts.subjects} subjects · {u.counts.exams} exams</p>
                </td>
                <td className="px-4 py-3">
                  {u.hasAi ? 'Connected' : 'Not connected'}
                  <p className="text-xs text-muted-foreground">{u.timezone}</p>
                </td>
                <td className="px-2 py-3">
                  <Button asChild variant="ghost" size="icon" aria-label={`Open ${u.username}`}>
                    <Link href={`/admin/users/${u.id}${suffix}`}><ChevronRight /></Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {matches.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No accounts match this search.</p>}
      </div>
    </div>
  );
}

function ActivitySection({ overview }: { overview: Overview }) {
  const t = overview.totals;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Panel>
        <PanelTitle icon={<Activity />}>Account activity</PanelTitle>
        <Facts
          rows={[
            ['Active in 7 days', overview.activeLast7],
            ['Active in 30 days', overview.activeLast30],
            ['No activity recorded', overview.neverActive],
            ['AI connection set up', overview.aiConfigured],
            ['Devices reporting status', overview.syncDevices],
          ]}
        />
        <p className="mt-3 text-xs text-muted-foreground">Activity counts time with the app open. Focus totals include measured sessions; older totals stay on each account&apos;s page.</p>
      </Panel>
      <Panel>
        <PanelTitle icon={<BookOpen />}>What people have saved</PanelTitle>
        <Facts
          rows={[
            ['Practice sets', t.practiceSets],
            ['Attempts awaiting marks', t.pendingMarks],
            ['Runs in progress', t.drafts],
            ['Saved resources', t.resources],
            ['AI conversations', t.aiSessions],
            ['School lessons', t.lessons],
            ['Exams', t.exams],
            ['Homework', t.homework],
          ]}
        />
      </Panel>
      <Registrations overview={overview} />
    </div>
  );
}

function System({ health, overview }: { health: SystemHealth; overview: Overview }) {
  const applied = health.migrations.filter((m) => m.appliedAt && !m.rolledBack).length;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Panel>
        <PanelTitle icon={<HardDrive />}>Services</PanelTitle>
        <Facts
          rows={[
            ['Database', `${health.database.reachable ? 'Connected' : 'Unavailable'} · ${health.database.provider}`],
            ['Upload storage', overview.storageBackend === 'object' ? 'Managed object storage' : 'Local disk'],
            ...(overview.storage
              ? ([
                  ['Uploaded files', overview.storage.fileCount],
                  ['Disk usage', bytes(overview.storage.uploadsBytes)],
                ] as [ReactNode, ReactNode][])
              : []),
            ['Recorded sync errors', health.syncErrors.length],
          ]}
        />
        {!health.database.reachable && health.database.error && <p className="mt-3 break-words text-sm text-destructive">{health.database.error}</p>}
      </Panel>

      <Panel>
        <PanelTitle icon={<Activity />}>Device sync reports</PanelTitle>
        {health.syncErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync errors have been reported. Devices report when they connect.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {health.syncErrors.map((item) => (
              <li key={`${item.userId}:${item.deviceId}`} className="space-y-1 py-2 text-sm">
                <p className="break-words text-destructive">{item.lastError}</p>
                <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{item.lastSyncAt ? dateTime(item.lastSyncAt) : 'No sync recorded'} · {item.deviceId}</span>
                  <Link href={`/admin/users/${item.userId}`} className="shrink-0 font-medium text-primary hover:underline">Open account</Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelTitle icon={<ShieldCheck />}>Data coverage</PanelTitle>
        <Facts rows={health.orphans.map((o) => [o.label, o.count])} />
        <h3 className="mb-1 mt-5 text-sm font-medium">Deleted records kept for sync</h3>
        <Facts rows={health.tombstones.map((o) => [o.label, o.count])} />
      </Panel>

      <Panel>
        <PanelTitle icon={<Database />} action={health.migrations.length > 0 && <Pill>{applied} of {health.migrations.length} applied</Pill>}>
          Migrations
        </PanelTitle>
        {health.migrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No migration history is available.</p>
        ) : (
          <ol className="max-h-96 divide-y divide-border/60 overflow-y-auto text-sm">
            {health.migrations.map((m) => (
              <li key={m.name} className="flex justify-between gap-4 py-1.5">
                <span className="min-w-0 break-all text-muted-foreground">{m.name}</span>
                <span className={cn('shrink-0 font-medium', (m.rolledBack || !m.appliedAt) && 'text-destructive')}>
                  {m.rolledBack ? 'Rolled back' : m.appliedAt ? 'Applied' : 'Pending'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function dateTime(value: Date | string) {
  return `${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
}

function bytes(value: number) {
  return value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;
}
