"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardPaste,
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
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  RotateCw,
  Scissors,
  Search,
  SquareDashedMousePointer,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmModal } from "@/components/ConfirmModal";
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
import { useIsDesktopApp } from "@/components/DesktopUpdater";
import { folderAbsolutePath, libraryFileAbsolutePath, openInExplorer, revealInExplorer } from "./desktop-bridge";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { ItemDetails } from "./ItemDetails";
import { LinkDialog, MoveDialog } from "./explorer-dialogs";
import { AddressBar, NavPane, type DropHandlers } from "./explorer-chrome";
import {
  DEFAULT_COLUMNS,
  ExplorerItems,
  flowAxis,
  itemDomId,
  parseView,
  RenameBox,
  VIEW_LABEL,
  VIEW_SHORTCUT,
  type Columns,
  type ExplorerView,
  type ItemState,
  type Sort,
  type SortKey,
} from "./explorer-views";
import { displayName, formatBytes, KindGlyph, kindLabel } from "./file-kind";
import { useStoredPref } from "./use-stored-view";

/**
 * A subject's resources as a Windows File Explorer window.
 *
 * Toolbar, address bar and search on top; command bar; navigation pane,
 * contents and details pane; status bar. It behaves like Explorer too:
 * Ctrl/Shift-click and rubber-band selection, arrow keys, F2 renames in
 * place, Ctrl+Shift+N makes a folder and names it in place, Ctrl+X / Ctrl+V
 * move, Alt+Left/Right/Up walk the history, type a letter to jump.
 *
 * Everything the subject holds arrives in one payload and is walked
 * client-side, so opening a folder is instant; ?path= is only bookkeeping for
 * reloads and links. Every write is a server action followed by
 * router.refresh(), which brings back the reconciled truth - on the desktop
 * that includes whatever changed in the folder from outside the app.
 *
 * There is no Copy: the server can move and rename but not duplicate, and a
 * Copy button that moved things would be worse than none.
 */

type Props = {
  library: SubjectLibrary;
  initialPath: string;
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

const isImplied = (item: ResourceItem) => item.id.startsWith("implied:");
const pathOf = (item: ResourceItem) => joinFolder(item.folder, item.title);
const sameFolder = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const DRAG_TYPE = "application/x-resource-ids";

const parseColumns = (raw: string): Columns | null => {
  try {
    const v = JSON.parse(raw) as Partial<Columns>;
    return { ...DEFAULT_COLUMNS, ...v };
  } catch {
    return null;
  }
};
const parseBool = (raw: string) => (raw === "true" ? true : raw === "false" ? false : null);

export function SubjectExplorer({ library, initialPath }: Props) {
  const router = useRouter();
  const onDesktop = useIsDesktopApp();
  const [pending, startTransition] = useTransition();
  const canWrite = !library.archived;
  const hasDisk = onDesktop && !!library.folderPath;

  const items = useMemo(() => withImpliedFolders(library.items, library.subject), [library.items, library.subject]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const folderPaths = useMemo(() => items.filter((i) => i.type === "FOLDER").map(pathOf), [items]);

  // --- preferences ------------------------------------------------------
  const [view, setView] = useStoredPref<ExplorerView>("resources:explorer-view", "details", parseView);
  const [columnsRaw, setColumnsRaw] = useStoredPref<string>("resources:explorer-columns", JSON.stringify(DEFAULT_COLUMNS), (r) => r);
  const columns = parseColumns(columnsRaw) ?? DEFAULT_COLUMNS;
  const [navOpen, setNavOpen] = useStoredPref<boolean>("resources:explorer-nav", true, parseBool);
  const [detailsOpen, setDetailsOpen] = useStoredPref<boolean>("resources:explorer-details", true, parseBool);
  const [sort, setSort] = useState<Sort>({ key: "name", dir: 1 });

  // --- navigation + history ---------------------------------------------
  const [history, setHistory] = useState<{ stack: string[]; at: number }>({ stack: [initialPath], at: 0 });
  const requestedPath = history.stack[history.at];
  const [query, setQuery] = useState("");

  // A folder deleted (here or in Explorer) while open shows the nearest
  // ancestor that still exists rather than an empty page for a ghost.
  const path = useMemo(() => {
    const exists = (p: string) => !p || folderPaths.some((f) => sameFolder(f, p));
    if (exists(requestedPath)) return requestedPath;
    return [...folderAncestors(requestedPath)].reverse().find(exists) ?? "";
  }, [folderPaths, requestedPath]);

  // --- selection --------------------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [cutIds, setCutIds] = useState<string[]>([]);

  const syncUrl = (next: string) => {
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("path", next);
    else params.delete("path");
    const qs = params.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const resetFor = (selectPath?: string) => {
    const hit = selectPath ? items.find((i) => i.type === "FOLDER" && sameFolder(pathOf(i), selectPath)) : undefined;
    setSelected(hit ? new Set([hit.id]) : new Set());
    setAnchorId(hit?.id ?? null);
    setFocusId(hit?.id ?? null);
    setRenamingId(null);
    setQuery("");
  };

  const go = (next: string) => {
    if (sameFolder(next, path) && !query) return;
    setHistory((h) => ({ stack: [...h.stack.slice(0, h.at + 1), next], at: h.at + 1 }));
    resetFor();
    syncUrl(next);
  };
  const back = () => {
    if (history.at === 0) return;
    const from = path;
    setHistory((h) => ({ ...h, at: h.at - 1 }));
    resetFor(from);
    syncUrl(history.stack[history.at - 1]);
  };
  const forward = () => {
    if (history.at >= history.stack.length - 1) return;
    setHistory((h) => ({ ...h, at: h.at + 1 }));
    resetFor();
    syncUrl(history.stack[history.at + 1]);
  };
  // Up selects the folder you came out of, so Enter goes straight back in.
  const up = () => {
    if (!path) return;
    const from = path;
    setHistory((h) => ({ stack: [...h.stack.slice(0, h.at + 1), folderParent(from)], at: h.at + 1 }));
    resetFor(from);
    syncUrl(folderParent(from));
  };
  const openSubject = (name: string) => router.push(`/resources/${encodeURIComponent(name)}`);

  // --- what is on screen ------------------------------------------------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Search, like Explorer's, covers the open folder and everything below it.
    const pool = q
      ? items.filter(
          (i) =>
            !isImplied(i) &&
            isWithinFolder(i.folder.toLowerCase(), path.toLowerCase()) &&
            (i.title.toLowerCase().includes(q) || (i.type === "LINK" && i.url.toLowerCase().includes(q)))
        )
      : items.filter((i) => sameFolder(i.folder, path));

    const rank = (i: ResourceItem) => (i.type === "FOLDER" ? 0 : 1);
    const byName = (a: ResourceItem, b: ResourceItem) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
    const cmp = (a: ResourceItem, b: ResourceItem) => {
      let r = 0;
      switch (sort.key) {
        case "name":
          r = rank(a) - rank(b) || byName(a, b);
          break;
        case "kind":
          r = rank(a) - rank(b) || kindLabel(a).localeCompare(kindLabel(b));
          break;
        case "modified":
          r = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case "size":
          r = (a.size ?? -1) - (b.size ?? -1);
          break;
        case "folder":
          r = a.folder.localeCompare(b.folder);
          break;
      }
      return (r || byName(a, b)) * sort.dir;
    };
    return [...pool].sort(cmp);
  }, [items, path, query, sort]);

  // Selection only ever refers to what is on screen: a refresh that removed
  // an item, or navigating away, drops it rather than acting on a ghost.
  const selectedItems = useMemo(() => visible.filter((i) => selected.has(i.id)), [visible, selected]);
  const single = selectedItems.length === 1 ? selectedItems[0] : null;
  const writable = selectedItems.filter((i) => !isImplied(i));

  // --- new-folder-then-rename -------------------------------------------
  // Explorer names a new folder in place. The row only exists after the
  // refresh, so remember the path and pick it up when it arrives.
  const [awaitingRename, setAwaitingRename] = useState<string | null>(null);
  if (awaitingRename) {
    const hit = items.find((i) => i.type === "FOLDER" && !isImplied(i) && sameFolder(pathOf(i), awaitingRename));
    if (hit) {
      setAwaitingRename(null);
      setSelected(new Set([hit.id]));
      setAnchorId(hit.id);
      setFocusId(hit.id);
      setRenamingId(hit.id);
    }
  }

  // --- actions ----------------------------------------------------------
  const refresh = () => startTransition(() => router.refresh());
  const surface = useRef<HTMLDivElement>(null);
  const focusSurface = () => requestAnimationFrame(() => surface.current?.focus({ preventScroll: true }));

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
      result = await openInExplorer(folderAbsolutePath(library.folderPath, item ? pathOf(item) : path));
    }
    if (!result.ok) toast.error(result.error ?? "Could not open Explorer.");
  };

  const absolutePathOf = (item: ResourceItem): string | null => {
    if (!library.folderPath) return null;
    if (item.type === "FOLDER") return folderAbsolutePath(library.folderPath, pathOf(item));
    if (item.type === "FILE" && library.libraryDir) return libraryFileAbsolutePath(library.libraryDir, item.url);
    return null;
  };

  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("The clipboard is not available here.");
    }
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
        description: `Into ${into ? folderName(into) : library.subject}`,
      });
    }
    for (const e of result.errors) toast.error(e);
    refresh();
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const pickFiles = () => fileInput.current?.click();

  const newFolder = async () => {
    if (!canWrite) return;
    setQuery("");
    const taken = new Set(items.filter((i) => sameFolder(i.folder, path)).map((i) => i.title.toLowerCase()));
    let name = "New folder";
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `New folder (${n})`;
    const r = await createResourceFolder(library.subject, path, name);
    if (!r.success) return toast.error(r.error ?? "Could not create the folder.");
    setAwaitingRename(joinFolder(path, name));
    refresh();
  };

  const commitRename = async (item: ResourceItem, name: string): Promise<string | null> => {
    const r = await renameResource(item.id, name);
    if (!r.success) {
      const problem = r.error ?? "Could not rename it.";
      toast.error(problem);
      return problem;
    }
    setRenamingId(null);
    focusSurface();
    refresh();
    return null;
  };

  const startRename = (item: ResourceItem | null) => {
    if (!canWrite || !item || isImplied(item)) return;
    setSelected(new Set([item.id]));
    setFocusId(item.id);
    setRenamingId(item.id);
  };

  /** Move several items, one server call each; reports once at the end. */
  const moveMany = async (ids: string[], target: string): Promise<string | null> => {
    const movable = ids
      .map((id) => byId.get(id))
      .filter((i): i is ResourceItem => !!i && !isImplied(i))
      .filter((i) => !sameFolder(i.folder, target))
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
    refresh();
    return errors.length && !moved ? errors[0] : null;
  };

  const cut = () => {
    if (!canWrite || writable.length === 0) return;
    setCutIds(writable.map((i) => i.id));
    toast(`${writable.length === 1 ? displayName(writable[0]) : `${writable.length} items`} ready to move`, {
      description: "Open the destination folder and paste (Ctrl+V).",
    });
  };

  const paste = async (into = path) => {
    if (!canWrite || cutIds.length === 0) return;
    const ids = cutIds;
    setCutIds([]);
    await moveMany(ids, into);
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

  // --- dialogs ----------------------------------------------------------
  type Dialog = { kind: "move"; items: ResourceItem[] } | { kind: "link" } | { kind: "delete"; items: ResourceItem[] } | null;
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => {
    setDialog(null);
    focusSurface();
  };

  // --- selection helpers ------------------------------------------------
  // Explorer renames on a slow second click. The timer is cancelled by any
  // other click, so it can never rename something no longer selected.
  const renameTimer = useRef(0);
  const cancelSlowRename = () => {
    window.clearTimeout(renameTimer.current);
    renameTimer.current = 0;
  };

  const selectOnly = (item: ResourceItem) => {
    setSelected(new Set([item.id]));
    setAnchorId(item.id);
    setFocusId(item.id);
  };
  const selectRange = (to: ResourceItem, additive: boolean) => {
    const from = visible.findIndex((i) => i.id === (anchorId ?? to.id));
    const end = visible.findIndex((i) => i.id === to.id);
    const [a, b] = from < 0 ? [end, end] : [Math.min(from, end), Math.max(from, end)];
    const range = visible.slice(a, b + 1).map((i) => i.id);
    setSelected((s) => new Set([...(additive ? s : []), ...range]));
    setFocusId(to.id);
  };
  const selectAll = () => {
    setSelected(new Set(visible.map((i) => i.id)));
    setFocusId((f) => f ?? visible[0]?.id ?? null);
  };
  const invertSelection = () => setSelected((s) => new Set(visible.filter((i) => !s.has(i.id)).map((i) => i.id)));

  const scrollToItem = (id: string) =>
    requestAnimationFrame(() => document.getElementById(itemDomId(id))?.scrollIntoView({ block: "nearest", inline: "nearest" }));

  // --- context menu -----------------------------------------------------
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; entries: MenuEntry[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const backgroundEntries = (): MenuEntry[] => {
    const e: MenuEntry[] = [];
    e.push({ kind: "item", label: "Refresh", icon: <RotateCw />, shortcut: "F5", onSelect: refresh });
    if (canWrite) {
      e.push({ kind: "item", label: "Paste", icon: <ClipboardPaste />, shortcut: "Ctrl+V", disabled: cutIds.length === 0, onSelect: () => void paste() });
      e.push({ kind: "separator" });
      e.push({ kind: "item", label: "New folder", icon: <FolderPlus />, shortcut: "Ctrl+Shift+N", onSelect: () => void newFolder() });
      e.push({ kind: "item", label: "Upload files", icon: <Upload />, onSelect: pickFiles });
      e.push({ kind: "item", label: "New web link", icon: <Link2 />, onSelect: () => setDialog({ kind: "link" }) });
    }
    e.push({ kind: "separator" });
    e.push({ kind: "item", label: "Select all", icon: <SquareDashedMousePointer />, shortcut: "Ctrl+A", onSelect: selectAll });
    if (hasDisk) e.push({ kind: "item", label: "Show in Explorer", icon: <FolderSymlink />, onSelect: () => void showInExplorer(null) });
    e.push({ kind: "item", label: "Properties", icon: <Info />, shortcut: "Alt+Enter", onSelect: () => setDetailsOpen(true) });
    return e;
  };

  const itemEntries = (list: ResourceItem[]): MenuEntry[] => {
    const one = list.length === 1 ? list[0] : null;
    const editable = list.filter((i) => !isImplied(i));
    const e: MenuEntry[] = [];
    if (one) {
      e.push({
        kind: "item",
        label: one.type === "LINK" ? "Open link" : "Open",
        icon: one.type === "FOLDER" ? <FolderOpen /> : <ExternalLink />,
        shortcut: "Enter",
        onSelect: () => openItem(one),
      });
      if (hasDisk && (one.type === "FOLDER" || one.inLibrary)) {
        e.push({ kind: "item", label: one.type === "FOLDER" ? "Open in Windows Explorer" : "Show in Explorer", icon: <FolderSymlink />, onSelect: () => void showInExplorer(one) });
      }
      if (one.type === "FOLDER" && canWrite && cutIds.length > 0) {
        e.push({ kind: "item", label: "Paste into folder", icon: <ClipboardPaste />, onSelect: () => void paste(pathOf(one)) });
      }
      e.push({ kind: "separator" });
    }
    if (canWrite && editable.length) {
      e.push({ kind: "item", label: "Cut", icon: <Scissors />, shortcut: "Ctrl+X", onSelect: cut });
    }
    if (one && one.type === "LINK") {
      e.push({ kind: "item", label: "Copy link address", icon: <Copy />, onSelect: () => void copyText(one.url, "Link") });
    } else if (one && hasDisk && absolutePathOf(one)) {
      e.push({ kind: "item", label: "Copy as path", icon: <Copy />, shortcut: "Ctrl+Shift+C", onSelect: () => void copyText(`"${absolutePathOf(one)}"`, "Path") });
    }
    if (canWrite && editable.length) {
      e.push({ kind: "separator" });
      if (one && !isImplied(one)) e.push({ kind: "item", label: "Rename", icon: <Pencil />, shortcut: "F2", onSelect: () => startRename(one) });
      e.push({ kind: "item", label: "Move to…", icon: <FolderSymlink />, onSelect: () => setDialog({ kind: "move", items: editable }) });
      e.push({ kind: "item", label: editable.length > 1 ? `Delete ${editable.length} items` : "Delete", icon: <Trash2 />, shortcut: "Del", danger: true, onSelect: () => setDialog({ kind: "delete", items: editable }) });
    }
    e.push({ kind: "separator" });
    e.push({ kind: "item", label: "Properties", icon: <Info />, shortcut: "Alt+Enter", onSelect: () => setDetailsOpen(true) });
    // Tidy separators left dangling by skipped groups.
    return e.filter((x, i, all) => x.kind !== "separator" || (i > 0 && i < all.length - 1 && all[i - 1].kind !== "separator"));
  };

  // --- keyboard ---------------------------------------------------------
  const typeahead = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const searchBox = useRef<HTMLInputElement>(null);

  const neighbour = (from: ResourceItem, key: string): ResourceItem | null => {
    const index = visible.indexOf(from);
    const axis = flowAxis(view);
    const along =
      (axis === "row" && (key === "ArrowLeft" || key === "ArrowRight")) ||
      (axis !== "row" && (key === "ArrowUp" || key === "ArrowDown"));
    if (along) {
      const step = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
      return visible[index + step] ?? null;
    }
    if (axis === "single") return null;
    // Across the flow: the nearest item in that direction, by position.
    const el = document.getElementById(itemDomId(from.id));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best: { item: ResourceItem; score: number } | null = null;
    for (const item of visible) {
      if (item === from) continue;
      const other = document.getElementById(itemDomId(item.id))?.getBoundingClientRect();
      if (!other) continue;
      const ox = other.left + other.width / 2;
      const oy = other.top + other.height / 2;
      const dx = ox - cx;
      const dy = oy - cy;
      const ok =
        (key === "ArrowDown" && dy > r.height / 2) ||
        (key === "ArrowUp" && dy < -r.height / 2) ||
        (key === "ArrowRight" && dx > r.width / 2) ||
        (key === "ArrowLeft" && dx < -r.width / 2);
      if (!ok) continue;
      const primary = key === "ArrowUp" || key === "ArrowDown" ? Math.abs(dy) : Math.abs(dx);
      const secondary = key === "ArrowUp" || key === "ArrowDown" ? Math.abs(dx) : Math.abs(dy);
      const score = primary * 1000 + secondary;
      if (!best || score < best.score) best = { item, score };
    }
    return best?.item ?? null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    const ctrl = e.ctrlKey || e.metaKey;
    const focused = focusId ? visible.find((i) => i.id === focusId) ?? null : null;
    const handled = () => e.preventDefault();
    const act = (fn: () => unknown) => {
      e.preventDefault();
      fn();
    };

    if (e.altKey && e.key === "ArrowLeft") return act(() => back());
    if (e.altKey && e.key === "ArrowRight") return act(() => forward());
    if (e.altKey && e.key === "ArrowUp") return act(() => up());
    if (e.altKey && e.key === "Enter") return act(() => setDetailsOpen(true));
    if (e.key === "Backspace") return act(() => up());
    if (e.key === "F5") return act(() => refresh());
    if (ctrl && (e.key === "f" || e.key === "e")) return act(() => searchBox.current?.focus());
    if (ctrl && e.shiftKey && (e.key === "N" || e.key === "n")) return act(() => newFolder());
    if (ctrl && e.shiftKey && /^Digit[1-7]$/.test(e.code)) {
      const views: ExplorerView[] = ["xl", "large", "medium", "small", "list", "details", "tiles"];
      return act(() => setView(views[Number(e.code.slice(5)) - 1]));
    }
    if (ctrl && e.shiftKey && (e.key === "C" || e.key === "c") && single) {
      const abs = absolutePathOf(single);
      if (abs) return act(() => copyText(`"${abs}"`, "Path"));
    }
    if (ctrl && (e.key === "a" || e.key === "A")) return act(() => selectAll());
    if (ctrl && (e.key === "x" || e.key === "X")) return act(() => cut());
    if (ctrl && (e.key === "v" || e.key === "V")) return act(() => paste());
    if (e.key === "Escape") {
      if (cutIds.length) setCutIds([]);
      return setSelected(new Set());
    }
    if (e.key === "F2") return act(() => startRename(single ?? focused));
    if (e.key === "Delete" && canWrite && writable.length) return act(() => setDialog({ kind: "delete", items: writable }));
    if (e.key === "Enter") {
      handled();
      const target = single ?? focused;
      if (target) openItem(target);
      return;
    }

    if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
      handled();
      if (visible.length === 0) return;
      let next: ResourceItem | null;
      if (e.key === "Home") next = visible[0];
      else if (e.key === "End") next = visible[visible.length - 1];
      else next = focused ? neighbour(focused, e.key) : visible[0];
      if (!next) return;
      if (e.shiftKey) selectRange(next, ctrl);
      else if (ctrl) setFocusId(next.id);
      else selectOnly(next);
      scrollToItem(next.id);
      return;
    }
    if (e.key === " " && focused) {
      handled();
      if (ctrl) setSelected((s) => {
        const n = new Set(s);
        if (n.has(focused.id)) n.delete(focused.id);
        else n.add(focused.id);
        return n;
      });
      else selectOnly(focused);
      return;
    }

    // Type to jump: letters typed quickly form a prefix; the same letter
    // repeated cycles through the items starting with it.
    if (e.key.length === 1 && !ctrl && !e.altKey && e.key !== " ") {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 800 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const cycling = t.text.length > 1 && [...t.text].every((c) => c === t.text[0]);
      const prefix = cycling ? t.text[0] : t.text;
      const start = focused ? visible.indexOf(focused) + (cycling || t.text.length === 1 ? 1 : 0) : 0;
      const ordered = [...visible.slice(start), ...visible.slice(0, start)];
      const hit = ordered.find((i) => displayName(i).toLowerCase().startsWith(prefix));
      if (hit) {
        selectOnly(hit);
        scrollToItem(hit.id);
      }
    }
  };

  // --- drag and drop ----------------------------------------------------
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [osDrag, setOsDrag] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const hasItems = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes(DRAG_TYPE);

  const dropProps = (target: string): DropHandlers => ({
    onDragOver: (e) => {
      if (!canWrite || !(hasFiles(e) || hasItems(e))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "move";
      if (dropTarget !== target) setDropTarget(target);
    },
    onDragLeave: (e) => {
      if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
      if (dropTarget === target) setDropTarget(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setOsDrag(false);
      setDropTarget(null);
      if (!canWrite) return;
      if (hasFiles(e)) return void uploadFiles(e.dataTransfer.files, target);
      try {
        const ids = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as string[];
        if (Array.isArray(ids)) void moveMany(ids, target);
      } catch {
        // Not ours.
      }
    },
  });

  // --- rubber-band selection --------------------------------------------
  const scroller = useRef<HTMLDivElement>(null);
  const [band, setBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const onScrollerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-id]")) return;
    cancelSlowRename();
    const box = scroller.current;
    if (!box) return;
    surface.current?.focus({ preventScroll: true });
    setRenamingId(null);
    const origin = box.getBoundingClientRect();
    const toContent = (cx: number, cy: number) => ({ x: cx - origin.left + box.scrollLeft, y: cy - origin.top + box.scrollTop });
    const start = toContent(e.clientX, e.clientY);
    const additive = e.ctrlKey || e.metaKey;
    const base = additive ? new Set(selected) : new Set<string>();
    let moved = false;

    const move = (ev: PointerEvent) => {
      const now = toContent(ev.clientX, ev.clientY);
      if (!moved && Math.hypot(now.x - start.x, now.y - start.y) < 4) return;
      moved = true;
      const rect = { x: Math.min(start.x, now.x), y: Math.min(start.y, now.y), w: Math.abs(now.x - start.x), h: Math.abs(now.y - start.y) };
      setBand(rect);
      const hits = new Set(base);
      for (const el of box.querySelectorAll<HTMLElement>("[data-id]")) {
        const r = el.getBoundingClientRect();
        const a = toContent(r.left, r.top);
        const overlaps = a.x < rect.x + rect.w && a.x + r.width > rect.x && a.y < rect.y + rect.h && a.y + r.height > rect.y;
        if (overlaps && el.dataset.id) hits.add(el.dataset.id);
      }
      setSelected(hits);
    };
    const upHandler = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", upHandler);
      setBand(null);
      if (!moved && !additive) {
        setSelected(new Set());
        setAnchorId(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upHandler);
  };

  // --- per-item wiring --------------------------------------------------
  const stateOf = (item: ResourceItem): ItemState => ({
    selected: selected.has(item.id),
    focused: focusId === item.id,
    cut: cutIds.includes(item.id),
    dropTarget: item.type === "FOLDER" && dropTarget !== null && sameFolder(dropTarget, pathOf(item)),
    renaming: renamingId === item.id,
  });

  const itemProps = (item: ResourceItem) => ({
    draggable: canWrite && !isImplied(item) && renamingId !== item.id,
    onDragStart: (e: React.DragEvent) => {
      const ids = selected.has(item.id) ? writable.map((i) => i.id) : [item.id];
      if (!selected.has(item.id)) selectOnly(item);
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
      e.dataTransfer.effectAllowed = "move";
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      cancelSlowRename();
      surface.current?.focus({ preventScroll: true });
      if (e.shiftKey) return selectRange(item, e.ctrlKey || e.metaKey);
      if (e.ctrlKey || e.metaKey) {
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(item.id)) n.delete(item.id);
          else n.add(item.id);
          return n;
        });
        setAnchorId(item.id);
        setFocusId(item.id);
        return;
      }
      // A second click on the only selected item renames it, as in Explorer.
      if (single?.id === item.id && renamingId !== item.id && canWrite && !isImplied(item) && e.detail === 1) {
        renameTimer.current = window.setTimeout(() => {
          renameTimer.current = 0;
          startRename(item);
        }, 550);
        return;
      }
      selectOnly(item);
    },
    onDoubleClick: () => {
      cancelSlowRename();
      openItem(item);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const list = selected.has(item.id) ? selectedItems : [item];
      if (!selected.has(item.id)) selectOnly(item);
      setMenu({ at: { x: e.clientX, y: e.clientY }, entries: itemEntries(list) });
    },
    ...(item.type === "FOLDER" ? dropProps(pathOf(item)) : {}),
  });
  // --- derived labels ---------------------------------------------------
  const currentLabel = path ? folderName(path) : library.subject;
  const selectedBytes = selectedItems.reduce((n, i) => n + (i.type === "FILE" ? i.size ?? 0 : 0), 0);
  const childCount = (folder: ResourceItem) => items.filter((i) => !isImplied(i) && sameFolder(i.folder, pathOf(folder))).length;
  const canLoad = (item: ResourceItem) => !(item.type === "FILE" && item.inLibrary && !onDesktop);

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:[color-scheme:dark] md:h-[calc(100dvh-6rem)]">
      {/* ---------------------------------------------------------- tab strip */}
      <div className="flex h-10 shrink-0 items-end gap-2 border-b border-border bg-muted/40 px-2">
        <div className="flex h-8 max-w-xs min-w-0 items-center gap-2 rounded-t-lg border border-b-0 border-border bg-card px-3 text-[13px]">
          <KindGlyph item={{ type: "FOLDER", ext: "" }} px={16} />
          <span className="truncate font-medium">{query ? `Search results in ${currentLabel}` : currentLabel}</span>
        </div>
      </div>

      {/* ------------------------------------------------ toolbar + address */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-2 py-1.5 sm:flex-nowrap">
        <ToolButton label="Back (Alt+Left)" onClick={back} disabled={history.at === 0}>
          <ArrowLeft />
        </ToolButton>
        <ToolButton label="Forward (Alt+Right)" onClick={forward} disabled={history.at >= history.stack.length - 1}>
          <ArrowRight />
        </ToolButton>
        <ToolButton label="Up to parent folder (Alt+Up)" onClick={up} disabled={!path}>
          <ArrowUp />
        </ToolButton>
        <ToolButton label="Refresh (F5)" onClick={refresh}>
          <RotateCw className={cn(pending && "animate-spin")} />
        </ToolButton>
        <div className="ml-1 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 sm:flex-nowrap">
          <AddressBar
            subject={library.subject}
            subjects={library.subjects}
            folders={folderPaths}
            path={path}
            absolutePath={library.folderPath ? folderAbsolutePath(library.folderPath, path) : null}
            dropTarget={dropTarget}
            dropProps={dropProps}
            onNavigate={go}
            onNavigateSubject={openSubject}
            onNotFound={(typed) => toast.error(`Can't find “${typed}”.`, { description: "Check the spelling and try again." })}
          />
          <div className="relative w-full shrink-0 sm:w-56 lg:w-72">
            <input
              ref={searchBox}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(new Set());
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  surface.current?.focus();
                }
                if (e.key === "Enter" || e.key === "ArrowDown") {
                  e.preventDefault();
                  surface.current?.focus();
                  if (visible[0]) selectOnly(visible[0]);
                }
              }}
              placeholder={`Search ${currentLabel}`}
              aria-label={`Search ${currentLabel}`}
              className="h-8 w-full rounded-md border border-border bg-background pl-2.5 pr-8 text-[13px] outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/25 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : (
              <Search className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- command bar */}
      <div role="toolbar" aria-label="Commands" className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-y border-border px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {canWrite && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <CommandButton label="New" icon={<Plus className="text-primary" />} withLabel caret />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => void newFolder()}>
                  <FolderPlus className="text-amber-500" /> Folder
                  <Shortcut>Ctrl+Shift+N</Shortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog({ kind: "link" })}>
                  <Link2 className="text-sky-500" /> Web link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={pickFiles}>
                  <Upload /> Upload files…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CommandButton label="Upload" icon={<Upload />} withLabel onClick={pickFiles} />
            <Divider />
            <CommandButton label="Cut (Ctrl+X)" icon={<Scissors />} onClick={cut} disabled={writable.length === 0} />
            <CommandButton label="Paste (Ctrl+V)" icon={<ClipboardPaste />} onClick={() => void paste()} disabled={cutIds.length === 0} />
            <CommandButton label="Rename (F2)" icon={<Pencil />} onClick={() => startRename(single)} disabled={!single || isImplied(single)} />
            <CommandButton
              label="Copy link or path"
              icon={<Copy />}
              onClick={() => {
                if (!single) return;
                if (single.type === "LINK") return void copyText(single.url, "Link");
                const abs = absolutePathOf(single);
                if (abs) void copyText(`"${abs}"`, "Path");
              }}
              disabled={!single || (single.type !== "LINK" && !(hasDisk && absolutePathOf(single)))}
            />
            <CommandButton label="Delete (Del)" icon={<Trash2 />} onClick={() => setDialog({ kind: "delete", items: writable })} disabled={writable.length === 0} />
            <Divider />
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CommandButton label="Sort" icon={<ArrowDownUp />} withLabel caret />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {(["name", "modified", "kind", "size", ...(query ? (["folder"] as SortKey[]) : [])] as SortKey[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => setSort((s) => ({ key: k, dir: s.dir }))}>
                <Tick on={sort.key === k} /> {SORT_LABEL[k]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSort((s) => ({ ...s, dir: 1 }))}>
              <Tick on={sort.dir === 1} /> Ascending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort((s) => ({ ...s, dir: -1 }))}>
              <Tick on={sort.dir === -1} /> Descending
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CommandButton label="View" icon={<LayoutGrid />} withLabel caret />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {(Object.keys(VIEW_LABEL) as ExplorerView[]).map((v) => (
              <DropdownMenuItem key={v} onClick={() => setView(v)}>
                <Tick on={view === v} /> {VIEW_LABEL[v]}
                <Shortcut>{VIEW_SHORTCUT[v]}</Shortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Show</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setNavOpen(!navOpen)}>
              <Tick on={navOpen} /> Navigation pane
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDetailsOpen(!detailsOpen)}>
              <Tick on={detailsOpen} /> Details pane
              <Shortcut>Alt+Enter</Shortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CommandButton label="See more" icon={<MoreHorizontal />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={selectAll}>
              Select all <Shortcut>Ctrl+A</Shortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelected(new Set())}>
              Select none <Shortcut>Esc</Shortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={invertSelection}>Invert selection</DropdownMenuItem>
            {canWrite && writable.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDialog({ kind: "move", items: writable })}>
                  <FolderSymlink /> Move to…
                </DropdownMenuItem>
              </>
            )}
            {hasDisk && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void showInExplorer(null)}>
                  <FolderSymlink /> Open in Windows Explorer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-0.5 pl-2">
          <CommandButton
            label="Navigation pane"
            icon={<PanelLeft />}
            onClick={() => setNavOpen(!navOpen)}
            pressed={navOpen}
            className="hidden md:inline-flex"
          />
          <CommandButton label="Details" icon={<PanelRight />} withLabel onClick={() => setDetailsOpen(!detailsOpen)} pressed={detailsOpen} className="hidden lg:inline-flex" />
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          aria-label="Upload files"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* ------------------------------------------------------------ body */}
      <div className="flex min-h-0 flex-1">
        {navOpen && (
          <div className="hidden w-60 shrink-0 border-r border-border md:block">
            <NavPane
              subject={library.subject}
              subjects={library.subjects}
              folders={folderPaths}
              path={path}
              dropTarget={dropTarget}
              dropProps={dropProps}
              onNavigate={go}
            />
          </div>
        )}

        <div
          ref={surface}
          tabIndex={0}
          role="listbox"
          aria-multiselectable
          aria-label={query ? `Search results in ${currentLabel}` : `Items in ${currentLabel}`}
          aria-activedescendant={focusId && visible.some((i) => i.id === focusId) ? itemDomId(focusId) : undefined}
          onKeyDown={(e) => {
            cancelSlowRename();
            onKeyDown(e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setSelected(new Set());
            setMenu({ at: { x: e.clientX, y: e.clientY }, entries: backgroundEntries() });
          }}
          onDragEnter={(e) => {
            if (!canWrite || !hasFiles(e)) return;
            dragDepth.current++;
            setOsDrag(true);
          }}
          onDragOver={(e) => {
            if (!canWrite || !(hasFiles(e) || hasItems(e))) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "move";
            // Over empty space the drop lands in the open folder, not the
            // last folder the pointer crossed.
            if (dropTarget !== null) setDropTarget(null);
          }}
          onDragLeave={() => {
            if (!osDrag) return;
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setOsDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setOsDrag(false);
            setDropTarget(null);
            if (canWrite && hasFiles(e)) void uploadFiles(e.dataTransfer.files, path);
          }}
          className="relative min-w-0 flex-1 outline-none"
        >
          <div ref={scroller} onPointerDown={onScrollerPointerDown} className="absolute inset-0 overflow-auto">
            {visible.length === 0 ? (
              <p className="pt-10 text-center text-[13px] text-muted-foreground">
                {query ? "No items match your search." : "This folder is empty."}
                {!query && canWrite && (
                  <span className="mt-1 block text-xs">Drop files here, or use New and Upload above.</span>
                )}
              </p>
            ) : (
              <ExplorerItems
                view={view}
                items={visible}
                stateOf={stateOf}
                itemProps={itemProps}
                canLoad={canLoad}
                showLocation={!!query}
                sort={sort}
                onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k ? ((s.dir * -1) as 1 | -1) : k === "modified" ? -1 : 1 }))}
                columns={columns}
                onColumns={(c) => setColumnsRaw(JSON.stringify(c))}
                subject={library.subject}
                renameBox={(item, className) => (
                  <RenameBox
                    item={item}
                    className={className}
                    onCommit={(name) => commitRename(item, name)}
                    onCancel={() => {
                      setRenamingId(null);
                      focusSurface();
                    }}
                  />
                )}
              />
            )}
            {band && (
              <div
                aria-hidden
                className="pointer-events-none absolute z-20 border border-primary/70 bg-primary/15"
                style={{ left: band.x, top: band.y, width: band.w, height: band.h }}
              />
            )}
          </div>

          {osDrag && (
            <div className="pointer-events-none absolute inset-1 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/75 backdrop-blur-[1px]">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Upload className="size-4" /> Copy to {dropTarget ? folderName(dropTarget) : currentLabel}
              </p>
            </div>
          )}
        </div>

        {detailsOpen && (
          <aside aria-label="Details pane" className="hidden w-80 shrink-0 overflow-y-auto border-l border-border lg:block xl:w-96">
            {single ? (
              <ItemDetails
                item={single}
                subject={library.subject}
                childCount={single.type === "FOLDER" ? childCount(single) : undefined}
                canWrite={canWrite && !isImplied(single)}
                onDesktop={hasDisk}
                onOpen={() => openItem(single)}
                onOpenFolder={() => void showInExplorer(single)}
                onReveal={() => void showInExplorer(single)}
                onRename={() => startRename(single)}
                onMove={() => setDialog({ kind: "move", items: [single] })}
                onDelete={() => setDialog({ kind: "delete", items: [single] })}
                onNavigate={go}
              />
            ) : (
              <SelectionSummary
                label={selectedItems.length ? `${selectedItems.length} items selected` : query ? `Search results in ${currentLabel}` : currentLabel}
                items={selectedItems.length ? selectedItems : visible.filter((i) => !isImplied(i))}
                isFolder={selectedItems.length === 0}
                absolutePath={library.folderPath && !query ? folderAbsolutePath(library.folderPath, path) : null}
              />
            )}
          </aside>
        )}
      </div>

      {/* ------------------------------------------------------- status bar */}
      <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border px-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {visible.length} {visible.length === 1 ? "item" : "items"}
        </span>
        {selectedItems.length > 0 && (
          <>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="tabular-nums">
              {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"} selected
              {selectedBytes > 0 ? `  ${formatBytes(selectedBytes)}` : ""}
            </span>
          </>
        )}
        {cutIds.length > 0 && (
          <>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>
              {cutIds.length} to move — paste in the destination
            </span>
          </>
        )}
        {library.archived && (
          <>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>Archived year: read-only</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <StatusToggle label="Details" active={view === "details"} onClick={() => setView("details")}>
            <ListIcon />
          </StatusToggle>
          <StatusToggle label="Large icons" active={view === "large"} onClick={() => setView("large")}>
            <LayoutGrid />
          </StatusToggle>
        </div>
      </div>

      {/* ------------------------------------------------------- overlays */}
      <ContextMenu at={menu?.at ?? null} entries={menu?.entries ?? []} onClose={closeMenu} />

      {dialog?.kind === "move" && (
        <MoveDialog
          open
          subject={library.subject}
          folders={folderPaths}
          itemLabel={dialog.items.length === 1 ? displayName(dialog.items[0]) : `${dialog.items.length} items`}
          currentFolder={dialog.items.every((i) => sameFolder(i.folder, dialog.items[0].folder)) ? dialog.items[0].folder : null}
          ownPaths={dialog.items.filter((i) => i.type === "FOLDER").map(pathOf)}
          onClose={close}
          onSubmit={(target) => moveMany(dialog.items.map((i) => i.id), target)}
        />
      )}

      {dialog?.kind === "link" && (
        <LinkDialog
          open
          folderLabel={currentLabel}
          onClose={close}
          onSubmit={async ({ title, url }) => {
            const r = await addResourceLink(library.subject, path, title, url);
            if (!r.success) return r.error ?? "Something went wrong.";
            toast.success("Link added");
            refresh();
            return null;
          }}
        />
      )}

      <ConfirmModal
        isOpen={dialog?.kind === "delete"}
        onClose={close}
        isPending={pending}
        title={
          dialog?.kind === "delete"
            ? dialog.items.length === 1
              ? `Delete “${displayName(dialog.items[0])}”?`
              : `Delete these ${dialog.items.length} items?`
            : ""
        }
        description={dialog?.kind === "delete" ? deleteWarning(dialog.items, !!library.folderPath, childCount) : ""}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          const list = dialog.items;
          close();
          await deleteMany(list);
        }}
      />
    </div>
  );
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

const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  modified: "Date modified",
  kind: "Type",
  size: "Size",
  folder: "Folder",
};

// ------------------------------------------------------------------ pieces

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

type CommandButtonProps = {
  label: string;
  icon: React.ReactNode;
  withLabel?: boolean;
  caret?: boolean;
  pressed?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** A command-bar button. Forwards props so it can be a dropdown trigger. */
function CommandButton({ label, icon, withLabel, caret, pressed, className, ...rest }: CommandButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={withLabel ? undefined : label}
      aria-pressed={pressed}
      {...rest}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent data-[state=open]:bg-muted [&_svg]:size-4",
        pressed && "bg-muted",
        className
      )}
    >
      {icon}
      {withLabel && <span className="hidden sm:inline">{label}</span>}
      {caret && <ChevronDownSmall />}
    </button>
  );
}

function ChevronDownSmall() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className="!size-2.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3.5 5 6.5 8 3.5" />
    </svg>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function Tick({ on }: { on: boolean }) {
  return <Check className={cn("size-4", !on && "invisible")} />;
}

function Shortcut({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto pl-4 text-[11px] text-muted-foreground">{children}</span>;
}

function StatusToggle({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("flex size-6 items-center justify-center rounded-sm transition-colors hover:bg-muted [&_svg]:size-3.5", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}

/** The details pane with nothing, or several things, selected. */
function SelectionSummary({
  label,
  items,
  isFolder,
  absolutePath,
}: {
  label: string;
  items: ResourceItem[];
  isFolder: boolean;
  absolutePath: string | null;
}) {
  const files = items.filter((i) => i.type === "FILE");
  const bytes = files.reduce((n, f) => n + (f.size ?? 0), 0);
  const kinds = new Map<string, number>();
  for (const i of items) {
    const k = i.type === "FOLDER" ? "File folder" : kindLabel(i);
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col items-center px-5 py-8 text-center">
      <KindGlyph item={{ type: "FOLDER", ext: "" }} px={96} />
      <h3 className="mt-3 break-words font-heading text-base font-semibold">{label}</h3>
      <p className="text-xs text-muted-foreground">
        {isFolder ? `${items.length} ${items.length === 1 ? "item" : "items"}` : "Select a single item to preview it"}
      </p>

      {kinds.size > 0 && (
        <dl className="mt-6 w-full space-y-1.5 border-t border-border pt-4 text-left text-xs">
          {[...kinds.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular-nums">{n}</dd>
              </div>
            ))}
          {bytes > 0 && (
            <div className="flex justify-between gap-2 border-t border-border pt-1.5">
              <dt className="text-muted-foreground">Size</dt>
              <dd className="tabular-nums">{formatBytes(bytes)}</dd>
            </div>
          )}
        </dl>
      )}

      {isFolder && absolutePath && (
        <div className="mt-4 w-full rounded-md bg-muted/50 p-3 text-left">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed">{absolutePath}</p>
        </div>
      )}
    </div>
  );
}
