'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { focusDuration } from '@/lib/focus-record';
import type { AdminConsole, SystemHealth } from '@/lib/admin-actions';
import styles from './Admin.module.css';

type Tab = 'overview' | 'users' | 'health';
export function AdminDashboard({
  overview,
  users,
  health,
  source,
}: AdminConsole) {
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = overview.totals;
  const matches = users.filter(
    (u) =>
      `${u.username} ${u.name ?? ''} ${u.school ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter !== 'admin' || u.isAdmin) &&
      (filter !== 'recent' ||
        (u.lastActiveDate &&
          Date.now() - new Date(u.lastActiveDate).getTime() < 7 * 86400000)),
  );
  const local = source.mode === 'device';
  const suffix = local ? '?source=device' : '';
  const metrics = [
    ['Accounts', t.users, `${overview.activeLast7} active in 7 days`],
    ['Practice attempts', t.attempts, `${t.practiceSets} saved sets`],
    [
      'Recorded focus',
      focusDuration(t.focusSeconds),
      `${t.measuredSessions} measured sessions`,
    ],
    ['Completed blocks', t.completedBlocks, `${t.tasks} study blocks total`],
  ];
  return (
    <Page>
      <PageHeader
        title="Admin console"
        description="Accounts, study activity and service health."
        actions={
          <Button
            variant="outline"
            className="min-h-11 rounded-lg"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} />
            {pending ? 'Refreshing…' : 'Refresh report'}
          </Button>
        }
      />
      <PageBody>
        <div className={styles.source} role="status">
          <span className={styles.sourceName}>
            <Database />
            {source.mode === 'server'
              ? 'Connected server'
              : local
                ? 'This device only'
                : 'Live server reports'}
          </span>
          <span>
            {source.serverUrl
              ? new URL(source.serverUrl).host
              : local
                ? 'Local records · connect Sync for server-wide reports'
                : 'All accounts on this deployment'}
          </span>
          <span className={styles.checked}>
            Updated {dateTime(source.checkedAt)}
          </span>
          {local ? (
            <Link href="/settings?tab=sync">
              Sync settings
              <ArrowUpRight />
            </Link>
          ) : source.mode === 'server' ? (
            <Link href="/admin?source=device">
              View device records
              <ChevronRight />
            </Link>
          ) : null}
        </div>
        <nav className={styles.tabs} aria-label="Admin views">
          {(
            [
              ['overview', 'Overview', Activity],
              ['users', 'Accounts', Users],
              ['health', 'System health', ShieldCheck],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div aria-busy={pending}>
          {tab === 'overview' && (
            <>
              <dl className={styles.metrics}>
                {metrics.map(([label, value, hint]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                    <p>{hint}</p>
                  </div>
                ))}
              </dl>
              <div className={styles.grid}>
                <section className={styles.panel}>
                  <h2>
                    <BookOpen />
                    Study workspace
                  </h2>
                  <div className={styles.featureGrid}>
                    {[
                      ['Practice sets', t.practiceSets],
                      ['Attempts awaiting marks', t.pendingMarks],
                      ['Runs in progress', t.drafts],
                      ['Saved resources', t.resources],
                      ['AI conversations', t.aiSessions],
                      ['School lessons', t.lessons],
                      ['Exams', t.exams],
                      ['Homework', t.homework],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>
                    <Activity />
                    Account activity
                  </h2>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Active in 7 days</dt>
                      <dd>{overview.activeLast7}</dd>
                    </div>
                    <div>
                      <dt>Active in 30 days</dt>
                      <dd>{overview.activeLast30}</dd>
                    </div>
                    <div>
                      <dt>No activity recorded</dt>
                      <dd>{overview.neverActive}</dd>
                    </div>
                    <div>
                      <dt>AI connection configured</dt>
                      <dd>{overview.aiConfigured}</dd>
                    </div>
                    <div>
                      <dt>Device status reports</dt>
                      <dd>{overview.syncDevices}</dd>
                    </div>
                  </dl>
                  <p className={styles.hint}>
                    Activity follows recorded app use. Focus totals here include
                    measured sessions; older account totals remain on each
                    account’s detail page.
                  </p>
                </section>
                <section className={styles.panel}>
                  <h2>
                    <Users />
                    Account registrations
                  </h2>
                  {overview.signups.length ? (
                    <ol className={styles.signups}>
                      {overview.signups.slice(-12).map((s) => (
                        <li key={s.month}>
                          <span>{s.month}</span>
                          <meter
                            min={0}
                            max={Math.max(
                              1,
                              ...overview.signups.map((v) => v.count),
                            )}
                            value={s.count}
                            aria-label={`${s.month}: ${s.count} registrations`}
                          />
                          <strong>{s.count}</strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.hint}>No registrations recorded.</p>
                  )}
                </section>
                <section className={styles.panel}>
                  <h2>
                    <HardDrive />
                    Service status
                  </h2>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Database</dt>
                      <dd>
                        {health.database.reachable
                          ? 'Connected'
                          : 'Unavailable'}{' '}
                        · {health.database.provider}
                      </dd>
                    </div>
                    <div>
                      <dt>Upload storage</dt>
                      <dd>
                        {overview.storageBackend === 'object'
                          ? 'Managed object storage'
                          : 'Local disk'}
                      </dd>
                    </div>
                    {overview.storage && (
                      <>
                        <div>
                          <dt>Uploaded files</dt>
                          <dd>{overview.storage.fileCount}</dd>
                        </div>
                        <div>
                          <dt>Disk usage</dt>
                          <dd>{bytes(overview.storage.uploadsBytes)}</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Recorded sync errors</dt>
                      <dd>{health.syncErrors.length}</dd>
                    </div>
                  </dl>
                  <button
                    className={styles.textButton}
                    onClick={() => setTab('health')}
                  >
                    Open system health
                    <ChevronRight />
                  </button>
                </section>
              </div>
            </>
          )}
          {tab === 'users' && (
            <section className={styles.accounts}>
              <div className={styles.toolbar}>
                <div className={styles.search}>
                  <Search />
                  <label className="sr-only" htmlFor="admin-search">
                    Search accounts
                  </label>
                  <input
                    id="admin-search"
                    placeholder="Search name, username or school"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <label className="sr-only" htmlFor="admin-filter">
                  Filter accounts
                </label>
                <select
                  id="admin-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All accounts</option>
                  <option value="admin">Administrators</option>
                  <option value="recent">Active in 7 days</option>
                </select>
                <span aria-live="polite">{matches.length} accounts</span>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Last activity</th>
                      <th>Study records</th>
                      <th>Workspace</th>
                      <th>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.accountName}>
                            <span className={styles.avatar}>
                              {(u.name || u.username).slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <strong>{u.name || u.username}</strong>
                              <p>
                                @{u.username}
                                {u.isAdmin ? ' · Admin' : ''}
                              </p>
                              {u.school && <p>{u.school}</p>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.lastActiveDate
                            ? dateTime(u.lastActiveDate)
                            : 'Not recorded'}
                          <p className={styles.hint}>
                            Joined {date(u.createdAt)}
                          </p>
                        </td>
                        <td>
                          {u.counts.tasks} blocks
                          <p className={styles.hint}>
                            {u.counts.subjects} subjects · {u.counts.exams}{' '}
                            exams
                          </p>
                        </td>
                        <td>
                          <span className={styles.tag}>
                            {u.hasAi ? 'AI configured' : 'AI not configured'}
                          </span>
                          <p className={styles.hint}>{u.timezone}</p>
                        </td>
                        <td>
                          <Link
                            className={styles.openAccount}
                            href={`/admin/users/${u.id}${suffix}`}
                            aria-label={`Open ${u.username}`}
                          >
                            Open
                            <ChevronRight />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!matches.length && (
                  <p className="p-8 text-sm text-muted-foreground">
                    No accounts match this search.
                  </p>
                )}
              </div>
            </section>
          )}
          {tab === 'health' && <Health health={health} />}
        </div>
      </PageBody>
    </Page>
  );
}
function Health({ health }: { health: SystemHealth }) {
  return (
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h2>
          <Database />
          Database & migrations
        </h2>
        <p className={styles.hint}>
          {health.database.reachable
            ? `Connected to ${health.database.provider}`
            : health.database.error}
        </p>
        <ol className={styles.migrations}>
          {health.migrations.map((m) => (
            <li key={m.name}>
              <span>{m.name}</span>
              <strong>
                {m.rolledBack
                  ? 'Rolled back'
                  : m.appliedAt
                    ? 'Applied'
                    : 'Pending'}
              </strong>
            </li>
          ))}
        </ol>
        {!health.migrations.length && (
          <p className={styles.hint}>No migration history is available.</p>
        )}
      </section>
      <section className={styles.panel}>
        <h2>
          <ShieldCheck />
          Data coverage
        </h2>
        <p className={styles.hint}>
          Legacy records without an academic year or term are listed separately
          from connectivity problems.
        </p>
        <dl className={styles.facts}>
          {health.orphans.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.count}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mb-3 mt-8 text-sm font-medium">
          Deleted records retained for sync
        </h3>
        <dl className={styles.facts}>
          {health.tombstones.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.count}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={`${styles.panel} ${styles.wide}`}>
        <h2>
          <Activity />
          Device sync reports
        </h2>
        {!health.syncErrors.length ? (
          <p className={styles.hint}>
            No sync errors have been reported to this server. Device status
            updates arrive when a device connects.
          </p>
        ) : (
          <ul className={styles.errors}>
            {health.syncErrors.map((item) => (
              <li key={`${item.userId}:${item.deviceId}`}>
                <Link href={`/admin/users/${item.userId}`}>
                  Open account
                  <ChevronRight />
                </Link>
                <p>{item.lastError}</p>
                <span>
                  {item.deviceId} ·{' '}
                  {item.lastSyncAt
                    ? dateTime(item.lastSyncAt)
                    : 'No sync recorded'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
function date(value: Date | string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}
function dateTime(value: Date | string) {
  return (
    new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(value)) + ' UTC'
  );
}
function bytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1048576
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1048576).toFixed(1)} MB`;
}
