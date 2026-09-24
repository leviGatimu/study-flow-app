'use client';

/**
 * The deployment, seen from above.
 *
 * Three questions this page exists to answer, in the order they get asked:
 * is anyone using it, is anyone stuck, and is anything broken. Everything on
 * screen serves one of those - a number that answers none of them is decoration
 * on a page nobody visits twice.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Database,
  HardDrive,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { Stat as StatValue } from '@/components/ui/stat';
import type { AdminOverview, AdminUserRow, SystemHealth } from '@/lib/admin-actions';

type Tab = 'overview' | 'users' | 'health';

export function AdminDashboard({
  overview,
  users,
  health,
}: {
  overview: AdminOverview;
  users: AdminUserRow[];
  health: SystemHealth;
}) {
  const [tab, setTab] = useState<Tab>('overview');

  const problems =
    health.orphans.reduce((n, o) => n + o.count, 0) +
    health.syncErrors.length +
    (health.database.reachable ? 0 : 1);

  return (
    <Page>
      <PageHeader
        title="Admin"
        description="Everyone on this deployment, what they are doing, and whether anything is broken."
        actions={
        <div role="tablist" aria-label="Admin views" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1">
          {(
            [
              ['overview', 'Overview', Activity],
              ['users', `Users (${users.length})`, Users],
              ['health', problems > 0 ? `Health (${problems})` : 'Health', Database],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        }
      />

      <PageBody>
        {tab === 'overview' && <Overview overview={overview} />}
        {tab === 'users' && <UserTable users={users} />}
        {tab === 'health' && <Health health={health} />}
      </PageBody>
    </Page>
  );
}

/* ----------------------------------------------------------------- overview */

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Panel className="p-5">
      <StatValue label={label} value={value} hint={sub} />
    </Panel>
  );
}

function Overview({ overview }: { overview: AdminOverview }) {
  const { totals } = overview;
  const peak = Math.max(1, ...overview.signups.map((s) => s.count));

  return (
    <div className="space-y-8">
      <Section title="People">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Accounts" value={totals.users} />
          <Stat
            label="Active this week"
            value={overview.activeLast7}
            sub={`${overview.activeLast30} in 30 days`}
          />
          <Stat
            label="Never active"
            value={overview.neverActive}
            sub={overview.neverActive > 0 ? 'signed up, never studied' : undefined}
          />
          <Stat
            label="AI configured"
            value={`${overview.aiConfigured}/${totals.users}`}
            sub="have a key or a local model"
          />
          <Stat
            label="Setup unfinished"
            value={overview.onboardingIncomplete}
            sub="skipped the wizard or the tour"
          />
        </div>
      </Section>

      <Section title="Content">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Study blocks" value={totals.tasks.toLocaleString()} />
          <Stat label="Subjects" value={totals.subjects} sub={`${totals.exams} exams tracked`} />
          <Stat label="Notes" value={totals.notes} sub={`${totals.homework} homework items`} />
          <Stat
            label="Deep focus"
            value={`${Math.round(totals.focusMinutes / 60)}h`}
            sub={`${totals.aiSessions} AI sessions`}
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle icon={<Users />}>Signups</PanelTitle>
          <div>
            {overview.signups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              <ul className="space-y-2">
                {overview.signups.map((s) => (
                  <li key={s.month} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
                      {s.month}
                    </span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(s.count / peak) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs font-bold tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={<HardDrive />}>Storage and devices</PanelTitle>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
              {overview.storage ? (
                <p className="text-sm">
                  <span className="font-bold">{formatBytes(overview.storage.uploadsBytes)}</span>{' '}
                  <span className="text-muted-foreground">
                    in {overview.storage.fileCount} uploaded files
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No uploads directory on this host.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm">
                <span className="font-bold">{overview.syncDevices}</span>{' '}
                <span className="text-muted-foreground">paired desktop devices</span>
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- users */

function UserTable({ users }: { users: AdminUserRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr className="text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Last active</th>
            <th className="px-4 py-3">Streak</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Content</th>
            <th className="px-4 py-3">Set up</th>
            <th className="px-4 py-3">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{u.username}</span>
                  {u.isAdmin && <Pill tone="primary">Admin</Pill>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {u.name && u.name !== u.username ? `${u.name} · ` : ''}
                  {u.timezone}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
              <td className="px-4 py-3">
                {u.lastActiveDate ? (
                  <span className="text-muted-foreground">{formatDate(u.lastActiveDate)}</span>
                ) : (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">never</span>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums">{u.currentStreak}</td>
              <td className="px-4 py-3 tabular-nums">
                {u.level}
                <span className="ml-1 text-xs text-muted-foreground">{u.xp} xp</span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {u.counts.subjects} subj · {u.counts.templates} blocks · {u.counts.tasks} tasks ·{' '}
                {u.counts.notes} notes
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Flag ok={u.counts.subjects > 0} label="subjects" />
                  <Flag ok={u.counts.templates > 0} label="week" />
                  <Flag ok={u.hasAi} label="AI" />
                  <Flag ok={u.sawTour} label="tour" />
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  aria-label={`Open ${u.username}`}
                >
                  Open
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A single yes/no fact about an account, coloured so a row scans in one look. */
function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-xs font-medium',
        ok
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground line-through'
      )}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------- health */

function Health({ health }: { health: SystemHealth }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Panel>
          <PanelTitle icon={<Database />}>Database</PanelTitle>
          {health.database.reachable ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Reachable · {health.database.provider}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {health.database.error}
            </p>
          )}
        </Panel>

        <Panel>
          <PanelTitle icon={<Activity />}>Recent migrations</PanelTitle>
          <ul className="space-y-1.5 text-sm">
            {health.migrations.length === 0 && (
              <li className="text-muted-foreground">Could not read the migration table.</li>
            )}
            {health.migrations.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs">{m.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-bold',
                    m.rolledBack
                      ? 'text-destructive'
                      : m.appliedAt
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {m.rolledBack ? 'rolled back' : m.appliedAt ? 'applied' : 'pending'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel>
          <PanelTitle icon={<ShieldCheck />}>Data integrity</PanelTitle>
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">
            Rows with nothing above them. Unscoped rows are expected on old data — they predate
            academic years.
          </p>
          <ul className="space-y-1.5 text-sm">
            {health.orphans.map((o) => (
              <li key={o.label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{o.label}</span>
                <span className={cn('font-bold tabular-nums', o.count > 0 && 'text-amber-500')}>
                  {o.count}
                </span>
              </li>
            ))}
          </ul>
          <h4 className="mt-5 text-sm font-semibold text-foreground">Tombstones</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {health.tombstones.map((t) => (
              <li key={t.label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="font-bold tabular-nums">{t.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle icon={<AlertTriangle />}>Sync errors</PanelTitle>
          {health.syncErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No device is reporting an error.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {health.syncErrors.map((s) => (
                <li key={`${s.userId}-${s.deviceId}`} className="rounded-lg bg-destructive/5 p-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    {s.deviceId.slice(0, 12)}… · {s.lastSyncAt ? formatDate(s.lastSyncAt) : 'never synced'}
                  </p>
                  <p className="mt-1 text-destructive">{s.lastError}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- utils */

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
