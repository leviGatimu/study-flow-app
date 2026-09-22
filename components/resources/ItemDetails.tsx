"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FolderOpen,
  FolderSymlink,
  Pencil,
  Trash2,
  MonitorDown,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResourceItem } from "@/lib/library-actions";
import { displayName, formatBytes, formatWhen, hostOf, kindLabel, kindOf, KindIcon } from "./file-kind";

/**
 * The right-hand rail for a selected item: a preview where one is possible,
 * then the facts, then the actions. Everything the context menu offers is
 * here as a visible button, because a right-click is not discoverable and
 * the desktop shell swallows the native one anyway.
 */
export function ItemDetails({
  item,
  subject,
  childCount,
  canWrite,
  onDesktop,
  onOpen,
  onOpenFolder,
  onReveal,
  onRename,
  onMove,
  onDelete,
  onNavigate,
}: {
  item: ResourceItem;
  subject: string;
  /** For a folder: how many things are inside it. */
  childCount?: number;
  canWrite: boolean;
  onDesktop: boolean;
  onOpen: () => void;
  onOpenFolder?: () => void;
  onReveal?: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onNavigate: (folder: string) => void;
}) {
  const kind = kindOf(item);
  const isFolder = item.type === "FOLDER";
  const isLink = item.type === "LINK";
  const canReveal = onDesktop && item.type === "FILE" && item.inLibrary;
  // A row synced from the desktop names a file that only that machine holds.
  const onlyOnDesktop = item.type === "FILE" && item.inLibrary && !onDesktop;
  const crumbs = item.folder ? item.folder.split("/") : [];

  return (
    <div className="flex flex-col">
      <Preview item={item} available={!onlyOnDesktop} />

      <div className="space-y-1 px-5 pt-4">
        <div className="flex items-start gap-3">
          <KindIcon item={item} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-heading text-base font-semibold leading-snug text-foreground">
              {displayName(item)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {kindLabel(item)}
              {item.type === "FILE" && item.ext ? ` · .${item.ext}` : ""}
              {isFolder && childCount !== undefined
                ? ` · ${childCount} ${childCount === 1 ? "item" : "items"}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-border px-5 pt-4 text-sm">
        <Row label="Where">
          <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <button type="button" onClick={() => onNavigate("")} className="text-foreground hover:text-primary hover:underline">
              {subject}
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground/60" />
                <button
                  type="button"
                  onClick={() => onNavigate(crumbs.slice(0, i + 1).join("/"))}
                  className="text-foreground hover:text-primary hover:underline"
                >
                  {c}
                </button>
              </span>
            ))}
          </span>
        </Row>
        {isLink && (
          <Row label="Address">
            <a href={item.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
              {item.url}
            </a>
          </Row>
        )}
        {item.type === "FILE" && <Row label="Size">{formatBytes(item.size)}</Row>}
        <Row label="Added">
          <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
            {formatWhen(item.createdAt)}
          </time>
        </Row>
        {item.type === "FILE" && item.updatedAt !== item.createdAt && (
          <Row label="Modified">
            <time dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()}>
              {formatWhen(item.updatedAt)}
            </time>
          </Row>
        )}
        {onlyOnDesktop && (
          <Row label="Stored">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MonitorDown className="size-3.5" />
              In the library folder on your desktop
            </span>
          </Row>
        )}
      </dl>

      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border px-5 pt-4 pb-5">
        {isFolder ? (
          <Button onClick={onOpen} className="col-span-2">
            <FolderOpen /> Open folder
          </Button>
        ) : (
          <Button onClick={onOpen} className="col-span-2" disabled={onlyOnDesktop} title={onlyOnDesktop ? "This file lives on your desktop computer" : undefined}>
            <ExternalLink /> {isLink ? `Open ${hostOf(item.url)}` : onlyOnDesktop ? "Only on your desktop" : "Open"}
          </Button>
        )}
        {isFolder && onDesktop && onOpenFolder && (
          <Button variant="outline" onClick={onOpenFolder} className="col-span-2">
            <FolderSymlink /> Show in Explorer
          </Button>
        )}
        {canReveal && onReveal && (
          <Button variant="outline" onClick={onReveal} className="col-span-2">
            <FolderSymlink /> Show in Explorer
          </Button>
        )}
        {canWrite && (
          <>
            <Button variant="outline" onClick={onRename}>
              <Pencil /> Rename
            </Button>
            <Button variant="outline" onClick={onMove}>
              <FolderSymlink /> Move
            </Button>
            <Button variant="destructive" onClick={onDelete} className="col-span-2">
              <Trash2 /> Delete
            </Button>
          </>
        )}
      </div>

      {kind === "pdf" && (
        <p className="px-5 pb-4 text-[11px] text-muted-foreground">
          Studying this? Open it in the{" "}
          <Link href={`/studio/${encodeURIComponent(subject)}`} className="text-primary hover:underline">
            deep work studio
          </Link>{" "}
          with notes alongside.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Whatever the browser can show inline: images, PDFs (Chromium's viewer),
 * audio and video. Anything else gets its icon, large.
 */
function Preview({ item, available }: { item: ResourceItem; available: boolean }) {
  const kind = kindOf(item);
  const [failed, setFailed] = useState(false);
  const frame = "flex items-center justify-center overflow-hidden rounded-t-2xl bg-muted/40";

  if (kind === "image" && available && !failed) {
    return (
      <div className={cn(frame, "max-h-72")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.title} className="max-h-72 w-full object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  if (kind === "pdf" && available && !failed) {
    return (
      <div className={cn(frame, "h-80 bg-slate-100 dark:bg-slate-900")}>
        <iframe
          src={`${item.url}#toolbar=0&navpanes=0&view=FitH`}
          title={`Preview of ${item.title}`}
          className="h-full w-full border-0"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  if (kind === "audio" && available) {
    return (
      <div className={cn(frame, "flex-col gap-4 px-5 py-6")}>
        <KindIcon item={item} size="xl" />
        <audio controls preload="metadata" src={item.url} className="w-full" />
      </div>
    );
  }
  if (kind === "video" && available) {
    return (
      <div className={cn(frame, "bg-black")}>
        <video controls preload="metadata" src={item.url} className="max-h-72 w-full" />
      </div>
    );
  }
  if (kind === "link") {
    return (
      <div className={cn(frame, "flex-col gap-3 px-5 py-8")}>
        <Favicon url={item.url} />
        <p className="text-xs text-muted-foreground">{hostOf(item.url)}</p>
      </div>
    );
  }
  return (
    <div className={cn(frame, "py-10")}>
      <KindIcon item={item} size="xl" />
    </div>
  );
}

function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);
  if (failed) return <KindIcon item={{ type: "LINK", ext: "" }} size="xl" />;
  return (
    <div className="flex size-20 items-center justify-center rounded-3xl bg-sky-500/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
        alt=""
        width={40}
        height={40}
        className="rounded-lg"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
