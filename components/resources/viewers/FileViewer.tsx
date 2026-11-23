"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Download, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { linkEmbedUrl, MAX_PREVIEW_BYTES, modernFormatFor, previewKind } from "@/lib/file-preview";
import type { ResourceItem } from "@/lib/library-actions";
import { displayName, formatBytes, KindIcon, kindLabel } from "../file-kind";
import { DocxViewer, SheetViewer, SlidesViewer, TextViewer } from "./office-viewers";

/**
 * Opens a resource file inside Study Flow, full screen, instead of handing it
 * to the browser (which downloads anything it cannot show). Images, PDFs,
 * audio and video use the browser's own players; Word, PowerPoint, Excel, CSV
 * and text use the viewers in office-viewers.tsx. Every state that cannot
 * show the file still offers the download, so a file is never a dead end.
 */
export function FileViewer({ item, onClose }: { item: ResourceItem | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none md:h-[94dvh] md:w-[96vw] md:rounded-2xl md:ring-1"
      >
        {item && (item.type === "LINK" ? <LinkBody key={item.id} item={item} onClose={onClose} /> : <ViewerBody key={item.id} item={item} onClose={onClose} />)}
      </DialogContent>
    </Dialog>
  );
}

/** The same URL, asking the server to send it as a download. */
export function downloadUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

/**
 * A saved web link, shown inside the app (desktop only: the desktop app lets
 * any site sit in this frame, a browser does not). The frame is sandboxed so
 * the site can run but can never take over Study Flow's own window.
 */
function LinkBody({ item, onClose }: { item: ResourceItem; onClose: () => void }) {
  const src = linkEmbedUrl(item.url);
  let host = item.url;
  try {
    host = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {}
  const where = [item.subject, ...(item.folder ? item.folder.split("/") : [])].join(" › ");

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <KindIcon item={item} size="sm" />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-sm font-semibold text-foreground sm:text-base">{displayName(item)}</DialogTitle>
          <DialogDescription className="truncate text-xs text-muted-foreground">
            {host}
            {where ? ` · ${where}` : ""}
          </DialogDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={item.url} target="_blank" rel="noreferrer">
            <ExternalLink />
            <span className="hidden sm:inline">Open in browser</span>
          </a>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </header>
      <div className="relative min-h-0 flex-1 bg-white">
        {src ? (
          <iframe
            src={src}
            title={displayName(item)}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">This link is not a web page, so it cannot be shown here.</p>
          </div>
        )}
      </div>
    </>
  );
}

function ViewerBody({ item, onClose }: { item: ResourceItem; onClose: () => void }) {
  const kind = previewKind(item.ext);
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((message: string) => setError(message), []);
  const name = displayName(item);
  const where = [item.subject, ...(item.folder ? item.folder.split("/") : [])].join(" › ");
  const tooLarge = item.size !== null && item.size > MAX_PREVIEW_BYTES && !["audio", "video", "pdf"].includes(kind);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <KindIcon item={item} size="sm" />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-sm font-semibold text-foreground sm:text-base">{name}</DialogTitle>
          <DialogDescription className="truncate text-xs text-muted-foreground">
            {kindLabel(item)}
            {item.ext ? ` · .${item.ext}` : ""}
            {item.size !== null ? ` · ${formatBytes(item.size)}` : ""}
            {where ? ` · ${where}` : ""}
          </DialogDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={downloadUrl(item.url)} download={item.title}>
            <Download />
            <span className="hidden sm:inline">Download</span>
          </a>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <Unavailable item={item} title="This file can't be shown here" message={error} />
        ) : tooLarge ? (
          <Unavailable
            item={item}
            title="This file is too large to preview"
            message={`Files over ${formatBytes(MAX_PREVIEW_BYTES)} open faster from a download.`}
          />
        ) : (
          <Preview item={item} kind={kind} onError={onError} />
        )}
      </div>
    </>
  );
}

function Preview({ item, kind, onError }: { item: ResourceItem; kind: ReturnType<typeof previewKind>; onError: (m: string) => void }) {
  const props = { url: item.url, title: item.title, onError };
  switch (kind) {
    case "image":
      return (
        <div className="flex h-full items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.title} className="max-h-full max-w-full object-contain" onError={() => onError("This image could not be loaded.")} />
        </div>
      );
    case "pdf":
      return <iframe src={`${item.url}#view=FitH`} title={item.title} className="h-full w-full border-0 bg-slate-100 dark:bg-slate-900" />;
    case "audio":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
          <KindIcon item={item} size="xl" />
          <audio controls autoPlay={false} preload="metadata" src={item.url} className="w-full max-w-lg" onError={() => onError("This audio file could not be played.")} />
        </div>
      );
    case "video":
      return (
        <div className="flex h-full items-center justify-center bg-black">
          <video controls preload="metadata" src={item.url} className="max-h-full max-w-full" onError={() => onError("This video could not be played.")} />
        </div>
      );
    case "docx":
      return <DocxViewer {...props} />;
    case "pptx":
      return <SlidesViewer {...props} />;
    case "xlsx":
      return <SheetViewer {...props} />;
    case "csv":
      return <SheetViewer {...props} csv />;
    case "text":
      return <TextViewer {...props} />;
    case "legacy-office": {
      const modern = modernFormatFor(item.ext);
      return (
        <Unavailable
          item={item}
          title={`This is an older ${modern?.app ?? "Office"} file`}
          message={
            modern
              ? `Study Flow can show .${modern.ext} files, not the older .${item.ext} kind. Open it in ${modern.app}, choose Save As > .${modern.ext}, and upload that copy to preview it here.`
              : "Study Flow can't show this kind of file."
          }
        />
      );
    }
    default:
      return <Unavailable item={item} title="Study Flow can't show this kind of file" message="Download it to open it in another app." />;
  }
}

function Unavailable({ item, title, message }: { item: ResourceItem; title: string; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="relative">
        <KindIcon item={item} size="xl" />
        <AlertCircle className="absolute -right-1 -bottom-1 size-6 rounded-full bg-background text-muted-foreground" aria-hidden />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild>
        <a href={downloadUrl(item.url)} download={item.title}>
          <Download /> Download
        </a>
      </Button>
    </div>
  );
}

