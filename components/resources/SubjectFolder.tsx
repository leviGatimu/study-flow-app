"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownUp,
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Info,
  LayoutGrid,
  Link2,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useIsDesktopApp } from "@/components/DesktopUpdater";
import { cn } from "@/lib/utils";
import { folderAncestors, folderName, folderParent, isWithinFolder, joinFolder } from "@/lib/library-paths";
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
import { folderAbsolutePath, libraryFileAbsolutePath, openInExplorer, revealInExplorer } from "./desktop-bridge";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { ItemDetails } from "./ItemDetails";
import { LinkDialog, MoveDialog, NameDialog } from "./explorer-dialogs";
import { displayName, formatBytes, formatWhen, hostOf, KindGlyph, kindLabel, kindOf } from "./file-kind";
import { useStoredPref } from "./use-stored-view";

/**
 * One subject's resources as a Study Flow page, not a file manager.
 *
 * A breadcrumb and three plain actions (Upload, New folder, Add link) on top;
 * folders and files as cards (or rows) below. Click opens, the checkbox or
 * Ctrl-click selects, right-click or ⋯ shows everything else. Files dropped
 * anywhere on the page are uploaded into the open folder; dropped on a folder
 * card, into that folder. Cards can be dragged onto a folder or a breadcrumb
 * step to move them.
 *
 * Everything the subject holds arrives in one payload and is walked
 * client-side, so opening a folder is instant; ?path= is kept in the URL with
 * pushState so reloads, links and the browser's Back button all work. Every
 * write is a server action followed by router.refresh(), which brings back the
 * reconciled truth - on the desktop that includes changes made in Explorer.
 */

type Props = { library: SubjectLibrary; initialPath: string };
type Sort = "name" | "recent" | "type";
type View = "grid" | "list";
type DialogState =
  | { kind: "folder" }
  | { kind: "rename"; item: ResourceItem }
  | { kind: "link" }
  | { kind: "move"; items: ResourceItem[] }
  | { kind: "delete"; items: ResourceItem[] }
  | { kind: "details"; item: ResourceItem }
  | null;

const DRAG_TYPE = "application/x-resource-ids";
const SORT_LABEL: Record<Sort, string> = { name: "Name", recent: "Recently changed", type: "Type" };
const parseView = (raw: string): View | null => (raw === "grid" || raw === "list" ? raw : null);
const parseSort = (raw: string): Sort | null => (raw in SORT_LABEL ? (raw as Sort) : null);

const pathOf = (item: ResourceItem) => joinFolder(item.folder, item.title);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isImplied = (item: ResourceItem) => item.id.startsWith("implied:");

/** Folders that exist only because something is filed beneath them. */
function withImpliedFolders(items: ResourceItem[], subject: string): ResourceItem[] {
  const have = new Set(items.filter((i) => i.type === "FOLDER").map((i) => pathOf(i).toLowerCase()));
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
        folder: folderParent(path),
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

function deleteWarning(list: ResourceItem[], onDisk: boolean, childCount: (f: ResourceItem) => number): string {
  const fromDisk = onDisk && list.some((i) => i.type === "FOLDER" || i.inLibrary) ? " from your computer as well" : "";
  if (list.length === 1) {
    const item = list[0];
    if (item.type === "FOLDER") {
      const n = childCount(item);
      return `The folder and the ${n} ${n === 1 ? "item" : "items"} inside it will be deleted${fromDisk}. This cannot be undone.`;
    }
    if (item.type === "LINK") return "The link will be removed from this subject.";
    return `The file will be deleted${fromDisk}. This cannot be undone.`;
  }
  const folders = list.filter((i) => i.type === "FOLDER").length;
  return `${list.length} items${folders ? `, including ${folders} ${folders === 1 ? "folder and everything in it" : "folders and everything in them"},` : ""} will be deleted${fromDisk}. This cannot be undone.`;
}

const pathFromUrl = () => new URLSearchParams(window.location.search).get("path") ?? "";

export function SubjectFolder({ library, initialPath }: Props) {
  const router = useRouter();
  const onDesktop = useIsDesktopApp();
  const [, startTransition] = useTransition();
  const canWrite = !library.archived;
  const hasDisk = onDesktop && !!library.folderPath;

  const items = useMemo(() => withImpliedFolders(library.items, library.subject), [library.items, library.subject]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const folderPaths = useMemo(() => items.filter((i) => i.type === "FOLDER").map(pathOf), [items]);

  const [view, setView] = useStoredPref<View>("resources:folder-view", "grid", parseView);
  const [sort, setSort] = useStoredPref<Sort>("resources:folder-sort", "name", parseSort);
  const [requestedPath, setRequestedPath] = useState(initialPath);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; entries: MenuEntry[] } | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  // A folder deleted (here or in Explorer) while open shows the nearest
  // ancestor that still exists rather than an empty page for a ghost.
  const path = useMemo(() => {
    const exists = (p: string) => !p || folderPaths.some((f) => same(f, p));
    if (exists(requestedPath)) return requestedPath;
    return [...folderAncestors(requestedPath)].reverse().find(exists) ?? "";
  }, [folderPaths, requestedPath]);

  // --- navigation: pushState so Back and Forward walk folders --------------
  const go = useCallback((next: string) => {
    setRequestedPath(next);
    setSelected(new Set());
    setQuery("");
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("path", next);
    else params.delete("path");
    const qs = params.toString();
    window.history.pushState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setRequestedPath(pathFromUrl());
      setSelected(new Set());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // --- what is on screen ---------------------------------------------------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Search covers the open folder and everything below it.
    const pool = q
      ? items.filter(
          (i) =>
            !isImplied(i) &&
            isWithinFolder(i.folder.toLowerCase(), path.toLowerCase()) &&
            (i.title.toLowerCase().includes(q) || (i.type === "LINK" && i.url.toLowerCase().includes(q)))
        )
      : items.filter((i) => same(i.folder, path));
    const byName = (a: ResourceItem, b: ResourceItem) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
    const folderFirst = (a: ResourceItem, b: ResourceItem) => Number(a.type !== "FOLDER") - Number(b.type !== "FOLDER");
    return [...pool].sort((a, b) => {
      if (sort === "recent") return b.updatedAt.localeCompare(a.updatedAt) || byName(a, b);
      if (sort === "type") return folderFirst(a, b) || kindLabel(a).localeCompare(kindLabel(b)) || byName(a, b);
      return folderFirst(a, b) || byName(a, b);
    });
  }, [items, path, query, sort]);

  const folders = visible.filter((i) => i.type === "FOLDER");
  const files = visible.filter((i) => i.type !== "FOLDER");
  // Selection only ever refers to what is on screen.
  const selectedItems = visible.filter((i) => selected.has(i.id));
  const writableSelection = selectedItems.filter((i) => !isImplied(i));
  const childCount = (folder: ResourceItem) => items.filter((i) => !isImplied(i) && same(i.folder, pathOf(folder))).length;
  const canLoad = (item: ResourceItem) => !(item.type === "FILE" && item.inLibrary && !onDesktop);
  const currentLabel = path ? folderName(path) : library.subject;

  // --- actions -------------------------------------------------------------
  const refresh = () => startTransition(() => router.refresh());

  const openItem = (item: ResourceItem) => {
    if (item.type === "FOLDER") return go(pathOf(item));
    if (!canLoad(item)) {
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
      result = await openInExplorer(folderAbsolutePath(library.folderPath, item ? pathOf(item) : path));
    }
    if (!result.ok) toast.error(result.error ?? "Could not open Explorer.");
  };

  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("The clipboard is not available here.");
    }
  };

  const uploadFiles = async (list: File[], into = path) => {
    if (!canWrite || list.length === 0) return;
    const form = new FormData();
    form.set("subject", library.subject);
    form.set("folder", into);
    for (const f of list) form.append("file", f);
    const id = toast.loading(list.length === 1 ? `Adding ${list[0].name}…` : `Adding ${list.length} files…`);
    const result = await uploadResourceFiles(form);
    toast.dismiss(id);
    if (result.added > 0) {
      toast.success(result.added === 1 ? "File added" : `${result.added} files added`, {
        description: `Into ${into ? folderName(into) : library.subject}`,
      });
    }
    for (const e of result.errors) toast.error(e);
    refresh();
  };

  const moveMany = async (ids: string[], target: string): Promise<string | null> => {
    const movable = ids
      .map((id) => byId.get(id))
      .filter((i): i is ResourceItem => !!i && !isImplied(i))
      .filter((i) => !same(i.folder, target))
      .filter((i) => !(i.type === "FOLDER" && isWithinFolder(target.toLowerCase(), pathOf(i).toLowerCase())));
    if (movable.length === 0) return null;
    let moved = 0;
    const errors: string[] = [];
    for (const item of movable) {
      const r = await moveResource(item.id, target);
      if (r.success) moved++;
      else errors.push(`${displayName(item)}: ${r.error ?? "could not be moved"}`);
    }
    if (moved > 0) {
      toast.success(`Moved ${moved === 1 ? displayName(movable[0]) : `${moved} items`} to ${target ? folderName(target) : library.subject}`);
    }
    errors.forEach((e) => toast.error(e));
    setSelected(new Set());
    refresh();
    return errors.length && !moved ? errors[0] : null;
  };

  const deleteMany = async (list: ResourceItem[]) => {
    let removed = 0;
    for (const item of list) {
      const r = await deleteResourceItem(item.id);
      if (r.success) removed++;
      else toast.error(`${displayName(item)}: ${r.error ?? "could not be deleted"}`);
    }
    if (removed > 0) toast.success(removed === 1 ? `Deleted ${displayName(list[0])}` : `Deleted ${removed} items`);
    setSelected(new Set());
    refresh();
  };

  const toggleSelect = (item: ResourceItem) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

  // --- menus ---------------------------------------------------------------
  const entriesFor = (item: ResourceItem): MenuEntry[] => {
    // Right-clicking inside the selection acts on the whole selection.
    const list = selected.has(item.id) && selectedItems.length > 1 ? selectedItems : [item];
    const one = list.length === 1 ? list[0] : null;
    const editable = list.filter((i) => !isImplied(i));
    const e: MenuEntry[] = [];
    if (one) {
      e.push({ kind: "item", label: one.type === "FOLDER" ? "Open" : one.type === "LINK" ? "Open link" : "Open file", icon: one.type === "FOLDER" ? <FolderOpen /> : <ExternalLink />, onSelect: () => openItem(one) });
      if (hasDisk && (one.type === "FOLDER" || one.inLibrary)) {
        e.push({ kind: "item", label: one.type === "FOLDER" ? "Open in Windows Explorer" : "Show in Explorer", icon: <FolderSymlink />, onSelect: () => void showInExplorer(one) });
      }
      if (one.type === "LINK") e.push({ kind: "item", label: "Copy link", icon: <Copy />, onSelect: () => void copyText(one.url, "Link") });
      e.push({ kind: "item", label: "Details", icon: <Info />, onSelect: () => setDialog({ kind: "details", item: one }) });
    }
    if (canWrite && editable.length) {
      e.push({ kind: "separator" });
      if (one && !isImplied(one)) e.push({ kind: "item", label: "Rename", icon: <Pencil />, onSelect: () => setDialog({ kind: "rename", item: one }) });
      e.push({ kind: "item", label: "Move to…", icon: <FolderSymlink />, onSelect: () => setDialog({ kind: "move", items: editable }) });
      e.push({ kind: "item", label: editable.length > 1 ? `Delete ${editable.length} items` : "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDialog({ kind: "delete", items: editable }) });
    }
    return e;
  };
  const openMenu = (item: ResourceItem, at: { x: number; y: number }) => setMenu({ at, entries: entriesFor(item) });

  // --- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (dialog || (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)))) return;
      if (e.key === "/") {
        e.preventDefault();
        searchBox.current?.focus();
      } else if (e.key === "Escape") {
        setSelected(new Set());
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(visible.map((i) => i.id)));
      } else if (e.key === "Delete" && canWrite && writableSelection.length) {
        setDialog({ kind: "delete", items: writableSelection });
      } else if (e.key === "F2" && canWrite && writableSelection.length === 1) {
        e.preventDefault();
        setDialog({ kind: "rename", item: writableSelection[0] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, visible, canWrite, writableSelection]);

  // --- drag and drop -------------------------------------------------------
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const hasItems = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes(DRAG_TYPE);

  /** Drop handlers for a folder target: files upload into it, cards move into it. */
  const dropInto = (target: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canWrite || (!hasFiles(e) && !hasItems(e))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasItems(e) ? "move" : "copy";
      setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((d) => (d === target ? null : d)),
    onDrop: (e: React.DragEvent) => {
      if (!canWrite) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      setFileDrag(false);
      const ids = e.dataTransfer.getData(DRAG_TYPE);
      if (ids) void moveMany(ids.split(","), target);
      else if (e.dataTransfer.files.length) void uploadFiles(Array.from(e.dataTransfer.files), target);
    },
  });

  const dragProps = (item: ResourceItem) =>
    canWrite && !isImplied(item)
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            const ids = selected.has(item.id) ? writableSelection.map((i) => i.id) : [item.id];
            e.dataTransfer.setData(DRAG_TYPE, ids.join(","));
            e.dataTransfer.effectAllowed = "move";
          },
        }
      : {};

  const crumbs = [{ label: library.subject, path: "" }, ...(path ? path.split("/").map((seg, i, all) => ({ label: seg, path: all.slice(0, i + 1).join("/") })) : [])];

  const cardProps = (item: ResourceItem) => ({
    item,
    selected: selected.has(item.id),
    selecting: selected.size > 0,
    canLoad: canLoad(item),
    childCount: item.type === "FOLDER" ? childCount(item) : undefined,
    isDropTarget: item.type === "FOLDER" && dropTarget === pathOf(item),
    onOpen: (e: React.MouseEvent) => (e.ctrlKey || e.metaKey ? toggleSelect(item) : selected.size > 0 ? toggleSelect(item) : openItem(item)),
    onToggle: () => toggleSelect(item),
    onMenu: (at: { x: number; y: number }) => openMenu(item, at),
    drop: item.type === "FOLDER" ? dropInto(pathOf(item)) : undefined,
    drag: dragProps(item),
  });

  return (
    <div
      className="relative space-y-5"
      onDragEnter={(e) => {
        if (canWrite && hasFiles(e)) setFileDrag(true);
      }}
      onDragOver={(e) => {
        if (!canWrite || !hasFiles(e)) return;
        e.preventDefault();
        setDropTarget(path);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setFileDrag(false);
          setDropTarget(null);
        }
      }}
      onDrop={(e) => {
        if (!canWrite || !hasFiles(e)) return;
        e.preventDefault();
        setFileDrag(false);
        setDropTarget(null);
        void uploadFiles(Array.from(e.dataTransfer.files), path);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          void uploadFiles(list);
        }}
      />

      {/* Title, breadcrumb and actions */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/resources" className="rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
              Resources
            </Link>
            {crumbs.map((c, i) => (
              <span key={c.path || "root"} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => go(c.path)}
                  aria-current={i === crumbs.length - 1 ? "page" : undefined}
                  {...dropInto(c.path)}
                  className={cn(
                    "max-w-[14rem] truncate rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground",
                    i === crumbs.length - 1 && "font-medium text-foreground",
                    dropTarget === c.path && "bg-primary/15 text-primary ring-1 ring-primary"
                  )}
                >
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
          <h1 className="truncate font-heading text-3xl font-bold tracking-tight">{currentLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {folders.length + files.length === 0
              ? "Empty"
              : [folders.length && `${folders.length} ${folders.length === 1 ? "folder" : "folders"}`, files.length && `${files.length} ${files.length === 1 ? "item" : "items"}`]
                  .filter(Boolean)
                  .join(" · ")}
            {library.archived && " · Finished year, read only"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <Button onClick={() => fileInput.current?.click()}>
                <Upload /> Upload
              </Button>
              <Button variant="outline" onClick={() => setDialog({ kind: "folder" })}>
                <FolderPlus /> New folder
              </Button>
              <Button variant="outline" onClick={() => setDialog({ kind: "link" })}>
                <Link2 /> Add link
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/subjects?subject=${encodeURIComponent(library.subject)}`}>
                  <FolderOpen /> Open {library.subject} in Subjects
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/ai/practices?subject=${encodeURIComponent(library.subject)}`}>
                  <BrainCircuit /> Practise {library.subject}
                </Link>
              </DropdownMenuItem>
              {hasDisk && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void showInExplorer(null)}>
                    <FolderSymlink /> Show in Explorer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search, sort, view */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchBox}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(new Set());
            }}
            placeholder={`Search ${currentLabel}`}
            aria-label={`Search ${currentLabel}`}
            className="h-10 pl-9 pr-9"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg">
                <ArrowDownUp /> {SORT_LABEL[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => setSort(s)}>
                  <Check className={cn(sort !== s && "opacity-0")} /> {SORT_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div role="group" aria-label="View" className="flex rounded-xl border border-border p-0.5">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "grid"} aria-label="Cards" onClick={() => setView("grid")}>
              <LayoutGrid />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-pressed={view === "list"} aria-label="List" onClick={() => setView("list")}>
              <ListIcon />
            </Button>
          </div>
        </div>
      </div>

      {/* Contents */}
      {visible.length === 0 ? (
        query ? (
          <EmptyState
            title={`Nothing in ${currentLabel} matches “${query}”`}
            description="Check the spelling, or clear the search."
            action={<Button variant="outline" size="sm" onClick={() => setQuery("")}>Clear search</Button>}
          />
        ) : (
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => fileInput.current?.click()}
            className="flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.04] disabled:cursor-default disabled:hover:border-border disabled:hover:bg-muted/30"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </span>
            <span className="text-base font-semibold">{currentLabel} is empty</span>
            <span className="max-w-sm text-sm text-muted-foreground">
              {canWrite ? "Drop notes, past papers or slides here, or click to choose files. Add a folder or a link with the buttons above." : "Nothing was filed here."}
            </span>
          </button>
        )
      ) : view === "grid" ? (
        <div className="space-y-6">
          {folders.length > 0 && (
            <section aria-label="Folders">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Folders</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {folders.map((item) => (
                  <FolderCard key={item.id} {...cardProps(item)} />
                ))}
              </ul>
            </section>
          )}
          {files.length > 0 && (
            <section aria-label="Files and links">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{query ? "Results" : "Files and links"}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {files.map((item) => (
                  <FileCard key={item.id} {...cardProps(item)} showFolder={!!query} subject={library.subject} />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {visible.map((item) => (
            <ItemRow key={item.id} {...cardProps(item)} showFolder={!!query} subject={library.subject} />
          ))}
        </ul>
      )}

      {/* Selection bar */}
      {selectedItems.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover px-3 py-2 shadow-xl">
          <span className="px-2 text-sm font-medium tabular-nums">{selectedItems.length} selected</span>
          {canWrite && writableSelection.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "move", items: writableSelection })}>
                <FolderSymlink /> Move
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: "delete", items: writableSelection })}>
                <Trash2 /> Delete
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(visible.map((i) => i.id)))}>
            Select all
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <X />
          </Button>
        </div>
      )}

      {/* Whole-page drop overlay for files from the computer */}
      {fileDrag && dropTarget === path && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center shadow-xl">
            <Upload className="mx-auto size-6 text-primary" />
            <p className="mt-3 text-base font-semibold">Drop to add to {currentLabel}</p>
          </div>
        </div>
      )}

      <ContextMenu at={menu?.at ?? null} entries={menu?.entries ?? []} onClose={() => setMenu(null)} />

      {dialog?.kind === "folder" && (
        <NameDialog
          open
          title="New folder"
          description={`Inside ${currentLabel}.`}
          label="Folder name"
          submitLabel="Create folder"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const r = await createResourceFolder(library.subject, path, name.trim());
            if (!r.success) return r.error ?? "Could not create the folder.";
            toast.success(`Created ${name.trim()}`);
            refresh();
            return null;
          }}
        />
      )}

      {dialog?.kind === "rename" && (
        <NameDialog
          open
          title={`Rename ${displayName(dialog.item)}`}
          label="New name"
          initial={dialog.item.title}
          selectUpTo={dialog.item.type === "FILE" && dialog.item.ext ? dialog.item.title.length - dialog.item.ext.length - 1 : undefined}
          submitLabel="Rename"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const r = await renameResource(dialog.item.id, name);
            if (!r.success) return r.error ?? "Could not rename it.";
            refresh();
            return null;
          }}
        />
      )}

      {dialog?.kind === "link" && (
        <LinkDialog
          open
          folderLabel={currentLabel}
          onClose={() => setDialog(null)}
          onSubmit={async ({ title, url }) => {
            const r = await addResourceLink(library.subject, path, title, url);
            if (!r.success) return r.error ?? "Something went wrong.";
            toast.success("Link added");
            refresh();
            return null;
          }}
        />
      )}

      {dialog?.kind === "move" && (
        <MoveDialog
          open
          subject={library.subject}
          folders={folderPaths}
          itemLabel={dialog.items.length === 1 ? displayName(dialog.items[0]) : `${dialog.items.length} items`}
          currentFolder={dialog.items.every((i) => same(i.folder, dialog.items[0].folder)) ? dialog.items[0].folder : null}
          ownPaths={dialog.items.filter((i) => i.type === "FOLDER").map(pathOf)}
          onClose={() => setDialog(null)}
          onSubmit={(target) => moveMany(dialog.items.map((i) => i.id), target)}
        />
      )}

      <ConfirmModal
        isOpen={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "delete" ? (dialog.items.length === 1 ? `Delete ${displayName(dialog.items[0])}?` : `Delete ${dialog.items.length} items?`) : ""}
        description={dialog?.kind === "delete" ? deleteWarning(dialog.items, hasDisk, childCount) : ""}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          const list = dialog.items;
          setDialog(null);
          void deleteMany(list);
        }}
      />

      <Dialog open={dialog?.kind === "details"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="sr-only">Details</DialogTitle>
          {dialog?.kind === "details" && (
            <ItemDetails
              item={dialog.item}
              subject={library.subject}
              childCount={dialog.item.type === "FOLDER" ? childCount(dialog.item) : undefined}
              canWrite={canWrite && !isImplied(dialog.item)}
              onDesktop={hasDisk}
              onOpen={() => {
                const it = dialog.item;
                setDialog(null);
                openItem(it);
              }}
              onOpenFolder={() => void showInExplorer(dialog.item)}
              onReveal={() => void showInExplorer(dialog.item)}
              onRename={() => setDialog({ kind: "rename", item: dialog.item })}
              onMove={() => setDialog({ kind: "move", items: [dialog.item] })}
              onDelete={() => setDialog({ kind: "delete", items: [dialog.item] })}
              onNavigate={(folder) => {
                setDialog(null);
                go(folder);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

type CardProps = {
  item: ResourceItem;
  selected: boolean;
  selecting: boolean;
  canLoad: boolean;
  childCount?: number;
  isDropTarget: boolean;
  onOpen: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onMenu: (at: { x: number; y: number }) => void;
  drop?: Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
  drag: Partial<Pick<React.HTMLAttributes<HTMLElement>, "draggable" | "onDragStart">>;
};

function menuAt(e: React.MouseEvent) {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.right - 200, y: r.bottom + 4 };
}

/** The checkbox in a card's corner: visible on hover, or always once selecting. */
function SelectBox({ item, selected, selecting, onToggle }: Pick<CardProps, "item" | "selected" | "selecting" | "onToggle">) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${displayName(item)}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background",
        !selected && !selecting && "opacity-0 group-hover:opacity-100"
      )}
    >
      {selected && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

function MoreButton({ item, onMenu }: Pick<CardProps, "item" | "onMenu">) {
  return (
    <button
      type="button"
      aria-label={`More for ${displayName(item)}`}
      onClick={(e) => {
        e.stopPropagation();
        onMenu(menuAt(e));
      }}
      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
    >
      <MoreHorizontal className="size-4" />
    </button>
  );
}

function cardShell(selected: boolean, isDropTarget: boolean) {
  return cn(
    "group relative flex h-full w-full cursor-pointer flex-col rounded-2xl border bg-card text-left shadow-sm transition-[border-color,box-shadow,background-color] duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    selected ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "border-border/60 hover:border-border",
    isDropTarget && "border-primary bg-primary/10 ring-2 ring-primary"
  );
}

function activate(onOpen: CardProps["onOpen"]) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onOpen(e as unknown as React.MouseEvent);
    },
  };
}

function FolderCard({ item, selected, selecting, childCount = 0, isDropTarget, onOpen, onToggle, onMenu, drop, drag }: CardProps) {
  return (
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div {...activate(onOpen)} {...drop} {...drag} aria-label={`Open folder ${item.title}`} className={cn(cardShell(selected, isDropTarget), "gap-3 p-3.5")}>
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/15">
            <KindGlyph item={item} px={24} />
          </span>
          <span className="flex items-center gap-1">
            <MoreButton item={item} onMenu={onMenu} />
            <SelectBox item={item} selected={selected} selecting={selecting} onToggle={onToggle} />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground">{childCount === 0 ? "Empty" : `${childCount} ${childCount === 1 ? "item" : "items"}`}</p>
        </div>
      </div>
    </li>
  );
}

function Thumb({ item, canLoad }: { item: ResourceItem; canLoad: boolean }) {
  const [failed, setFailed] = useState(false);
  if (kindOf(item) === "image" && canLoad && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user files, any size and host
      <img src={item.url} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="size-full object-cover" />
    );
  }
  return <KindGlyph item={item} px={44} />;
}

function metaOf(item: ResourceItem, canLoad: boolean) {
  if (!canLoad) return "Only on your desktop";
  if (item.type === "LINK") return hostOf(item.url);
  return [kindLabel(item), item.size != null ? formatBytes(item.size) : null].filter(Boolean).join(" · ");
}

function FileCard({ item, selected, selecting, canLoad, isDropTarget, onOpen, onToggle, onMenu, drag, showFolder, subject }: CardProps & { showFolder: boolean; subject: string }) {
  return (
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div {...activate(onOpen)} {...drag} aria-label={`Open ${displayName(item)}`} className={cn(cardShell(selected, isDropTarget), "overflow-hidden")}>
        <div className={cn("relative flex h-28 items-center justify-center overflow-hidden bg-muted/40", !canLoad && "opacity-60")}>
          <Thumb item={item} canLoad={canLoad} />
          <span className="absolute left-2.5 top-2.5">
            <SelectBox item={item} selected={selected} selecting={selecting} onToggle={onToggle} />
          </span>
          <span className="absolute right-2 top-2 rounded-md opacity-0 transition-opacity focus-within:bg-card/90 focus-within:opacity-100 group-hover:bg-card/90 group-hover:opacity-100">
            <MoreButton item={item} onMenu={onMenu} />
          </span>
        </div>
        <div className="min-w-0 space-y-0.5 p-3">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug" title={displayName(item)}>
            {displayName(item)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {showFolder ? `${subject}${item.folder ? ` › ${item.folder.replace(/\//g, " › ")}` : ""}` : metaOf(item, canLoad)}
          </p>
          <p className="text-xs text-muted-foreground/80">{formatWhen(item.updatedAt)}</p>
        </div>
      </div>
    </li>
  );
}

function ItemRow({ item, selected, selecting, canLoad, childCount = 0, isDropTarget, onOpen, onToggle, onMenu, drop, drag, showFolder, subject }: CardProps & { showFolder: boolean; subject: string }) {
  const isFolder = item.type === "FOLDER";
  return (
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div
        {...activate(onOpen)}
        {...drop}
        {...drag}
        aria-label={isFolder ? `Open folder ${item.title}` : `Open ${displayName(item)}`}
        className={cn(
          "group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
          selected && "bg-primary/[0.06]",
          isDropTarget && "bg-primary/10 ring-1 ring-inset ring-primary"
        )}
      >
        <SelectBox item={item} selected={selected} selecting={selecting} onToggle={onToggle} />
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50", isFolder && "bg-amber-400/15", !canLoad && "opacity-60")}>
          <KindGlyph item={item} px={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName(item)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {showFolder
              ? `${subject}${item.folder ? ` › ${item.folder.replace(/\//g, " › ")}` : ""}`
              : isFolder
                ? childCount === 0
                  ? "Empty"
                  : `${childCount} ${childCount === 1 ? "item" : "items"}`
                : metaOf(item, canLoad)}
          </p>
        </div>
        <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground sm:block">{formatWhen(item.updatedAt)}</span>
        <MoreButton item={item} onMenu={onMenu} />
      </div>
    </li>
  );
}
