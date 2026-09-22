"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  ArrowUpDown,
  ChevronRight,
  Clock,
  FolderPlus,
  FolderSymlink,
  Home,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
  ExternalLink,
  FolderOpen,
  HardDrive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";
import { folderAncestors, folderName, joinFolder } from "@/lib/library-paths";
import {
  addResourceLink,
  createResourceFolder,
  deleteResourceItem,
  moveResource,
  renameResource,
  uploadResourceFiles,
  type ResourceItem,
  type SubjectLibrary,
} from "@/lib/library-actions";
import { useIsDesktopApp } from "@/components/DesktopUpdater";
import {
  folderAbsolutePath,
  libraryFileAbsolutePath,
  openInExplorer,
  revealInExplorer,
} from "./desktop-bridge";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { ItemDetails } from "./ItemDetails";
import { LinkDialog, MoveDialog, NameDialog } from "./explorer-dialogs";
import { displayName, formatBytes, formatWhen, hostOf, kindLabel, KindIcon, kindOf } from "./file-kind";
import { useStoredView } from "./use-stored-view";

/**
 * A subject's resources as a file explorer.
 *
 * Everything the subject holds arrives in one payload and the explorer walks
 * it client-side, so opening a folder is instant and the URL (?path=) is
 * only bookkeeping for the back button and for links. Every write goes
 * through a server action and then router.refresh(), which brings the
 * reconciled truth back - on the desktop that includes whatever changed in
 * the folder from outside the app.
 *
 * Three ways in to every action, on purpose: the context menu, the "..." on
 * each tile, and the details rail. The desktop shell suppresses the native
 * context menu, which is exactly why the other two exist.
 */

type SortKey = "name" | "kind" | "modified" | "size";

type Props = {
  library: SubjectLibrary;
  initialPath: string;
  /** Rendered beneath the details rail: stats, mastery checklist. */
  aside?: React.ReactNode;
};

/** Folders that exist only because something is filed beneath them. */
function withImpliedFolders(items: ResourceItem[], subject: string): ResourceItem[] {
  const have = new Set(items.filter((i) => i.type === "FOLDER").map((i) => joinFolder(i.folder, i.title).toLowerCase()));
  const implied = new Map<string, ResourceItem>();
  for (const item of items) {
    for (const path of [...folderAncestors(item.folder), item.folder].filter(Boolean)) {
      const k = path.toLowerCase();
      if (have.has(k) || implied.has(k)) continue;
      implied.set(k, {
        id: `implied:${path}`,
        subject,
        title: folderName(path),
        type: "FOLDER",
        url: "",
        folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
        ext: "",
        size: null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        inLibrary: false,
      });
    }
  }
  return [...items, ...implied.values()];
}

const isImplied = (item: ResourceItem) => item.id.startsWith("implied:");
const pathOf = (item: ResourceItem) => joinFolder(item.folder, item.title);

export function SubjectExplorer({ library, initialPath, aside }: Props) {
  const router = useRouter();
  const onDesktop = useIsDesktopApp();
  const [pending, startTransition] = useTransition();
  const canWrite = !library.archived;

  const items = useMemo(() => withImpliedFolders(library.items, library.subject), [library.items, library.subject]);
  const folderPaths = useMemo(
    () => items.filter((i) => i.type === "FOLDER").map(pathOf),
    [items]
  );

  // --- navigation -------------------------------------------------------
  const [requestedPath, setPath] = useState(initialPath);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A folder deleted (here or in Explorer) while open shows the nearest
  // ancestor that still exists rather than an empty page for a ghost.
  const path = useMemo(() => {
    const exists = (p: string) => !p || folderPaths.some((f) => f.toLowerCase() === p.toLowerCase());
    if (exists(requestedPath)) return requestedPath;
    return [...folderAncestors(requestedPath)].reverse().find(exists) ?? "";
  }, [folderPaths, requestedPath]);

  const go = useCallback(
    (next: string) => {
      setPath(next);
      setSelectedId(null);
      setQuery("");
      const params = new URLSearchParams(window.location.search);
      if (next) params.set("path", next);
      else params.delete("path");
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router]
  );

  // --- view + sort ------------------------------------------------------
  const [view, changeView] = useStoredView();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => !isImplied(i) && (i.title.toLowerCase().includes(q) || (i.type === "LINK" && i.url.toLowerCase().includes(q))))
      : items.filter((i) => i.folder.toLowerCase() === path.toLowerCase());

    const rank = (i: ResourceItem) => (i.type === "FOLDER" ? 0 : 1);
    const cmp = (a: ResourceItem, b: ResourceItem) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      let r = 0;
      switch (sort.key) {
        case "kind":
          r = kindLabel(a).localeCompare(kindLabel(b));
          break;
        case "modified":
          r = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case "size":
          r = (a.size ?? -1) - (b.size ?? -1);
          break;
      }
      if (r === 0) r = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
      return r * sort.dir;
    };
    return [...pool].sort(cmp);
  }, [items, path, query, sort]);

  const selected = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;
  const childCount = (folder: ResourceItem) =>
    items.filter((i) => !isImplied(i) && i.folder.toLowerCase() === pathOf(folder).toLowerCase()).length;

  const counts = useMemo(() => {
    const real = library.items;
    return {
      files: real.filter((i) => i.type === "FILE").length,
      links: real.filter((i) => i.type === "LINK").length,
      folders: real.filter((i) => i.type === "FOLDER").length,
    };
  }, [library.items]);

  // --- actions ----------------------------------------------------------
  const refresh = () => startTransition(() => router.refresh());

  const openItem = (item: ResourceItem) => {
    if (item.type === "FOLDER") return go(pathOf(item));
    if (item.type === "FILE" && item.inLibrary && !onDesktop) {
      toast.info("That file lives in the library folder on your desktop computer.");
      return;
    }
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  const showInExplorer = async (item: ResourceItem | null) => {
    if (!library.folderPath) return;
    let result;
    if (item && item.type === "FILE" && library.libraryDir) {
      const abs = libraryFileAbsolutePath(library.libraryDir, item.url);
      result = abs ? await revealInExplorer(abs) : { ok: false, error: "That file is not in the library." };
    } else {
      const folder = item ? pathOf(item) : path;
      result = await openInExplorer(folderAbsolutePath(library.folderPath, folder));
    }
    if (!result.ok) toast.error(result.error ?? "Could not open Explorer.");
  };

  const uploadFiles = async (files: FileList | File[], into = path) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const form = new FormData();
    form.set("subject", library.subject);
    form.set("folder", into);
    for (const f of list) form.append("file", f);

    const id = toast.loading(list.length === 1 ? `Adding ${list[0].name}…` : `Adding ${list.length} files…`);
    const result = await uploadResourceFiles(form);
    toast.dismiss(id);
    if (result.added > 0) {
      toast.success(result.added === 1 ? "File added" : `${result.added} files added`, {
        description: into ? `Into ${folderName(into)}` : `Into ${library.subject}`,
      });
    }
    for (const e of result.errors) toast.error(e);
    refresh();
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const pickFiles = useCallback(() => fileInput.current?.click(), []);

  // --- dialogs ----------------------------------------------------------
  type Dialog =
    | { kind: "newFolder" }
    | { kind: "rename"; item: ResourceItem }
    | { kind: "move"; item: ResourceItem }
    | { kind: "link" }
    | { kind: "delete"; item: ResourceItem }
    | null;
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const run = async (result: Promise<{ success: boolean; error?: string }>, done?: string) => {
    const r = await result;
    if (!r.success) return r.error ?? "Something went wrong.";
    if (done) toast.success(done);
    refresh();
    return null;
  };

  // --- context menu -----------------------------------------------------
  // Entries are built when the menu OPENS (an event), not on every render.
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; entries: MenuEntry[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = (at: { x: number; y: number }, item: ResourceItem | null) =>
    setMenu({ at, entries: entriesFor(item) });

  const entriesFor = (item: ResourceItem | null): MenuEntry[] => {
    if (!item) {
      const e: MenuEntry[] = [];
      if (canWrite) {
        e.push({ kind: "item", label: "Upload files", icon: <Upload />, onSelect: pickFiles });
        e.push({ kind: "item", label: "New folder", icon: <FolderPlus />, onSelect: () => setDialog({ kind: "newFolder" }) });
        e.push({ kind: "item", label: "Add web link", icon: <Link2 />, onSelect: () => setDialog({ kind: "link" }) });
      }
      if (onDesktop && library.folderPath) {
        if (e.length) e.push({ kind: "separator" });
        e.push({ kind: "item", label: "Show in Explorer", icon: <FolderSymlink />, onSelect: () => showInExplorer(null) });
      }
      return e;
    }
    const implied = isImplied(item);
    const e: MenuEntry[] = [
      {
        kind: "item",
        label: item.type === "FOLDER" ? "Open" : item.type === "LINK" ? `Open ${hostOf(item.url)}` : "Open",
        icon: item.type === "FOLDER" ? <FolderOpen /> : <ExternalLink />,
        onSelect: () => openItem(item),
      },
    ];
    if (onDesktop && library.folderPath && (item.type === "FOLDER" || item.inLibrary)) {
      e.push({ kind: "item", label: "Show in Explorer", icon: <FolderSymlink />, onSelect: () => showInExplorer(item) });
    }
    if (canWrite && !implied) {
      e.push({ kind: "separator" });
      e.push({ kind: "item", label: "Rename", icon: <Pencil />, shortcut: "F2", onSelect: () => setDialog({ kind: "rename", item }) });
      e.push({ kind: "item", label: "Move to…", icon: <FolderSymlink />, onSelect: () => setDialog({ kind: "move", item }) });
      e.push({ kind: "separator" });
      e.push({ kind: "item", label: "Delete", icon: <Trash2 />, shortcut: "Del", danger: true, onSelect: () => setDialog({ kind: "delete", item }) });
    }
    return e;
  };

  // --- keyboard ---------------------------------------------------------
  const surface = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "Escape") return setSelectedId(null);
    if (e.key === "Backspace" && path && !query) {
      e.preventDefault();
      return go(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
    }
    if (!selected) return;
    if (e.key === "Enter") return openItem(selected);
    if (canWrite && !isImplied(selected)) {
      if (e.key === "F2") return setDialog({ kind: "rename", item: selected });
      if (e.key === "Delete") return setDialog({ kind: "delete", item: selected });
    }
  };

  // --- drag and drop ----------------------------------------------------
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folder path, "" = current
  const [osDrag, setOsDrag] = useState(false);
  const dragDepth = useRef(0);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const hasItem = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("application/x-resource-id");

  const onSurfaceDragEnter = (e: React.DragEvent) => {
    if (!canWrite || !hasFiles(e)) return;
    dragDepth.current++;
    setOsDrag(true);
  };
  const onSurfaceDragLeave = () => {
    if (!osDrag) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setOsDrag(false);
  };
  const onSurfaceDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setOsDrag(false);
    setDropTarget(null);
    if (!canWrite || !hasFiles(e)) return;
    await uploadFiles(e.dataTransfer.files, path);
  };

  const folderDropHandlers = (target: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canWrite || !(hasFiles(e) || hasItem(e))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "move";
      if (dropTarget !== target) setDropTarget(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
      if (dropTarget === target) setDropTarget(null);
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setOsDrag(false);
      setDropTarget(null);
      if (!canWrite) return;
      if (hasFiles(e)) return uploadFiles(e.dataTransfer.files, target);
      const id = e.dataTransfer.getData("application/x-resource-id");
      const item = items.find((i) => i.id === id);
      if (!item || isImplied(item)) return;
      if (item.folder.toLowerCase() === target.toLowerCase()) return;
      if (item.type === "FOLDER" && (target === pathOf(item) || target.toLowerCase().startsWith(pathOf(item).toLowerCase() + "/"))) return;
      const err = await run(moveResource(id, target), `Moved to ${target ? folderName(target) : library.subject}`);
      if (err) toast.error(err);
    },
  });

  const crumbs = path ? path.split("/") : [];
  const currentLabel = path ? folderName(path) : library.subject;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* ------------------------------------------------------ explorer */}
      <section
        ref={surface}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setSelectedId(null);
          openMenu({ x: e.clientX, y: e.clientY }, null);
        }}
        onDragEnter={onSurfaceDragEnter}
        onDragOver={(e) => {
          if (canWrite && hasFiles(e)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={onSurfaceDragLeave}
        onDrop={onSurfaceDrop}
        aria-label={`${library.subject} files`}
        className={cn(
          "relative flex min-h-[520px] flex-col rounded-2xl border border-border bg-card outline-none transition-colors xl:col-span-8 2xl:col-span-9",
          "focus-visible:ring-2 focus-visible:ring-ring/40",
          osDrag && "border-primary/60 bg-primary/[0.03]"
        )}
      >
        {/* toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
          <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm">
            <Crumb active={!path} onClick={() => go("")} {...folderDropHandlers("")} highlighted={dropTarget === "" && !!path}>
              <Home className="size-3.5" />
              <span className="font-medium">{library.subject}</span>
            </Crumb>
            {crumbs.map((c, i) => {
              const target = crumbs.slice(0, i + 1).join("/");
              const last = i === crumbs.length - 1;
              return (
                <span key={target} className="flex items-center gap-0.5">
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <Crumb active={last} onClick={() => go(target)} {...folderDropHandlers(target)} highlighted={dropTarget === target && !last}>
                    {c}
                  </Crumb>
                </span>
              );
            })}
            {pending && <Loader2 className="ml-2 size-3.5 animate-spin text-muted-foreground" />}
          </nav>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${library.subject}`}
                aria-label={`Search ${library.subject}`}
                className="h-8 w-44 pl-8 pr-7 text-sm md:w-56"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Sort">
                  <ArrowUpDown /> <span className="hidden md:inline">{SORT_LABEL[sort.key]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <DropdownMenuItem
                    key={k}
                    onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((s.dir * -1) as 1 | -1) : k === "modified" ? -1 : 1 }))}
                    className={cn(sort.key === k && "font-semibold text-primary")}
                  >
                    {SORT_LABEL[k]}
                    {sort.key === k && <span className="ml-auto text-[11px] text-muted-foreground">{sort.dir === 1 ? "A→Z" : "Z→A"}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div role="group" aria-label="View" className="flex rounded-lg border border-border p-0.5">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => changeView("grid")}>
                <LayoutGrid />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "list"} aria-label="List view" onClick={() => changeView("list")}>
                <List />
              </Button>
            </div>
          </div>
        </div>

        {/* actions row */}
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <Button size="sm" onClick={pickFiles}>
              <Upload /> Upload
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "newFolder" })}>
              <FolderPlus /> New folder
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "link" })}>
              <Link2 /> Add link
            </Button>
            {onDesktop && library.folderPath && (
              <Button size="sm" variant="ghost" onClick={() => showInExplorer(null)} className="ml-auto text-muted-foreground">
                <FolderSymlink /> Show in Explorer
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              aria-label="Upload files"
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* body */}
        <div className="flex-1 p-3">
          {query && (
            <p className="px-1 pb-2 text-xs text-muted-foreground">
              {visible.length} {visible.length === 1 ? "match" : "matches"} for “{query}” across {library.subject}
            </p>
          )}

          {visible.length === 0 ? (
            <Empty
              query={query}
              folder={currentLabel}
              canWrite={canWrite}
              onUpload={pickFiles}
              onNewFolder={() => setDialog({ kind: "newFolder" })}
            />
          ) : view === "grid" ? (
            <ul role="listbox" aria-label={`Items in ${currentLabel}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
              {visible.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  dropHighlight={item.type === "FOLDER" && dropTarget === pathOf(item)}
                  showPath={!!query}
                  draggable={canWrite && !isImplied(item)}
                  onSelect={() => setSelectedId(item.id)}
                  onOpen={() => openItem(item)}
                  onMenu={(at) => {
                    setSelectedId(item.id);
                    openMenu(at, item);
                  }}
                  {...(item.type === "FOLDER" ? folderDropHandlers(pathOf(item)) : {})}
                />
              ))}
            </ul>
          ) : (
            <ListView
              items={visible}
              selectedId={selectedId}
              dropTarget={dropTarget}
              showPath={!!query}
              canDrag={canWrite}
              sort={sort}
              onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k ? ((s.dir * -1) as 1 | -1) : 1 }))}
              onSelect={setSelectedId}
              onOpen={openItem}
              onMenu={(item, at) => {
                setSelectedId(item.id);
                openMenu(at, item);
              }}
              dropHandlers={folderDropHandlers}
            />
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>
            {visible.length} {visible.length === 1 ? "item" : "items"}
            {selected ? ` · ${displayName(selected)} selected` : ""}
          </span>
          <span className="hidden items-center gap-1.5 truncate sm:flex">
            {library.folderPath ? (
              <>
                <HardDrive className="size-3" />
                <span className="truncate" title={folderAbsolutePath(library.folderPath, path)}>
                  {folderAbsolutePath(library.folderPath, path)}
                </span>
              </>
            ) : (
              <>
                {counts.files} files · {counts.links} links · {counts.folders} folders
              </>
            )}
          </span>
        </div>

        {osDrag && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/70 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="size-8" />
              <p className="font-heading text-sm font-semibold">Drop to add to {dropTarget ? folderName(dropTarget) : currentLabel}</p>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- rail */}
      <aside className="space-y-5 xl:col-span-4 2xl:col-span-3">
        <div className="rounded-2xl border border-border bg-card">
          {selected ? (
            <ItemDetails
              item={selected}
              subject={library.subject}
              childCount={selected.type === "FOLDER" ? childCount(selected) : undefined}
              canWrite={canWrite && !isImplied(selected)}
              onDesktop={onDesktop && !!library.folderPath}
              onOpen={() => openItem(selected)}
              onOpenFolder={() => showInExplorer(selected)}
              onReveal={() => showInExplorer(selected)}
              onRename={() => setDialog({ kind: "rename", item: selected })}
              onMove={() => setDialog({ kind: "move", item: selected })}
              onDelete={() => setDialog({ kind: "delete", item: selected })}
              onNavigate={go}
            />
          ) : (
            <FolderSummary
              label={currentLabel}
              isRoot={!path}
              items={items.filter((i) => !isImplied(i) && i.folder.toLowerCase() === path.toLowerCase())}
              folderPath={library.folderPath ? folderAbsolutePath(library.folderPath, path) : null}
              onDesktop={onDesktop}
              onShow={() => showInExplorer(null)}
            />
          )}
        </div>
        {aside}
      </aside>

      {/* ------------------------------------------------------- overlays */}
      <ContextMenu at={menu?.at ?? null} entries={menu?.entries ?? []} onClose={closeMenu} />

      {dialog?.kind === "newFolder" && (
        <NameDialog
          open
          title="New folder"
          description={`Inside ${currentLabel}.`}
          label="Folder name"
          initial="New folder"
          submitLabel="Create"
          onClose={close}
          onSubmit={(name) => run(createResourceFolder(library.subject, path, name))}
        />
      )}

      {dialog?.kind === "rename" && (
        <NameDialog
          open
          title={`Rename ${dialog.item.type === "FOLDER" ? "folder" : dialog.item.type === "LINK" ? "link" : "file"}`}
          label="New name"
          initial={dialog.item.title}
          selectUpTo={dialog.item.type === "FILE" ? displayName(dialog.item).length : undefined}
          submitLabel="Rename"
          onClose={close}
          onSubmit={(name) => run(renameResource(dialog.item.id, name))}
        />
      )}

      {dialog?.kind === "move" && (
        <MoveDialog
          open
          subject={library.subject}
          folders={folderPaths}
          itemLabel={displayName(dialog.item)}
          currentFolder={dialog.item.folder}
          ownPath={dialog.item.type === "FOLDER" ? pathOf(dialog.item) : undefined}
          onClose={close}
          onSubmit={(target) => run(moveResource(dialog.item.id, target), `Moved to ${target ? folderName(target) : library.subject}`)}
        />
      )}

      {dialog?.kind === "link" && (
        <LinkDialog
          open
          folderLabel={currentLabel}
          onClose={close}
          onSubmit={({ title, url }) => run(addResourceLink(library.subject, path, title, url), "Link added")}
        />
      )}

      <ConfirmModal
        isOpen={dialog?.kind === "delete"}
        onClose={close}
        isPending={pending}
        title={dialog?.kind === "delete" ? `Delete “${displayName(dialog.item)}”?` : ""}
        description={
          dialog?.kind === "delete"
            ? dialog.item.type === "FOLDER"
              ? `The folder and the ${childCount(dialog.item)} ${childCount(dialog.item) === 1 ? "item" : "items"} inside it will be deleted${library.folderPath ? " from your computer as well" : ""}. This cannot be undone.`
              : dialog.item.type === "FILE"
                ? `The file will be deleted${library.folderPath && dialog.item.inLibrary ? " from your computer as well" : ""}. This cannot be undone.`
                : "The link will be removed from this subject."
            : ""
        }
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          const item = dialog.item;
          close();
          if (selectedId === item.id) setSelectedId(null);
          const err = await run(deleteResourceItem(item.id), `Deleted ${displayName(item)}`);
          if (err) toast.error(err);
        }}
      />
    </div>
  );
}

const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  kind: "Type",
  modified: "Modified",
  size: "Size",
};

// ------------------------------------------------------------------ pieces

function Crumb({
  active,
  highlighted,
  onClick,
  children,
  ...drop
}: {
  active: boolean;
  highlighted?: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "location" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        highlighted && "bg-primary/10 text-primary ring-1 ring-primary/40"
      )}
      {...drop}
    >
      {children}
    </button>
  );
}

function Tile({
  item,
  selected,
  dropHighlight,
  showPath,
  draggable,
  onSelect,
  onOpen,
  onMenu,
  ...drop
}: {
  item: ResourceItem;
  selected: boolean;
  dropHighlight: boolean;
  showPath: boolean;
  draggable: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMenu: (at: { x: number; y: number }) => void;
} & React.HTMLAttributes<HTMLLIElement>) {
  const kind = kindOf(item);
  const meta =
    item.type === "FOLDER"
      ? "Folder"
      : item.type === "LINK"
        ? hostOf(item.url)
        : `${item.ext ? item.ext.toUpperCase() : "File"}${item.size !== null ? ` · ${formatBytes(item.size)}` : ""}`;

  return (
    <li
      role="option"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-resource-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={-1}
      aria-selected={selected}
      className={cn(
        "group relative flex cursor-default select-none flex-col gap-2 rounded-xl border p-3 transition-colors",
        selected ? "border-primary/50 bg-primary/[0.06]" : "border-transparent hover:bg-muted/60",
        dropHighlight && "border-primary bg-primary/10 ring-2 ring-primary/30"
      )}
      {...drop}
    >
      <div className="flex items-start justify-between">
        {kind === "image" ? (
          <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-violet-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" loading="lazy" className="size-14 object-cover" />
          </div>
        ) : (
          <KindIcon item={item} size="lg" />
        )}
        <button
          type="button"
          aria-label={`Actions for ${item.title}`}
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onMenu({ x: r.right - 200, y: r.bottom + 4 });
          }}
          className={cn(
            "rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            selected && "opacity-100"
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-foreground" title={item.title}>
          {displayName(item)}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
        {showPath && item.folder && (
          <p className="truncate text-[11px] text-muted-foreground/80">in {item.folder.replace(/\//g, " › ")}</p>
        )}
      </div>
    </li>
  );
}

function ListView({
  items,
  selectedId,
  dropTarget,
  showPath,
  canDrag,
  sort,
  onSort,
  onSelect,
  onOpen,
  onMenu,
  dropHandlers,
}: {
  items: ResourceItem[];
  selectedId: string | null;
  dropTarget: string | null;
  showPath: boolean;
  canDrag: boolean;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  onSelect: (id: string) => void;
  onOpen: (item: ResourceItem) => void;
  onMenu: (item: ResourceItem, at: { x: number; y: number }) => void;
  dropHandlers: (target: string) => React.HTMLAttributes<HTMLElement>;
}) {
  const cols = "grid grid-cols-[minmax(0,1fr)_110px_120px_80px] items-center gap-3";
  const head = (k: SortKey, label: string, className?: string) => (
    <SortHeader k={k} sort={sort} onSort={onSort} className={className}>
      {label}
    </SortHeader>
  );

  return (
    <div role="grid" aria-label="Files" className="text-sm">
      <div role="row" className={cn(cols, "border-b border-border px-3 pb-2")}>
        {head("name", "Name")}
        {head("kind", "Type", "hidden sm:flex")}
        {head("modified", "Modified", "hidden md:flex")}
        {head("size", "Size", "hidden md:flex justify-end")}
      </div>
      <ul role="rowgroup" className="divide-y divide-border/60">
        {items.map((item) => {
          const selected = selectedId === item.id;
          const isFolder = item.type === "FOLDER";
          const highlight = isFolder && dropTarget === pathOf(item);
          return (
            <li
              key={item.id}
              role="row"
              draggable={canDrag && !isImplied(item)}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-resource-id", item.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenu(item, { x: e.clientX, y: e.clientY });
              }}
              aria-selected={selected}
              className={cn(
                cols,
                "group cursor-default select-none rounded-lg px-3 py-1.5 transition-colors",
                selected ? "bg-primary/[0.08]" : "hover:bg-muted/60",
                highlight && "bg-primary/10 ring-2 ring-inset ring-primary/30"
              )}
              {...(isFolder ? dropHandlers(pathOf(item)) : {})}
            >
              <div role="gridcell" className="flex min-w-0 items-center gap-3">
                <KindIcon item={item} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{displayName(item)}</p>
                  {(showPath && item.folder) || item.type === "LINK" ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.type === "LINK" ? hostOf(item.url) : `in ${item.folder.replace(/\//g, " › ")}`}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Actions for ${item.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    onMenu(item, { x: r.right - 200, y: r.bottom + 4 });
                  }}
                  className={cn("ml-auto rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100", selected && "opacity-100")}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
              <div role="gridcell" className="hidden truncate text-xs text-muted-foreground sm:block">
                {kindLabel(item)}
              </div>
              <div role="gridcell" className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                <Clock className="size-3" /> {formatWhen(item.updatedAt)}
              </div>
              <div role="gridcell" className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">
                {item.type === "FILE" ? formatBytes(item.size) : "—"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SortHeader({
  k,
  sort,
  onSort,
  className,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => onSort(k)}
      className={cn("flex items-center gap-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground", className)}
    >
      {children}
      {sort.key === k && <ArrowDownAZ className={cn("size-3", sort.dir === -1 && "rotate-180")} />}
    </button>
  );
}

function Empty({
  query,
  folder,
  canWrite,
  onUpload,
  onNewFolder,
}: {
  query: string;
  folder: string;
  canWrite: boolean;
  onUpload: () => void;
  onNewFolder: () => void;
}) {
  if (query) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center">
        <Search className="size-6 text-muted-foreground" />
        <p className="font-heading text-sm font-medium">Nothing matches “{query}”</p>
        <p className="max-w-sm text-sm text-muted-foreground">Try a shorter word, or check another subject.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center">
      <FolderOpen className="size-7 text-muted-foreground" />
      <div>
        <p className="font-heading text-sm font-medium">{folder} is empty</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {canWrite ? "Drop files anywhere here, or start a folder for a topic." : "Nothing was filed here."}
        </p>
      </div>
      {canWrite && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onUpload}>
            <Upload /> Upload files
          </Button>
          <Button size="sm" variant="outline" onClick={onNewFolder}>
            <FolderPlus /> New folder
          </Button>
        </div>
      )}
    </div>
  );
}

/** The rail when nothing is selected: what this folder holds, and where it is. */
function FolderSummary({
  label,
  isRoot,
  items,
  folderPath,
  onDesktop,
  onShow,
}: {
  label: string;
  isRoot: boolean;
  items: ResourceItem[];
  folderPath: string | null;
  onDesktop: boolean;
  onShow: () => void;
}) {
  const files = items.filter((i) => i.type === "FILE");
  const links = items.filter((i) => i.type === "LINK").length;
  const folders = items.filter((i) => i.type === "FOLDER").length;
  const bytes = files.reduce((n, f) => n + (f.size ?? 0), 0);
  const kinds = new Map<string, number>();
  for (const f of files) kinds.set(kindLabel(f), (kinds.get(kindLabel(f)) ?? 0) + 1);

  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <KindIcon item={{ type: "FOLDER", ext: "" }} size="md" />
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">{isRoot ? "Subject folder" : "Folder"}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat n={folders} label="folders" />
        <Stat n={files.length} label="files" />
        <Stat n={links} label="links" />
      </dl>

      {kinds.size > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          {[...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <li key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
          {bytes > 0 && (
            <li className="flex justify-between border-t border-border pt-1 text-foreground">
              <span>On disk</span>
              <span className="tabular-nums">{formatBytes(bytes)}</span>
            </li>
          )}
        </ul>
      )}

      {folderPath && (
        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <HardDrive className="size-3" /> On this computer
          </p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-foreground">{folderPath}</p>
          {onDesktop && (
            <Button size="sm" variant="outline" onClick={onShow} className="mt-2 w-full">
              <FolderSymlink /> Show in Explorer
            </Button>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Click an item to see its details here. Double-click opens it; drag files onto a folder to move them
        {folderPath ? ", or drop them straight from Explorer to add them." : "."}
      </p>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-2 py-2">
      <dd className="font-heading text-lg font-semibold tabular-nums">{n}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}
