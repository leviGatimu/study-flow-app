import {
  FileText,
  FileType2,
  Presentation,
  Sheet,
  Image as ImageIcon,
  Music,
  Film,
  FileCode2,
  File,
  Folder,
  Globe,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResourceItem } from "@/lib/library-actions";

/**
 * How each kind of resource looks, in one place.
 *
 * An explorer is read at a glance, so the kind has to be legible from colour
 * and shape before the name is. These are the only colour assignments in the
 * explorer: every tile, row, icon chip and details header derives from here.
 */

export type FileKind =
  | "folder"
  | "link"
  | "pdf"
  | "word"
  | "slides"
  | "sheet"
  | "image"
  | "audio"
  | "video"
  | "text"
  | "other";

const BY_EXT: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  ppt: "slides",
  pptx: "slides",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  mp3: "audio",
  m4a: "audio",
  aac: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  flac: "audio",
  opus: "audio",
  mp4: "video",
  webm: "video",
  txt: "text",
  md: "text",
};

export function kindOf(item: Pick<ResourceItem, "type" | "ext">): FileKind {
  if (item.type === "FOLDER") return "folder";
  if (item.type === "LINK") return "link";
  return BY_EXT[item.ext] ?? "other";
}

type KindStyle = {
  icon: LucideIcon;
  label: string;
  /** Icon colour. */
  fg: string;
  /** Tinted chip behind the icon. */
  bg: string;
};

const STYLES: Record<FileKind, KindStyle> = {
  folder: { icon: Folder, label: "Folder", fg: "text-amber-500", bg: "bg-amber-500/10" },
  link: { icon: Globe, label: "Web link", fg: "text-sky-500", bg: "bg-sky-500/10" },
  pdf: { icon: FileText, label: "PDF", fg: "text-rose-500", bg: "bg-rose-500/10" },
  word: { icon: FileType2, label: "Word document", fg: "text-blue-500", bg: "bg-blue-500/10" },
  slides: { icon: Presentation, label: "Presentation", fg: "text-orange-500", bg: "bg-orange-500/10" },
  sheet: { icon: Sheet, label: "Spreadsheet", fg: "text-emerald-500", bg: "bg-emerald-500/10" },
  image: { icon: ImageIcon, label: "Image", fg: "text-violet-500", bg: "bg-violet-500/10" },
  audio: { icon: Music, label: "Audio", fg: "text-pink-500", bg: "bg-pink-500/10" },
  video: { icon: Film, label: "Video", fg: "text-cyan-500", bg: "bg-cyan-500/10" },
  text: { icon: FileCode2, label: "Text", fg: "text-slate-500", bg: "bg-slate-500/10" },
  other: { icon: File, label: "File", fg: "text-muted-foreground", bg: "bg-muted" },
};

export function kindStyle(kind: FileKind): KindStyle {
  return STYLES[kind];
}

export function kindLabel(item: Pick<ResourceItem, "type" | "ext">): string {
  const kind = kindOf(item);
  if (kind === "other" && item.ext) return `${item.ext.toUpperCase()} file`;
  return STYLES[kind].label;
}

/** The icon on a tinted chip, at the given size. */
export function KindIcon({
  item,
  size = "md",
  className,
}: {
  item: Pick<ResourceItem, "type" | "ext">;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const kind = kindOf(item);
  const style = STYLES[kind];
  const Icon = style.icon;
  const box = { sm: "size-8 rounded-lg", md: "size-10 rounded-xl", lg: "size-14 rounded-2xl", xl: "size-20 rounded-3xl" }[size];
  const glyph = { sm: "size-4", md: "size-5", lg: "size-7", xl: "size-10" }[size];
  return (
    <div className={cn("flex shrink-0 items-center justify-center", box, style.bg, className)} aria-hidden>
      <Icon className={cn(glyph, style.fg)} strokeWidth={kind === "folder" ? 1.75 : 1.75} fill={kind === "folder" ? "currentColor" : "none"} fillOpacity={kind === "folder" ? 0.18 : 0} />
    </div>
  );
}

/**
 * The bare icon, the way Explorer draws it: no chip, sized in pixels so one
 * component serves 16px detail rows and 96px large-icon tiles alike.
 */
export function KindGlyph({
  item,
  px,
  className,
}: {
  item: Pick<ResourceItem, "type" | "ext">;
  px: number;
  className?: string;
}) {
  const kind = kindOf(item);
  const style = STYLES[kind];
  const Icon = style.icon;
  return (
    <Icon
      aria-hidden
      className={cn("shrink-0", style.fg, className)}
      style={{ width: px, height: px }}
      strokeWidth={px >= 48 ? 1.25 : 1.75}
      {...(kind === "folder" ? FOLDER_PAINT : {})}
    />
  );
}

/**
 * Explorer's folders are solid yellow with a darker edge, and read the same
 * on light and dark backgrounds. A tint of currentColor turns muddy on dark,
 * so the two colours are fixed. Spread onto any lucide Folder icon.
 */
export const FOLDER_PAINT = { fill: "#fcd34d", stroke: "#d97706" } as const;

/** Display name without the extension; the extension is shown separately. */
export function displayName(item: Pick<ResourceItem, "title" | "type" | "ext">): string {
  if (item.type !== "FILE" || !item.ext) return item.title;
  const suffix = `.${item.ext}`;
  return item.title.toLowerCase().endsWith(suffix) ? item.title.slice(0, -suffix.length) : item.title;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** "just now", "3 h ago", "yesterday", "12 Mar", "12 Mar 2025". */
export function formatWhen(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Explorer's "Date modified": an absolute date and time, in the viewer's locale. */
export function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
