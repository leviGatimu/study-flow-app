"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Clock,
  Folder,
  FolderSymlink,
  HardDrive,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useIsDesktopApp } from "@/components/DesktopUpdater";
import { deleteSubject } from "@/lib/actions";
import type { LibraryOverview as Overview, LibrarySubject, ResourceItem } from "@/lib/library-actions";
import { cn } from "@/lib/utils";
import { safeSegment } from "@/lib/library-names";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { folderAbsolutePath, openInExplorer } from "./desktop-bridge";
import { displayName, formatWhen, hostOf, KindIcon } from "./file-kind";
import { useStoredView } from "./use-stored-view";

/**
 * The top of the explorer: one folder per subject.
 *
 * Deliberately the same idiom as the subject page - tiles or rows, a search
 * box, a context menu, a footer with the path on disk - so that going into a
 * subject feels like opening a folder rather than changing screens.
 */

export function LibraryOverview({ overview }: { overview: Overview }) {
  const router = useRouter();
  const onDesktop = useIsDesktopApp();
  const [pending, startTransition] = useTransition();
  const canWrite = !overview.archived;

  const [query, setQuery] = useState("");
  const [view, changeView] = useStoredView();
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; entries: MenuEntry[] } | null>(null);
  const [clearing, setClearing] = useState<LibrarySubject | null>(null);

  const subjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? overview.subjects.filter((s) => s.name.toLowerCase().includes(q)) : overview.subjects;
  }, [overview.subjects, query]);

  const totals = useMemo(
    () =>
      overview.subjects.reduce(
        (t, s) => ({ files: t.files + s.files, links: t.links + s.links, folders: t.folders + s.folders }),
        { files: 0, links: 0, folders: 0 }
      ),
    [overview.subjects]
  );

  const open = (s: LibrarySubject) => router.push(`/resources/${encodeURIComponent(s.name)}`);

  const show = async (s: LibrarySubject | null) => {
    if (!overview.folderPath) return;
    // The subject directory is named by the same rule the server uses; the
    // server creates it if it is not there yet.
    const path = s ? folderAbsolutePath(overview.folderPath, safeSegment(s.name)) : overview.folderPath;
    const result = await openInExplorer(path);
    if (!result.ok) toast.error(result.error ?? "Could not open Explorer.");
  };

  const entriesFor = (s: LibrarySubject | null): MenuEntry[] => {
    const e: MenuEntry[] = [];
    if (s) e.push({ kind: "item", label: "Open", icon: <Folder />, onSelect: () => open(s) });
    if (onDesktop && overview.folderPath) {
      e.push({ kind: "item", label: "Show in Explorer", icon: <FolderSymlink />, onSelect: () => show(s) });
    }
    if (s && canWrite) {
      e.push({ kind: "separator" });
      e.push({ kind: "item", label: "Clear this subject…", icon: <Trash2 />, danger: true, onSelect: () => setClearing(s) });
    }
    return e;
  };
  const openMenu = (at: { x: number; y: number }, s: LibrarySubject | null) => setMenu({ at, entries: entriesFor(s) });

  return (
    <div className="space-y-5">
      <section
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu({ x: e.clientX, y: e.clientY }, null);
        }}
        className="flex min-h-[420px] flex-col rounded-2xl border border-border bg-card"
      >
        {/* toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
          <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground">
              <Folder className="size-3.5 text-amber-500" fill="currentColor" fillOpacity={0.18} />
              Resources
            </span>
            <span className="text-xs text-muted-foreground">
              {overview.subjects.length} {overview.subjects.length === 1 ? "subject" : "subjects"}
            </span>
          </nav>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a subject"
                aria-label="Find a subject"
                className="h-8 w-44 pl-8 pr-7 text-sm md:w-56"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div role="group" aria-label="View" className="flex rounded-lg border border-border p-0.5">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => changeView("grid")}>
                <LayoutGrid />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "list"} aria-label="List view" onClick={() => changeView("list")}>
                <List />
              </Button>
            </div>
            {onDesktop && overview.folderPath && (
              <Button variant="ghost" size="sm" onClick={() => show(null)} className="text-muted-foreground">
                <FolderSymlink /> Show in Explorer
              </Button>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 p-3">
          {subjects.length === 0 ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
              <Folder className="size-7 text-muted-foreground" />
              <p className="font-heading text-sm font-medium">{query ? `No subject matches “${query}”` : "No subjects yet"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {query ? "Try another spelling." : "Subjects come from your timetable. Add a study block in Manage Schedule and its folder appears here."}
              </p>
              {!query && (
                <Button asChild size="sm" variant="outline" className="mt-1">
                  <Link href="/manage">Manage schedule</Link>
                </Button>
              )}
            </div>
          ) : view === "grid" ? (
            <ul role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {subjects.map((s) => (
                <SubjectTile key={s.name} subject={s} onMenu={(at) => openMenu(at, s)} />
              ))}
            </ul>
          ) : (
            <SubjectRows subjects={subjects} onOpen={open} onMenu={(s, at) => openMenu(at, s)} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>
            {totals.files} files · {totals.links} links · {totals.folders} folders
          </span>
          {overview.folderPath && (
            <span className="hidden items-center gap-1.5 truncate sm:flex" title={overview.folderPath}>
              <HardDrive className="size-3" />
              <span className="truncate">{overview.folderPath}</span>
            </span>
          )}
        </div>
      </section>

      {overview.recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-2">
          <h2 id="recent-heading" className="flex items-center gap-1.5 px-1 font-heading text-sm font-semibold text-foreground">
            <Clock className="size-4 text-muted-foreground" /> Recently added
          </h2>
          <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {overview.recent.map((item) => (
              <RecentCard key={item.id} item={item} onDesktop={onDesktop} />
            ))}
          </ul>
        </section>
      )}

      <ContextMenu at={menu?.at ?? null} entries={menu?.entries ?? []} onClose={() => setMenu(null)} />

      <ConfirmModal
        isOpen={clearing !== null}
        onClose={() => setClearing(null)}
        isPending={pending}
        title={clearing ? `Clear everything in ${clearing.name}?` : ""}
        description={
          clearing
            ? `All ${clearing.files + clearing.links} materials and ${clearing.masteryTotal} syllabus items for ${clearing.name} will be deleted${overview.folderPath ? ", and its folder removed from your computer" : ""}. The subject stays on your timetable. This cannot be undone.`
            : ""
        }
        onConfirm={() => {
          const s = clearing;
          setClearing(null);
          if (!s) return;
          startTransition(async () => {
            try {
              await deleteSubject(s.name);
              toast.success(`Cleared ${s.name}`);
              router.refresh();
            } catch (error) {
              toast.error((error as Error).message || "Could not clear the subject.");
            }
          });
        }}
      />
    </div>
  );
}

function SubjectTile({
  subject: s,
  onMenu,
}: {
  subject: LibrarySubject;
  onMenu: (at: { x: number; y: number }) => void;
}) {
  const pct = s.masteryTotal === 0 ? null : Math.round((s.masteryDone / s.masteryTotal) * 100);
  const count = s.files + s.links;
  return (
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
      className="group relative"
    >
      <Link
        href={`/resources/${encodeURIComponent(s.name)}`}
        className="flex h-full flex-col gap-3 rounded-xl border border-transparent p-3 transition-colors hover:bg-muted/60 focus-visible:border-primary/50 focus-visible:outline-none"
      >
        <KindIcon item={{ type: "FOLDER", ext: "" }} size="lg" />
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-foreground">{s.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}
            {s.folders > 0 ? ` · ${s.folders} ${s.folders === 1 ? "folder" : "folders"}` : ""}
          </p>
        </div>
        {pct !== null && (
          <div className="mt-auto" aria-label={`Mastery ${pct}%`}>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Mastery</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </Link>
      <button
        type="button"
        aria-label={`Actions for ${s.name}`}
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          onMenu({ x: r.right - 200, y: r.bottom + 4 });
        }}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
    </li>
  );
}

function SubjectRows({
  subjects,
  onOpen,
  onMenu,
}: {
  subjects: LibrarySubject[];
  onOpen: (s: LibrarySubject) => void;
  onMenu: (s: LibrarySubject, at: { x: number; y: number }) => void;
}) {
  const cols = "grid grid-cols-[minmax(0,1fr)_90px_90px_120px_140px] items-center gap-3";
  return (
    <div role="table" aria-label="Subjects" className="text-sm">
      <div role="row" className={cn(cols, "border-b border-border px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground")}>
        <span>Name</span>
        <span className="hidden sm:block">Files</span>
        <span className="hidden sm:block">Links</span>
        <span className="hidden md:block">Last added</span>
        <span className="hidden md:block">Mastery</span>
      </div>
      <ul role="rowgroup" className="divide-y divide-border/60">
        {subjects.map((s) => {
          const pct = s.masteryTotal === 0 ? null : Math.round((s.masteryDone / s.masteryTotal) * 100);
          return (
            <li
              key={s.name}
              role="row"
              onClick={() => onOpen(s)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenu(s, { x: e.clientX, y: e.clientY });
              }}
              className={cn(cols, "group cursor-pointer rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/60")}
            >
              <div role="cell" className="flex min-w-0 items-center gap-3">
                <KindIcon item={{ type: "FOLDER", ext: "" }} size="sm" />
                <span className="truncate font-medium text-foreground">{s.name}</span>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </div>
              <div role="cell" className="hidden text-xs tabular-nums text-muted-foreground sm:block">{s.files}</div>
              <div role="cell" className="hidden text-xs tabular-nums text-muted-foreground sm:block">{s.links}</div>
              <div role="cell" className="hidden text-xs text-muted-foreground md:block">{s.lastAdded ? formatWhen(s.lastAdded) : "—"}</div>
              <div role="cell" className="hidden items-center gap-2 md:flex">
                {pct === null ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentCard({ item, onDesktop }: { item: ResourceItem; onDesktop: boolean }) {
  const href = `/resources/${encodeURIComponent(item.subject)}${item.folder ? `?path=${encodeURIComponent(item.folder)}` : ""}`;
  const unavailable = item.type === "FILE" && item.inLibrary && !onDesktop;
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/60"
        title={unavailable ? "Stored in the library folder on your desktop" : undefined}
      >
        <KindIcon item={item} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName(item)}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.subject}
            {item.folder ? ` › ${item.folder.replace(/\//g, " › ")}` : ""}
            {item.type === "LINK" ? ` · ${hostOf(item.url)}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(item.createdAt)}</span>
      </Link>
    </li>
  );
}
