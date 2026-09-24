'use client';

/**
 * One account, in full.
 *
 * This page can read another person's private work - their notes, their
 * homework, their conversations with the AI. That is the deployment owner's
 * deliberate choice, so the least this page can do is be honest about it: the
 * banner names whose account is open, and content is fetched only when a tab is
 * actually opened rather than loaded silently on arrival.
 *
 * The actions are ordered by how much damage they do, with the irreversible one
 * last, behind a typed confirmation, in its own red box.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel as Surface, PanelTitle } from '@/components/ui/panel';
import { Pill } from '@/components/ui/list-row';
import { Stat } from '@/components/ui/stat';
import type { AdminUserDetail } from '@/lib/admin-actions';
import {
  deleteUserAccount,
  getAdminUserContent,
  resetUserOnboarding,
  resetUserPassword,
  setUserAdmin,
} from '@/lib/admin-actions';

type ContentKind = 'notes' | 'sticky' | 'ai' | 'homework';
type ContentRow = { id: string; title: string; body: string; when: Date };

export function AdminUserView({ user }: { user: AdminUserDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Page>
      <div className="px-4 pt-6 md:px-8">
        <Button variant="ghost" asChild className="gap-1.5">
          <Link href="/admin">
            <ArrowLeft className="size-4" />
            All users
          </Link>
        </Button>
      </div>

      <PageHeader
        className="pt-4"
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {user.username}
            {user.isAdmin && <Pill tone="primary">Admin</Pill>}
          </span>
        }
        description={
          <>
            Joined {formatDate(user.createdAt)}
            {user.progress ? ` · ${user.progress.timezone}` : ''}
            {user.progress?.lastActiveDate
              ? ` · last active ${formatDate(user.progress.lastActiveDate)}`
              : ' · never active'}
          </>
        }
      />

      <PageBody>
      {/* Say plainly whose data this is. An admin reading someone's notes
          should never be able to forget they are doing it. */}
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Eye className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          You are looking at <span className="font-bold">{user.username}</span>&apos;s account,
          including everything they have written.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SetupState user={user} />
          <Counts user={user} />
          <Years user={user} />
          <Devices user={user} />
          <RecentTasks user={user} />
          <ContentBrowser userId={user.id} username={user.username} />
        </div>

        <aside className="space-y-6">
          <Actions user={user} isPending={isPending} startTransition={startTransition} router={router} />
        </aside>
      </div>
      </PageBody>
    </Page>
  );
}

/* -------------------------------------------------------------------- panels */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Surface>
      <PanelTitle>{title}</PanelTitle>
      {children}
    </Surface>
  );
}

/**
 * Why this person might be stuck, answered before anyone has to ask.
 *
 * This is the panel the whole support case usually turns on: nine times out of
 * ten somebody "can't get the AI to work" because there is no key, or has an
 * empty dashboard because they never set a weekly timetable.
 */
function SetupState({ user }: { user: AdminUserDetail }) {
  const rows: { label: string; ok: boolean; detail: string }[] = [
    {
      label: 'Subjects',
      ok: user.subjects.length > 0,
      detail: user.subjects.length ? user.subjects.join(', ') : 'None — most pages will be empty',
    },
    {
      label: 'Weekly study blocks',
      ok: (user.counts.templates ?? 0) > 0,
      detail: user.counts.templates
        ? `${user.counts.templates} recurring blocks`
        : 'None — nothing will ever be generated onto their days',
    },
    {
      label: 'AI',
      ok: Boolean(user.aiKeys.gemini || user.aiKeys.openai || user.aiKeys.ollama),
      detail:
        [
          user.aiKeys.gemini && `Gemini ${user.aiKeys.gemini}`,
          user.aiKeys.openai && `OpenAI ${user.aiKeys.openai}`,
          user.aiKeys.ollama && 'local model enabled',
        ]
          .filter(Boolean)
          .join(' · ') || 'No key — every AI feature is inert for them',
    },
    {
      label: 'Guided tour',
      ok: Boolean(user.progress?.onboardedAt),
      detail: user.progress?.onboardedAt
        ? `Seen ${formatDate(user.progress.onboardedAt)}`
        : 'Never seen it',
    },
    {
      label: 'Setup checklist',
      ok: Boolean(user.progress?.setupCompletedAt),
      detail: user.progress?.setupCompletedAt
        ? `Dismissed ${formatDate(user.progress.setupCompletedAt)}`
        : 'Still showing on their dashboard',
    },
  ];

  return (
    <Panel title="Is this person set up?">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-1 h-2 w-2 shrink-0 rounded-full',
                r.ok ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Counts({ user }: { user: AdminUserDetail }) {
  const p = user.progress;
  return (
    <Panel title="Activity">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Streak', p ? `${p.currentStreak}` : '0', p ? `best ${p.longestStreak}` : ''],
          ['Level', p ? `${p.level}` : '1', p ? `${p.xp} xp` : ''],
          [
            'Deep focus',
            p ? `${Math.round(p.totalFocusMinutes / 60)}h` : '0h',
            p ? `${p.focusSessions} sessions` : '',
          ],
          ['AI sessions', `${user.counts.aiSessions ?? 0}`, ''],
        ].map(([label, value, sub]) => (
          <Stat key={label} label={label} value={value} hint={sub || undefined} />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {Object.entries(user.counts).map(([key, value]) => (
          <span key={key}>
            <span className="font-bold tabular-nums text-foreground">{value}</span> {key}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function Years({ user }: { user: AdminUserDetail }) {
  if (user.classes.length === 0) {
    return (
      <Panel title="Years and terms">
        <p className="text-sm text-muted-foreground">
          No academic year at all — their schedule cannot run.
        </p>
      </Panel>
    );
  }
  return (
    <Panel title="Years and terms">
      <ul className="space-y-4">
        {user.classes.map((c) => (
          <li key={c.id}>
            <p className="text-sm font-bold">
              {c.label}
              <Pill tone={c.status === 'ACTIVE' ? 'success' : 'default'} className="ml-2">
                {c.status === 'ACTIVE' ? 'Active' : 'Finished'}
              </Pill>
            </p>
            <ul className="mt-1.5 space-y-1 pl-4 text-xs text-muted-foreground">
              {c.terms.map((t) => (
                <li key={t.id}>
                  {t.name} · {t.status}
                  {t.startDate || t.endDate
                    ? ` · ${t.startDate ? formatDate(t.startDate) : '?'} → ${
                        t.endDate ? formatDate(t.endDate) : '?'
                      }`
                    : ' · no dates set'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Devices({ user }: { user: AdminUserDetail }) {
  return (
    <Panel title="Paired devices">
      {user.devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No desktop device has ever paired.</p>
      ) : (
        <ul className="space-y-3">
          {user.devices.map((d) => (
            <li key={d.deviceId} className="text-sm">
              <p className="font-mono text-xs text-muted-foreground">{d.deviceId}</p>
              <p className="mt-0.5">
                {d.lastSyncAt ? `Last sync ${formatDate(d.lastSyncAt)}` : 'Never completed a sync'} ·{' '}
                {d.lastPushed} pushed / {d.lastPulled} pulled
              </p>
              {d.lastError && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {d.lastError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentTasks({ user }: { user: AdminUserDetail }) {
  return (
    <Panel title="Recent study blocks">
      {user.recentTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has ever been generated for them.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {user.recentTasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span className={cn(t.isDone && 'text-muted-foreground line-through')}>
                {t.subject}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t.type.toLowerCase()} · {formatDate(t.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Their written content, loaded only when a tab is actually opened. */
function ContentBrowser({ userId, username }: { userId: string; username: string }) {
  const [kind, setKind] = useState<ContentKind | null>(null);
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const open = async (next: ContentKind) => {
    setKind(next);
    setLoading(true);
    try {
      setRows(await getAdminUserContent(userId, next));
    } catch {
      toast.error('Could not load that.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title={`${username}'s content`}>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['notes', 'Subject notes'],
            ['sticky', 'Sticky notes'],
            ['homework', 'Homework'],
            ['ai', 'AI conversations'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => void open(id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              kind === id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === null && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing is loaded until you pick one.
        </p>
      )}

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      )}

      {kind !== null && !loading && (
        <div className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            rows.map((r) => (
              <details key={r.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-bold">
                  {r.title}
                  <span className="ml-2 font-normal text-xs text-muted-foreground">
                    {formatDate(r.when)}
                  </span>
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {r.body || '(empty)'}
                </pre>
              </details>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- actions */

function Actions({
  user,
  isPending,
  startTransition,
  router,
}: {
  user: AdminUserDetail;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(ok);
        router.refresh();
      }
    });

  return (
    <>
      <Panel title="Rights">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {user.isAdmin ? 'This account is an admin' : 'Ordinary account'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Admins can see and change every account on this deployment.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={isPending}
              onClick={() => run(() => setUserAdmin(user.id, !user.isAdmin), 'Rights updated.')}
            >
              {user.isAdmin ? 'Revoke admin' : 'Make admin'}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Support">
        <div className="space-y-5">
          <div>
            <Label htmlFor="admin-pw" className="text-xs font-bold">
              Set a new password
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="admin-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-9"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                disabled={isPending || password.length < 6}
                onClick={() => run(() => resetUserPassword(user.id, password), 'Password changed.')}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Set
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Shown in plain text so you can read it out. Tell them to change it.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold">Show onboarding again</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Clears the tour and setup flags, so the wizard and the guided tour both come back
              for them.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isPending}
              onClick={() => run(() => resetUserOnboarding(user.id), 'They will see setup again.')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset onboarding
            </Button>
          </div>
        </div>
      </Panel>

      <Surface className="border-destructive/30">
        <PanelTitle icon={<Trash2 />}>Delete this account</PanelTitle>
        <div>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything goes: their tasks, notes, marks, timetable, uploads and paired devices.
            There is no undo and no backup taken here.
          </p>
          <Label htmlFor="admin-confirm" className="mt-4 block text-xs font-bold">
            Type <span className="font-mono">{user.username}</span> to confirm
          </Label>
          <Input
            id="admin-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-2 h-9"
            placeholder={user.username}
          />
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            disabled={isPending || typed.trim() !== user.username}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteUserAccount(user.id, typed);
                if (res?.error) toast.error(res.error);
                else {
                  toast.success(`${user.username} deleted.`);
                  router.push('/admin');
                  router.refresh();
                }
              })
            }
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete permanently
          </Button>
        </div>
      </Surface>
    </>
  );
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
