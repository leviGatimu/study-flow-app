"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSafeDocumentHref, parseCsv } from "@/lib/file-preview";

/**
 * The viewers for files a browser cannot show by itself: Word, PowerPoint,
 * Excel, CSV and plain text. Each one fetches the file through the app's own
 * authenticated route and loads its parsing library only when a file of that
 * kind is opened, so none of them weigh on the Resources page itself.
 *
 * What a document contains is untrusted. The renderers build DOM nodes rather
 * than injecting HTML, and `cleanRendered` runs over the result anyway: no
 * scripts, frames or inline handlers, and only http(s)/mailto links survive.
 */

type Status = { state: "loading" } | { state: "ready" } | { state: "error"; message: string };

/** Fetch the file's bytes; the error message is what the viewer shows. */
async function fetchBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal, credentials: "same-origin" });
  if (response.status === 401) throw new Error("You were signed out. Sign in again to open this file.");
  if (response.status === 404) throw new Error("This file could not be found. It may have been deleted.");
  if (!response.ok) throw new Error(`The file could not be loaded (error ${response.status}).`);
  return response.arrayBuffer();
}

function cleanRendered(root: HTMLElement) {
  root.querySelectorAll("script, iframe, object, embed, form, base, meta").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
    }
  });
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!isSafeDocumentHref(href)) {
      a.removeAttribute("href");
      return;
    }
    if (!href!.trim().startsWith("#")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && !/^(TypeError|SyntaxError)/.test(error.name)) {
    return error.message.length < 160 ? error.message : fallback;
  }
  return fallback;
}

export function ViewerLoading({ label = "Opening the file…" }: { label?: string }) {
  return (
    <div role="status" className="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

type ViewerProps = { url: string; title: string; onError: (message: string) => void };

/** Word (.docx): page-by-page layout with images and tables. */
export function DocxViewer({ url, onError }: ViewerProps) {
  const body = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [bytes, { renderAsync }] = await Promise.all([fetchBytes(url, controller.signal), import("docx-preview")]);
        if (controller.signal.aborted || !body.current || !styles.current) return;
        await renderAsync(bytes, body.current, styles.current, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderComments: false,
          renderChanges: false,
          // An altChunk is raw HTML embedded in the document: never render it.
          renderAltChunks: false,
          useBase64URL: true,
          experimental: false,
        });
        if (controller.signal.aborted) return;
        cleanRendered(body.current);
        setStatus({ state: "ready" });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = messageOf(error, "This Word file could not be read. It may be damaged or password protected.");
        setStatus({ state: "error", message });
        onError(message);
      }
    })();
    return () => controller.abort();
  }, [url, onError]);

  return (
    <div className="relative h-full overflow-auto bg-slate-200 dark:bg-slate-900">
      {status.state === "loading" && (
        <div className="absolute inset-0">
          <ViewerLoading />
        </div>
      )}
      <div ref={styles} />
      {/* docx-preview pads its own wrapper; the paper stays white in dark mode, like Word. */}
      <div ref={body} className="study-docx min-h-full [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-4 sm:[&_.docx-wrapper]:p-8" />
    </div>
  );
}

/** PowerPoint (.pptx): every slide, stacked, with a counter and Prev/Next. */
export function SlidesViewer({ url, onError }: ViewerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [count, setCount] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let previewer: { destroy: () => void } | null = null;
    (async () => {
      try {
        const [bytes, { init }] = await Promise.all([fetchBytes(url, controller.signal), import("pptx-preview")]);
        if (controller.signal.aborted || !host.current || !scroller.current) return;
        // Slides are drawn at a fixed pixel width; measure once, as wide as fits.
        const width = Math.min(1280, Math.max(320, scroller.current.clientWidth - 48));
        const instance = init(host.current, { width, height: Math.round((width * 9) / 16), mode: "list" });
        previewer = instance;
        await instance.preview(bytes);
        if (controller.signal.aborted) return;
        cleanRendered(host.current);
        setCount(host.current.querySelectorAll(".pptx-preview-slide-wrapper").length);
        setStatus({ state: "ready" });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = messageOf(error, "This PowerPoint file could not be read. It may be damaged or password protected.");
        setStatus({ state: "error", message });
        onError(message);
      }
    })();
    return () => {
      controller.abort();
      try {
        previewer?.destroy();
      } catch {
        // The library throws if it is destroyed before it finished drawing.
      }
    };
  }, [url, onError]);

  // Keep the counter on the slide that fills most of the view.
  useEffect(() => {
    if (status.state !== "ready" || !host.current || !scroller.current) return;
    const slides = Array.from(host.current.querySelectorAll<HTMLElement>(".pptx-preview-slide-wrapper"));
    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setCurrent(slides.indexOf(best.target as HTMLElement));
      },
      { root: scroller.current, threshold: [0.25, 0.5, 0.75] }
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [status.state]);

  const goTo = (index: number) => {
    const slides = host.current?.querySelectorAll<HTMLElement>(".pptx-preview-slide-wrapper");
    const target = slides?.[Math.max(0, Math.min(index, (slides?.length ?? 1) - 1))];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Arrow keys and Page Up/Down page through the slides, like a slideshow.
  useEffect(() => {
    if (status.state !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status.state, current]);

  return (
    <div className="relative flex h-full flex-col bg-slate-200 dark:bg-slate-900">
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {status.state === "loading" && (
          <div className="absolute inset-0">
            <ViewerLoading label="Drawing the slides…" />
          </div>
        )}
        <div
          ref={host}
          className="mx-auto flex w-fit flex-col items-center py-6 [&_.pptx-preview-slide-wrapper]:mb-6 [&_.pptx-preview-slide-wrapper]:shadow-lg [&_.pptx-preview-wrapper]:!h-auto [&_.pptx-preview-wrapper]:!bg-transparent"
        />
      </div>
      {status.state === "ready" && count > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-background/90 px-3 py-2 backdrop-blur">
          <Button variant="outline" size="icon-sm" onClick={() => goTo(current - 1)} disabled={current <= 0} aria-label="Previous slide">
            <ChevronLeft />
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
            Slide {current + 1} of {count}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => goTo(current + 1)} disabled={current >= count - 1} aria-label="Next slide">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

type Table = { name: string; rows: string[][] };

const MAX_TABLE_ROWS = 2000;

function TableView({ rows }: { rows: string[][] }) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length === 0 || width === 0) {
    return <p className="p-6 text-sm text-muted-foreground">This sheet is empty.</p>;
  }
  return (
    <table className="border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-20 border-r border-b border-border bg-muted px-2 py-1" />
          {Array.from({ length: width }, (_, c) => (
            <th key={c} className="sticky top-0 z-10 min-w-20 border-r border-b border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {columnName(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, MAX_TABLE_ROWS).map((row, r) => (
          <tr key={r}>
            <th className="sticky left-0 z-10 border-r border-b border-border bg-muted px-2 py-1 text-right text-xs font-medium text-muted-foreground tabular-nums">
              {r + 1}
            </th>
            {Array.from({ length: width }, (_, c) => (
              <td key={c} className="max-w-80 truncate border-r border-b border-border bg-background px-2 py-1 text-foreground" title={row[c] ?? ""}>
                {row[c] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

/** Excel (.xlsx) and CSV: a grid with sheet tabs. */
export function SheetViewer({ url, onError, csv = false }: ViewerProps & { csv?: boolean }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const bytes = await fetchBytes(url, controller.signal);
        let result: Table[];
        if (csv) {
          result = [{ name: "Sheet", rows: parseCsv(new TextDecoder().decode(bytes), MAX_TABLE_ROWS) }];
        } else {
          const { default: readXlsxFile } = await import("read-excel-file/browser");
          const sheets = await readXlsxFile(bytes);
          result = sheets.map((s) => ({ name: s.sheet, rows: s.data.map((row) => row.map(cellText)) }));
        }
        if (!controller.signal.aborted) setTables(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        onError(messageOf(error, "This spreadsheet could not be read. It may be damaged or password protected."));
      }
    })();
    return () => controller.abort();
  }, [url, csv, onError]);

  if (!tables) return <ViewerLoading />;
  const table = tables[active] ?? tables[0];
  const truncated = (table?.rows.length ?? 0) >= MAX_TABLE_ROWS;
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">{table && <TableView rows={table.rows} />}</div>
      {(tables.length > 1 || truncated) && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border/60 bg-muted/50 px-2 py-1.5">
          {tables.length > 1 &&
            tables.map((t, i) => (
              <button
                key={`${t.name}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  "h-7 shrink-0 rounded-md px-3 text-sm whitespace-nowrap transition-colors",
                  i === active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.name}
              </button>
            ))}
          {truncated && <span className="ml-auto shrink-0 px-2 text-xs text-muted-foreground">Showing the first {MAX_TABLE_ROWS} rows</span>}
        </div>
      )}
    </div>
  );
}

const MAX_TEXT_CHARS = 2_000_000;

/** .txt and .md, shown as written. */
export function TextViewer({ url, onError }: ViewerProps) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchBytes(url, controller.signal)
      .then((bytes) => {
        if (!controller.signal.aborted) setText(new TextDecoder().decode(bytes).slice(0, MAX_TEXT_CHARS));
      })
      .catch((error) => {
        if (!controller.signal.aborted) onError(messageOf(error, "This text file could not be read."));
      });
    return () => controller.abort();
  }, [url, onError]);

  if (text === null) return <ViewerLoading />;
  return (
    <div className="h-full overflow-auto bg-background">
      <pre className="mx-auto max-w-4xl p-6 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
        {text || "This file is empty."}
      </pre>
    </div>
  );
}
