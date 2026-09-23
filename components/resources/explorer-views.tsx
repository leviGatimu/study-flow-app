"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResourceItem } from "@/lib/library-actions";
import { displayName, formatBytes, formatStamp, hostOf, KindGlyph, kindLabel, kindOf } from "./file-kind";

/**
 * The content area of the explorer, in each of Explorer's layouts.
 *
 * The views only draw. Selection, focus, clicks, drags and the keyboard are
 * owned by SubjectExplorer and arrive through `itemProps`, so every layout
 * behaves identically and switching views never loses the selection.
 */

export type ExplorerView = "xl" | "large" | "medium" | "small" | "list" | "details" | "tiles";

export const VIEW_LABEL: Record<ExplorerView, string> = {
  xl: "Extra large icons",
  large: "Large icons",
  medium: "Medium icons",
  small: "Small icons",
  list: "List",
  details: "Details",
  tiles: "Tiles",
};

export const VIEW_SHORTCUT: Record<ExplorerView, string> = {
  xl: "Ctrl+Shift+1",
  large: "Ctrl+Shift+2",
  medium: "Ctrl+Shift+3",
  small: "Ctrl+Shift+4",
  list: "Ctrl+Shift+5",
  details: "Ctrl+Shift+6",
  tiles: "Ctrl+Shift+7",
};

export const parseView = (raw: string): ExplorerView | null => (raw in VIEW_LABEL ? (raw as ExplorerView) : null);

/**
 * Which arrow keys walk the item order, and which move across it. Row-flowing
 * layouts step with Left/Right; List flows down its columns, so Up/Down step
 * and Left/Right jump to the neighbouring column; Details is a single column.
 */
export function flowAxis(view: ExplorerView): "row" | "column" | "single" {
  if (view === "details") return "single";
  if (view === "list") return "column";
  return "row";
}

export type SortKey = "name" | "modified" | "kind" | "size" | "folder";
export type Sort = { key: SortKey; dir: 1 | -1 };

export type Columns = { name: number; modified: number; kind: number; size: number; folder: number };
export const DEFAULT_COLUMNS: Columns = { name: 300, modified: 160, kind: 140, size: 90, folder: 200 };

export type ItemState = {
  selected: boolean;
  focused: boolean;
  cut: boolean;
  dropTarget: boolean;
  renaming: boolean;
};

export const itemDomId = (id: string) => `explorer-item-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

type Shared = {
  items: ResourceItem[];
  stateOf: (item: ResourceItem) => ItemState;
  itemProps: (item: ResourceItem) => React.HTMLAttributes<HTMLElement> & { draggable?: boolean };
  /** Whether this client can load the file's bytes (a thumbnail, a preview). */
  canLoad: (item: ResourceItem) => boolean;
  renameBox: (item: ResourceItem, className?: string) => React.ReactNode;
};

export function ExplorerItems({
  view,
  showLocation,
  sort,
  onSort,
  columns,
  onColumns,
  subject,
  ...shared
}: Shared & {
  view: ExplorerView;
  showLocation: boolean;
  sort: Sort;
  onSort: (key: SortKey) => void;
  columns: Columns;
  onColumns: (next: Columns) => void;
  subject: string;
}) {
  if (view === "details") {
    return (
      <DetailsView
        {...shared}
        showLocation={showLocation}
        sort={sort}
        onSort={onSort}
        columns={columns}
        onColumns={onColumns}
        subject={subject}
      />
    );
  }
  if (view === "list") return <ListView {...shared} />;
  if (view === "tiles") return <TilesView {...shared} showLocation={showLocation} />;
  if (view === "small") return <SmallIconsView {...shared} />;
  return <IconsView {...shared} size={view} />;
}

/** Explorer's row and tile colours: hover, selected, focused, cut, drop. */
function surface(state: ItemState, extra?: string) {
  return cn(
    "relative select-none outline-none transition-colors",
    state.selected ? "bg-primary/15 hover:bg-primary/20" : "hover:bg-muted/70",
    state.focused && "ring-1 ring-inset ring-primary/50",
    state.cut && "opacity-50",
    state.dropTarget && "bg-primary/25 ring-1 ring-inset ring-primary",
    extra
  );
}

function common(item: ResourceItem, state: ItemState, props: React.HTMLAttributes<HTMLElement>) {
  return {
    ...props,
    id: itemDomId(item.id),
    "data-id": item.id,
    role: "option" as const,
    "aria-selected": state.selected,
    title: state.renaming ? undefined : item.title,
  };
}

// ------------------------------------------------------------------ details

const COLUMN_LABEL: Record<SortKey, string> = {
  name: "Name",
  modified: "Date modified",
  kind: "Type",
  size: "Size",
  folder: "Folder",
};

function DetailsView({
  items,
  stateOf,
  itemProps,
  renameBox,
  showLocation,
  sort,
  onSort,
  columns,
  onColumns,
  subject,
}: Shared & {
  showLocation: boolean;
  sort: Sort;
  onSort: (key: SortKey) => void;
  columns: Columns;
  onColumns: (next: Columns) => void;
  subject: string;
}) {
  // While a divider is dragged the widths live here and are stored once, on
  // release - not on every pointer move.
  const [live, setLive] = useState<Columns | null>(null);
  const widths = live ?? columns;
  const keys: SortKey[] = showLocation ? ["name", "folder", "modified", "kind", "size"] : ["name", "modified", "kind", "size"];
  const template = keys.map((k) => `${widths[k]}px`).join(" ");
  const total = keys.reduce((n, k) => n + widths[k], 0);

  const startResize = (key: SortKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key];
    let latest = widths;
    const move = (ev: PointerEvent) => {
      latest = { ...widths, [key]: Math.max(60, Math.min(900, startW + ev.clientX - startX)) };
      setLive(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      onColumns(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="min-w-full text-[13px]" style={{ width: total + 16 }}>
      <div
        className="sticky top-0 z-10 grid border-b border-border bg-card/95 px-2 backdrop-blur"
        style={{ gridTemplateColumns: template }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {keys.map((k) => (
          <div key={k} className="relative">
            <button
              type="button"
              onClick={() => onSort(k)}
              aria-label={`Sort by ${COLUMN_LABEL[k]}${sort.key === k ? (sort.dir === 1 ? ", ascending" : ", descending") : ""}`}
              className={cn(
                "flex h-8 w-full items-center gap-1 truncate px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                k === "size" && "justify-end"
              )}
            >
              {sort.key === k && k === "size" && <SortCaret dir={sort.dir} />}
              <span className="truncate">{COLUMN_LABEL[k]}</span>
              {sort.key === k && k !== "size" && <SortCaret dir={sort.dir} />}
            </button>
            <span
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${COLUMN_LABEL[k]} column`}
              onPointerDown={(e) => startResize(k, e)}
              onDoubleClick={() => onColumns({ ...columns, [k]: DEFAULT_COLUMNS[k] })}
              className="absolute -right-1 top-1.5 z-10 h-5 w-2 cursor-col-resize after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-border hover:after:bg-primary"
            />
          </div>
        ))}
      </div>

      <div role="presentation" className="px-2 py-1">
        {items.map((item) => {
          const state = stateOf(item);
          return (
            <div
              key={item.id}
              {...common(item, state, itemProps(item))}
              className={surface(state, "grid h-8 items-center rounded-sm")}
              style={{ gridTemplateColumns: template }}
            >
              <div className="flex min-w-0 items-center gap-2 px-2">
                <KindGlyph item={item} px={16} />
                {state.renaming ? renameBox(item, "h-6 flex-1 text-[13px]") : <span className="truncate text-foreground">{displayName(item)}</span>}
              </div>
              {showLocation && (
                <div className="truncate px-2 text-muted-foreground">
                  {item.folder ? `${subject} › ${item.folder.replace(/\//g, " › ")}` : subject}
                </div>
              )}
              <div className="truncate px-2 tabular-nums text-muted-foreground" suppressHydrationWarning>
                {formatStamp(item.updatedAt)}
              </div>
              <div className="truncate px-2 text-muted-foreground">
                {item.type === "LINK" ? `Web link (${hostOf(item.url)})` : item.type === "FOLDER" ? "File folder" : kindLabel(item)}
              </div>
              <div className="truncate px-2 text-right tabular-nums text-muted-foreground">
                {item.type === "FILE" ? formatSize(item.size) : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortCaret({ dir }: { dir: 1 | -1 }) {
  return dir === 1 ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />;
}

/** Explorer's Size column is always kilobytes: "1 KB", "2,480 KB". */
function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  return `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString()} KB`;
}

// --------------------------------------------------------------------- list

/** Small icons flowing down columns, like Explorer's List. */
function ListView({ items, stateOf, itemProps, renameBox }: Shared) {
  return (
    <div className="p-2 text-[13px] [column-fill:auto] sm:columns-[240px]" style={{ columnGap: 8 }}>
      {items.map((item) => {
        const state = stateOf(item);
        return (
          <div
            key={item.id}
            {...common(item, state, itemProps(item))}
            className={surface(state, "flex h-7 break-inside-avoid items-center gap-2 rounded-sm px-2")}
          >
            <KindGlyph item={item} px={16} />
            {state.renaming ? renameBox(item, "h-6 flex-1 text-[13px]") : <span className="truncate">{displayName(item)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- icons

function SmallIconsView({ items, stateOf, itemProps, renameBox }: Shared) {
  return (
    <div className="grid gap-x-2 gap-y-0.5 p-2 text-[13px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
      {items.map((item) => {
        const state = stateOf(item);
        return (
          <div key={item.id} {...common(item, state, itemProps(item))} className={surface(state, "flex h-7 items-center gap-2 rounded-sm px-2")}>
            <KindGlyph item={item} px={16} />
            {state.renaming ? renameBox(item, "h-6 flex-1 text-[13px]") : <span className="truncate">{displayName(item)}</span>}
          </div>
        );
      })}
    </div>
  );
}

const ICON_SIZES = {
  medium: { cell: 104, icon: 48 },
  large: { cell: 132, icon: 88 },
  xl: { cell: 216, icon: 176 },
} as const;

function IconsView({ items, stateOf, itemProps, renameBox, canLoad, size }: Shared & { size: "medium" | "large" | "xl" }) {
  const { cell, icon } = ICON_SIZES[size];
  return (
    <div className="grid content-start gap-1 p-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))` }}>
      {items.map((item) => {
        const state = stateOf(item);
        return (
          <div
            key={item.id}
            {...common(item, state, itemProps(item))}
            className={surface(state, "flex flex-col items-center gap-1 rounded-md px-1.5 pb-2 pt-2 text-center")}
          >
            <div className="flex items-end justify-center" style={{ height: icon, width: icon }}>
              <Thumb item={item} px={icon} canLoad={canLoad(item)} />
            </div>
            {state.renaming ? (
              renameBox(item, "h-6 w-full text-center text-xs")
            ) : (
              <span className={cn("w-full break-words text-xs leading-snug text-foreground", state.selected ? "line-clamp-none" : "line-clamp-2")}>
                {displayName(item)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- tiles

function TilesView({ items, stateOf, itemProps, renameBox, canLoad, showLocation }: Shared & { showLocation: boolean }) {
  return (
    <div className="grid content-start gap-1 p-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {items.map((item) => {
        const state = stateOf(item);
        const second =
          item.type === "FOLDER" ? "File folder" : item.type === "LINK" ? hostOf(item.url) : kindLabel(item);
        const third =
          showLocation && item.folder ? item.folder.replace(/\//g, " › ") : item.type === "FILE" ? formatBytes(item.size) : "";
        return (
          <div key={item.id} {...common(item, state, itemProps(item))} className={surface(state, "flex h-[68px] items-center gap-3 rounded-md px-2")}>
            <div className="flex size-12 shrink-0 items-center justify-center">
              <Thumb item={item} px={48} canLoad={canLoad(item)} />
            </div>
            <div className="min-w-0 flex-1 text-xs leading-snug">
              {state.renaming ? renameBox(item, "h-6 w-full text-xs") : <p className="truncate text-[13px] text-foreground">{displayName(item)}</p>}
              <p className="truncate text-muted-foreground">{second}</p>
              {third && <p className="truncate text-muted-foreground">{third}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A picture's own pixels where we can load them; the kind's icon otherwise. */
function Thumb({ item, px, canLoad }: { item: ResourceItem; px: number; canLoad: boolean }) {
  const [failed, setFailed] = useState(false);
  if (kindOf(item) === "image" && canLoad && !failed && px >= 48) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.url}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full rounded-sm border border-border/60 object-contain shadow-sm"
      />
    );
  }
  return <KindGlyph item={item} px={px} />;
}

// ------------------------------------------------------------------- rename

/**
 * Rename in place, as Explorer does after F2: the name without its extension
 * is pre-selected, Enter commits, Escape abandons, clicking away commits.
 * A rejected name keeps the box open so it can be corrected.
 */
export function RenameBox({
  item,
  className,
  onCommit,
  onCancel,
}: {
  item: ResourceItem;
  className?: string;
  onCommit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(item.title);
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, item.type === "FILE" ? displayName(item).length : item.title.length);
  }, [item]);

  const commit = async () => {
    if (settled.current) return;
    settled.current = true;
    const next = value.trim();
    if (!next || next === item.title) return onCancel();
    const problem = await onCommit(next);
    if (problem) {
      settled.current = false;
      ref.current?.focus();
    }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <input
      ref={ref}
      value={value}
      aria-label={`New name for ${item.title}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          void commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          settled.current = true;
          onCancel();
        }
      }}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      spellCheck={false}
      className={cn(
        "min-w-0 rounded-[3px] border border-primary bg-background px-1 text-foreground outline-none ring-2 ring-primary/20",
        className
      )}
    />
  );
}
