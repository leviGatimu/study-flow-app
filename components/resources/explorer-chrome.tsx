"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Folder, FolderOpen, GraduationCap, Library } from "lucide-react";

import { cn } from "@/lib/utils";
import { FOLDER_PAINT } from "./file-kind";
import { folderAncestors, folderName, folderParent } from "@/lib/library-paths";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The parts of the explorer window around the files: the navigation pane on
 * the left and the address bar on top. Both are drop targets for moving
 * items, as in Explorer; `dropProps` supplies the handlers.
 */

/** Just the drag events: spreading anything wider collides with a component's own props. */
export type DropHandlers = Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
type DropProps = (folder: string) => DropHandlers;

const subjectHref = (name: string) => `/resources/${encodeURIComponent(name)}`;

function childrenOf(folders: string[], parent: string): string[] {
  return folders
    .filter((f) => folderParent(f).toLowerCase() === parent.toLowerCase())
    .sort((a, b) => folderName(a).localeCompare(folderName(b), undefined, { numeric: true, sensitivity: "base" }));
}

// ------------------------------------------------------------ navigation pane

export function NavPane({
  subject,
  subjects,
  folders,
  path,
  dropTarget,
  dropProps,
  onNavigate,
}: {
  subject: string;
  subjects: string[];
  folders: string[];
  path: string;
  dropTarget: string | null;
  dropProps: DropProps;
  onNavigate: (folder: string) => void;
}) {
  // What the user opened or closed by hand; the way to the open folder is
  // always shown on top of that, as Explorer's "expand to open folder" does.
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
  const onRoute = useMemo(() => new Set(["", ...folderAncestors(path), path].map((p) => p.toLowerCase())), [path]);
  const isOpen = (folder: string) => toggled.get(folder.toLowerCase()) ?? onRoute.has(folder.toLowerCase());
  const toggle = (folder: string) =>
    setToggled((m) => new Map(m).set(folder.toLowerCase(), !isOpen(folder)));

  const renderFolder = (folder: string, depth: number): React.ReactNode => {
    const kids = childrenOf(folders, folder);
    const open = isOpen(folder);
    const current = folder.toLowerCase() === path.toLowerCase();
    return (
      <li key={folder} role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={current}>
        <TreeRow
          depth={depth}
          current={current}
          highlighted={dropTarget === folder && !current}
          expandable={kids.length > 0}
          open={open}
          onExpand={() => toggle(folder)}
          onOpen={() => onNavigate(folder)}
          icon={open && kids.length ? <FolderOpen className="size-4" {...FOLDER_PAINT} /> : <Folder className="size-4" {...FOLDER_PAINT} />}
          label={folderName(folder)}
          {...dropProps(folder)}
        />
        {open && kids.length > 0 && <ul role="group">{kids.map((k) => renderFolder(k, depth + 1))}</ul>}
      </li>
    );
  };

  const rootKids = childrenOf(folders, "");
  const rootOpen = isOpen("");

  return (
    <nav aria-label="Navigation pane" className="h-full overflow-y-auto px-1.5 py-2 text-[13px]">
      <Link
        href="/resources"
        className="mb-1 flex h-7 items-center gap-2 rounded-sm px-2 text-foreground transition-colors hover:bg-muted/70"
      >
        <Library className="size-4 text-primary" />
        <span className="truncate">Resources</span>
      </Link>
      <div className="mx-2 my-1.5 h-px bg-border" />
      <ul role="tree" aria-label="Subjects and folders">
        {subjects.map((name) => {
          if (name.toLowerCase() !== subject.toLowerCase()) {
            return (
              <li key={name} role="treeitem" aria-selected={false}>
                <Link
                  href={subjectHref(name)}
                  className="flex h-7 items-center gap-1 rounded-sm pr-2 text-foreground transition-colors hover:bg-muted/70"
                  style={{ paddingLeft: 4 }}
                >
                  <span className="flex size-4 items-center justify-center text-muted-foreground">
                    <ChevronRight className="size-3" />
                  </span>
                  <GraduationCap className="size-4 text-primary/80" />
                  <span className="ml-1 truncate">{name}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={name} role="treeitem" aria-expanded={rootKids.length ? rootOpen : undefined} aria-selected={!path}>
              <TreeRow
                depth={0}
                current={!path}
                highlighted={dropTarget === "" && !!path}
                expandable={rootKids.length > 0}
                open={rootOpen}
                onExpand={() => toggle("")}
                onOpen={() => onNavigate("")}
                icon={<GraduationCap className="size-4 text-primary" />}
                label={name}
                bold
                {...dropProps("")}
              />
              {rootOpen && rootKids.length > 0 && <ul role="group">{rootKids.map((k) => renderFolder(k, 1))}</ul>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TreeRow({
  depth,
  current,
  highlighted,
  expandable,
  open,
  onExpand,
  onOpen,
  icon,
  label,
  bold,
  ...drop
}: {
  depth: number;
  current: boolean;
  highlighted: boolean;
  expandable: boolean;
  open: boolean;
  onExpand: () => void;
  onOpen: () => void;
  icon: React.ReactNode;
  label: string;
  bold?: boolean;
} & DropHandlers) {
  return (
    <div
      {...drop}
      className={cn(
        "group flex h-7 items-center gap-1 rounded-sm pr-2 transition-colors",
        current ? "bg-primary/15 text-foreground" : "hover:bg-muted/70",
        highlighted && "bg-primary/25 ring-1 ring-inset ring-primary"
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        onClick={onExpand}
        className={cn("flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground", !expandable && "invisible")}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline">
        {icon}
        <span className={cn("truncate", bold && "font-medium")}>{label}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- address bar

/**
 * Breadcrumbs that turn into a text box when the empty part is clicked, the
 * way Explorer's address bar does. Every "›" opens a menu of the folders
 * beneath that point. A typed path may be the real Windows path, the
 * subject-relative one, or start with another subject's name.
 */
export function AddressBar({
  subject,
  subjects,
  folders,
  path,
  absolutePath,
  dropTarget,
  dropProps,
  onNavigate,
  onNavigateSubject,
  onNotFound,
}: {
  subject: string;
  subjects: string[];
  folders: string[];
  path: string;
  /** The Windows path of the open folder, on the desktop. */
  absolutePath: string | null;
  dropTarget: string | null;
  dropProps: DropProps;
  onNavigate: (folder: string) => void;
  onNavigateSubject: (name: string) => void;
  onNotFound: (typed: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const crumbs = path ? path.split("/") : [];
  const displayPath = absolutePath ?? [subject, ...crumbs].join("\\");

  const begin = () => {
    setDraft(displayPath);
    setEditing(true);
    requestAnimationFrame(() => input.current?.select());
  };

  const submit = () => {
    const typed = draft.trim();
    setEditing(false);
    if (!typed || typed === displayPath) return;

    let rest = typed;
    const base = absolutePath ? absolutePath.slice(0, absolutePath.length - (path ? path.length + 1 : 0)) : null;
    if (base && rest.toLowerCase().startsWith(base.toLowerCase())) rest = rest.slice(base.length);
    const parts = rest.split(/[\\/]+/).map((p) => p.trim()).filter(Boolean);
    if (parts[0]?.toLowerCase() === "resources") parts.shift();

    const other = subjects.find((s) => s.toLowerCase() === parts[0]?.toLowerCase());
    if (other && other.toLowerCase() !== subject.toLowerCase()) return onNavigateSubject(other);
    if (other) parts.shift();

    const wanted = parts.join("/").toLowerCase();
    if (!wanted) return onNavigate("");
    const hit = folders.find((f) => f.toLowerCase() === wanted);
    if (hit) return onNavigate(hit);
    onNotFound(typed);
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label="Address"
        spellCheck={false}
        className="h-8 min-w-0 flex-1 rounded-md border border-primary bg-background px-2.5 text-[13px] outline-none ring-2 ring-primary/20"
      />
    );
  }

  const level = (atPath: string, isSubjectLevel: boolean) =>
    isSubjectLevel ? subjects.map((s) => ({ key: s, label: s, go: () => (s === subject ? onNavigate("") : onNavigateSubject(s)) })) : childrenOf(folders, atPath).map((f) => ({ key: f, label: folderName(f), go: () => onNavigate(f) }));

  return (
    <div
      role="navigation"
      aria-label="Address"
      onClick={(e) => {
        if (e.target === e.currentTarget) begin();
      }}
      className="flex h-8 min-w-0 flex-1 cursor-text items-center gap-0 overflow-hidden rounded-md border border-border bg-background pl-1.5 pr-1 text-[13px] transition-colors hover:border-foreground/25"
    >
      <Folder className="mr-1 size-4 shrink-0" {...FOLDER_PAINT} aria-hidden />
      <Chevron entries={level("", true)} label="Subjects" />
      <CrumbButton onClick={() => onNavigate("")} current={!path} highlighted={dropTarget === "" && !!path} {...dropProps("")}>
        {subject}
      </CrumbButton>
      {crumbs.map((c, i) => {
        const target = crumbs.slice(0, i + 1).join("/");
        const parent = crumbs.slice(0, i).join("/");
        const last = i === crumbs.length - 1;
        return (
          <span key={target} className="flex min-w-0 items-center">
            <Chevron entries={level(parent, false)} label={`Folders in ${parent ? folderName(parent) : subject}`} />
            <CrumbButton onClick={() => onNavigate(target)} current={last} highlighted={dropTarget === target && !last} {...dropProps(target)}>
              {c}
            </CrumbButton>
          </span>
        );
      })}
      <Chevron entries={level(path, false)} label={`Folders in ${path ? folderName(path) : subject}`} />
      <button type="button" aria-label="Edit address" onClick={begin} className="h-full min-w-6 flex-1 cursor-text" />
    </div>
  );
}

function CrumbButton({
  current,
  highlighted,
  onClick,
  children,
  ...drop
}: {
  current: boolean;
  highlighted: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & DropHandlers) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "location" : undefined}
      {...drop}
      className={cn(
        "h-6 shrink-0 truncate rounded-sm px-1.5 text-foreground transition-colors hover:bg-muted",
        highlighted && "bg-primary/20 ring-1 ring-primary"
      )}
    >
      {children}
    </button>
  );
}

function Chevron({ entries, label }: { entries: { key: string; label: string; go: () => void }[]; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-6 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:rotate-90"
        >
          <ChevronRight className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-48 overflow-y-auto">
        {entries.length === 0 ? (
          <DropdownMenuItem disabled>No folders</DropdownMenuItem>
        ) : (
          entries.map((e) => (
            <DropdownMenuItem key={e.key} onClick={e.go}>
              <Folder {...FOLDER_PAINT} />
              {e.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
