'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileBarChart, Folder, FolderOpen, HardDrive, Library } from 'lucide-react';

import type { RailFolder } from '@/lib/library-actions';
import { cn } from '@/lib/utils';

/** The folder the app files reports into (lib/report-filing.ts REPORTS_SUBJECT). */
const REPORTS = 'Reports';

/**
 * The folder list beside every Resources page, like a drive's sidebar: all
 * files, each subject, then the folders the app fills itself (Reports). On a
 * phone it becomes a row of chips above the page.
 */
export function DriveRail({ folders, folderPath }: { folders: RailFolder[]; folderPath?: string | null }) {
  const pathname = usePathname() ?? '';
  const current = pathname.startsWith('/resources/') ? decodeURIComponent(pathname.slice('/resources/'.length).split('/')[0]) : null;
  const subjects = folders.filter((f) => f.name !== REPORTS);
  const reports = folders.find((f) => f.name === REPORTS);
  const total = folders.reduce((s, f) => s + f.count, 0);

  const item = (href: string, label: string, icon: React.ReactNode, count: number | null, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-full',
        'border lg:border-0',
        active
          ? 'border-primary/30 bg-primary/10 font-semibold text-primary'
          : 'border-border bg-card text-foreground/85 hover:bg-muted hover:text-foreground lg:bg-transparent'
      )}
    >
      <span className={cn('shrink-0 [&_svg]:size-4', active ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== null && <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:inline">{count}</span>}
    </Link>
  );

  return (
    <nav aria-label="Folders" className="min-w-0 lg:sticky lg:top-6">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {item('/resources', 'All files', <Library />, total, current === null)}
        <p className="hidden px-3 pb-1 pt-4 text-xs font-semibold text-muted-foreground lg:block">Subjects</p>
        {subjects.map((f) =>
          item(
            `/resources/${encodeURIComponent(f.name)}`,
            f.name,
            current?.toLowerCase() === f.name.toLowerCase() ? <FolderOpen /> : <Folder />,
            f.count,
            current?.toLowerCase() === f.name.toLowerCase()
          )
        )}
        <p className="hidden px-3 pb-1 pt-4 text-xs font-semibold text-muted-foreground lg:block">Saved by the app</p>
        {item(`/resources/${REPORTS}`, 'Reports', <FileBarChart />, reports?.count ?? 0, current?.toLowerCase() === 'reports')}
      </div>
      {folderPath && (
        <p className="mt-4 hidden items-start gap-1.5 px-3 text-xs text-muted-foreground lg:flex" title={folderPath}>
          <HardDrive className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">On this computer in {folderPath}</span>
        </p>
      )}
    </nav>
  );
}
