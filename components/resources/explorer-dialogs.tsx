"use client";

import { useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { folderName, isWithinFolder } from "@/lib/library-paths";

/**
 * The explorer's small modal forms. Each takes an async `onSubmit` that
 * resolves to an error string or null, and shows that string under the
 * field - the server owns the naming rules, so the client does not repeat
 * them, it just relays the verdict.
 *
 * Each is MOUNTED when needed and unmounted when closed (the explorer
 * renders them conditionally), so their state starts fresh every time and
 * no reset-on-open effect is needed.
 */

type Submit<T> = (value: T) => Promise<string | null>;

export function NameDialog({
  open,
  title,
  description,
  label,
  initial = "",
  /** Characters to pre-select, so "notes.pdf" opens with "notes" highlighted. */
  selectUpTo,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initial?: string;
  selectUpTo?: number;
  submitLabel: string;
  onClose: () => void;
  onSubmit: Submit<string>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Radix focuses the input when the dialog opens; the first focus selects
  // the stem so typing replaces "notes" and keeps ".pdf".
  const selectedOnce = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const problem = await onSubmit(value);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="explorer-name">{label}</Label>
            <Input
              id="explorer-name"
              autoFocus
              value={value}
              onFocus={(e) => {
                if (selectedOnce.current) return;
                selectedOnce.current = true;
                e.currentTarget.setSelectionRange(0, selectUpTo ?? initial.length);
              }}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "explorer-name-error" : undefined}
              autoComplete="off"
              className="h-10"
            />
            {error && (
              <p id="explorer-name-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !value.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LinkDialog({
  open,
  folderLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  folderLabel: string;
  onClose: () => void;
  onSubmit: Submit<{ title: string; url: string }>;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // A pasted URL with no title gets the site's name - one field less to fill.
    const name = title.trim() || safeHost(url);
    const problem = await onSubmit({ title: name, url });
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a web link</DialogTitle>
            <DialogDescription>Saved into {folderLabel}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">Address</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://"
              inputMode="url"
              autoFocus
              autoComplete="off"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-title">
              Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={url ? safeHost(url) : "e.g. Khan Academy — Kinematics"}
              autoComplete="off"
              className="h-10"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              Add link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function safeHost(raw: string): string {
  try {
    return new URL(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim();
  }
}

/**
 * Pick a destination folder. Lists every folder in the subject as an
 * indented tree; the item's own folder and (for a folder) anything inside it
 * are shown but not selectable, which is clearer than hiding them.
 */
export function MoveDialog({
  open,
  subject,
  folders,
  itemLabel,
  currentFolder,
  /** For a folder being moved: its own path, so its subtree is disabled. */
  ownPath,
  onClose,
  onSubmit,
}: {
  open: boolean;
  subject: string;
  folders: string[];
  itemLabel: string;
  currentFolder: string;
  ownPath?: string;
  onClose: () => void;
  onSubmit: Submit<string>;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = ["", ...[...folders].sort((a, b) => a.localeCompare(b))];
  const disabled = (path: string) =>
    path === currentFolder || (ownPath !== undefined && isWithinFolder(path, ownPath));

  const submitWith = async (path: string) => {
    if (busy) return;
    setBusy(true);
    const problem = await onSubmit(path);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move “{itemLabel}”</DialogTitle>
          <DialogDescription>Choose where in {subject} it should go.</DialogDescription>
        </DialogHeader>
        <div role="listbox" aria-label="Destination folder" className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1">
          {options.map((path) => {
            const depth = path ? path.split("/").length : 0;
            const off = disabled(path);
            const selected = target === path;
            return (
              <button
                key={path || "__root"}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={off}
                onClick={() => {
                  setTarget(path);
                  setError(null);
                }}
                onDoubleClick={() => {
                  if (off) return;
                  setTarget(path);
                  void submitWith(path);
                }}
                style={{ paddingLeft: 10 + depth * 18 }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors",
                  selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                  off && "cursor-not-allowed opacity-40 hover:bg-transparent"
                )}
              >
                {depth > 0 && <ChevronRight className="size-3 text-muted-foreground/60" />}
                {selected ? <FolderOpen className="size-4 text-amber-500" /> : <Folder className="size-4 text-amber-500" />}
                <span className="truncate">{path ? folderName(path) : subject}</span>
                {path === currentFolder && <span className="ml-auto text-[11px] text-muted-foreground">current</span>}
              </button>
            );
          })}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => target !== null && submitWith(target)} disabled={busy || target === null}>
            {busy && <Loader2 className="animate-spin" />}
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
