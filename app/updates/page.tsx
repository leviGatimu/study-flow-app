import { format, parseISO } from 'date-fns';

import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Pill } from '@/components/ui/list-row';
import { DesktopUpdatePanel, InstalledPill } from '@/components/updates/DesktopUpdatePanel';
import { CHANGE_LABELS, CHANGELOG, type ChangeKind } from '@/lib/changelog';

export const metadata = { title: 'Updates' };

const ORDER: ChangeKind[] = ['new', 'better', 'fixed', 'removed', 'security', 'dev'];
const OPEN_BY_DEFAULT = 3;

const TONE: Record<ChangeKind, string> = {
  new: 'text-primary',
  better: 'text-foreground',
  fixed: 'text-success',
  removed: 'text-muted-foreground',
  security: 'text-orange-600 dark:text-orange-400',
  dev: 'text-muted-foreground',
};

/** Every version, newest first, and what changed in it. */
export default function UpdatesPage() {
  return (
    <Page>
      <PageHeader title="Updates" description="Every version of Study Flow and what changed in it." />
      <PageBody className="space-y-6 pt-6">
        <DesktopUpdatePanel />

        <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Versions" className="scrollbar-none sticky top-4 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto lg:block">
            <ol className="space-y-0.5 text-sm">
              {CHANGELOG.map((release) => (
                <li key={release.version}>
                  <a
                    href={`#v${release.version}`}
                    className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium tabular-nums">{release.version}</span>
                    <span className="text-xs tabular-nums">{format(parseISO(release.date), 'd MMM')}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <ol className="min-w-0 space-y-3">
            {CHANGELOG.map((release, index) => (
              <li key={release.version} id={`v${release.version}`} className="scroll-mt-4">
                <details open={index < OPEN_BY_DEFAULT} className="group overflow-hidden rounded-xl border border-border/60 bg-card">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    <span className="font-heading text-base font-bold tabular-nums text-foreground">{release.version}</span>
                    <span className="min-w-0 flex-1 basis-48 break-words font-medium text-foreground">{release.title}</span>
                    {index === 0 && <Pill tone="success">Latest</Pill>}
                    <InstalledPill version={release.version} />
                    <time dateTime={release.date} className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {format(parseISO(release.date), 'd MMM yyyy')}
                    </time>
                  </summary>
                  <div className="space-y-4 border-t border-border/60 px-5 py-4">
                    {ORDER.filter((kind) => release.changes[kind]?.length).map((kind) => (
                      <section key={kind} aria-label={CHANGE_LABELS[kind]}>
                        <h3 className={`mb-1.5 text-xs font-semibold ${TONE[kind]}`}>{CHANGE_LABELS[kind]}</h3>
                        <ul className="space-y-1 text-sm text-foreground">
                          {release.changes[kind]?.map((change) => (
                            <li key={change} className="flex gap-2">
                              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                              <span className="min-w-0 break-words">{change}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </div>
      </PageBody>
    </Page>
  );
}
