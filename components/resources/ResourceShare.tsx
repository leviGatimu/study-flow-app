"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Download, FileUp, Folder, Link2, Loader2, PackageOpen, Paperclip, Send, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { uploadIntoResources } from "@/components/resources/upload-files";
import { addResourceLink, createResourceFolder, type ResourceItem } from "@/lib/library-actions";
import { getShareSenderName } from "@/lib/resource-share-actions";
import {
  buildManifest,
  mimeOf,
  packFileName,
  PACK_MANIFEST,
  planImport,
  uploadBatches,
  zipPathOf,
  type ImportPlan,
} from "@/lib/resource-pack";
import { makeZip, readZip, type ZipEntry } from "@/lib/zip";

/** Biggest share we pack in the browser: past this a phone runs out of memory. */
const MAX_SHARE_BYTES = 1024 * 1024 * 1024;
const MAX_IMPORT_FILE_BYTES = 1536 * 1024 * 1024;

/**
 * "Share" on a subject's Resources: download everything in the subject
 * (folders, files and links) as one zip to send to someone, or import a zip
 * somebody sent. Importing adds to what is there; it never replaces or
 * deletes anything. See lib/resource-pack.ts for what is in the zip.
 */
export function ResourceShare({
  subject,
  items,
  subjects,
  canImport,
}: {
  /** null on the Resources home page: only importing is offered there. */
  subject: string | null;
  /** Everything in the subject, at every depth. */
  items: ResourceItem[];
  subjects: string[];
  /** False while a finished year is open: it can be shared but not added to. */
  canImport: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [review, setReview] = useState<{ plan: ImportPlan; entries: Map<string, Uint8Array>; fileName: string } | null>(null);
  const [reading, setReading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast.error("That file is too big to import in one go. Split it into smaller zips.");
      return;
    }
    setReading(true);
    try {
      const entries = await readZip(await file.arrayBuffer());
      const manifest = entries.find((e) => e.path === PACK_MANIFEST);
      const plan = planImport(
        entries.map((e) => ({ path: e.path, size: e.data.length })),
        manifest ? new TextDecoder().decode(manifest.data) : null
      );
      if (plan.files.length + plan.links.length + plan.folders.length === 0) {
        toast.error("There is nothing in that zip to import.");
        return;
      }
      setReview({ plan, entries: new Map(entries.map((e) => [e.path, e.data])), fileName: file.name });
    } catch (error) {
      toast.error((error as Error).message || "That file could not be opened.");
    } finally {
      setReading(false);
    }
  };

  return (
    <>
      {subject === null ? (
        canImport && (
          <Button variant="outline" disabled={reading} onClick={() => picker.current?.click()}>
            {reading ? <Loader2 className="animate-spin" /> : <FileUp />} Import a share
          </Button>
        )
      ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={reading}>
            {reading ? <Loader2 className="animate-spin" /> : <Share2 />} Share <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setExporting(true)}>
            <Download /> Download to share
          </DropdownMenuItem>
          {canImport && (
            <DropdownMenuItem onSelect={() => picker.current?.click()}>
              <FileUp /> Import a share
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <input
        ref={picker}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void pickFile(file);
        }}
      />

      {subject !== null && <ExportDialog open={exporting} subject={subject} items={items} onClose={() => setExporting(false)} />}
      {review && (
        <ImportDialog
          key={review.fileName}
          plan={review.plan}
          entries={review.entries}
          defaultSubject={review.plan.subject ?? subject ?? ""}
          subjects={subjects}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ export */

/** A file's name with its extension, which the zip and the other app need. */
function fileName(item: ResourceItem): string {
  if (!item.ext || item.title.toLowerCase().endsWith(`.${item.ext}`)) return item.title;
  return `${item.title}.${item.ext}`;
}

function counts(items: ResourceItem[]) {
  const folderPaths = new Set<string>();
  for (const i of items) {
    if (i.type === "FOLDER") folderPaths.add(i.folder ? `${i.folder}/${i.title}` : i.title);
    else if (i.folder) folderPaths.add(i.folder);
  }
  return {
    files: items.filter((i) => i.type === "FILE"),
    links: items.filter((i) => i.type === "LINK"),
    folders: [...folderPaths],
  };
}

function ExportDialog({ open, subject, items, onClose }: { open: boolean; subject: string; items: ResourceItem[]; onClose: () => void }) {
  const [progress, setProgress] = useState<string | null>(null);
  const busy = progress !== null;
  const { files, links, folders } = counts(items);
  const canSend = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const make = async (): Promise<{ file: File; skipped: string[] } | null> => {
    const skipped: string[] = [];
    const entries: ZipEntry[] = [];
    let total = 0;
    try {
      for (let n = 0; n < files.length; n++) {
        const item = files[n];
        setProgress(`Packing ${n + 1} of ${files.length}…`);
        try {
          const res = await fetch(item.url, { credentials: "same-origin" });
          if (!res.ok) throw new Error();
          const data = new Uint8Array(await res.arrayBuffer());
          total += data.length;
          if (total > MAX_SHARE_BYTES) {
            toast.error("That is too much to share in one file (over 1 GB). Share a smaller subject, or move some files out first.");
            return null;
          }
          entries.push({ path: zipPathOf(item.folder, fileName(item)), data });
        } catch {
          skipped.push(item.inLibrary ? `${item.title} (only on your desktop)` : item.title);
        }
      }
      const from = await getShareSenderName().catch(() => null);
      const manifest = buildManifest({
        subject,
        from,
        folders,
        links: links.map((l) => ({ title: l.title, url: l.url, folder: l.folder })),
      });
      entries.unshift({ path: PACK_MANIFEST, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
      const zip = makeZip(entries);
      return { file: new File([zip], packFileName(subject), { type: "application/zip" }), skipped };
    } catch (error) {
      toast.error((error as Error).message || "The share could not be made.");
      return null;
    } finally {
      setProgress(null);
    }
  };

  const report = (skipped: string[]) => {
    if (skipped.length > 0) {
      toast.warning(`${skipped.length} ${skipped.length === 1 ? "file was" : "files were"} left out`, {
        description: skipped.slice(0, 4).join(", ") + (skipped.length > 4 ? "…" : ""),
      });
    }
  };

  const download = async () => {
    const made = await make();
    if (!made) return;
    const url = URL.createObjectURL(made.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = made.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success(`${subject} downloaded`, { description: "Send the file to anyone; they open Resources > Share > Import a share." });
    report(made.skipped);
    onClose();
  };

  const send = async () => {
    const made = await make();
    if (!made) return;
    if (!navigator.canShare?.({ files: [made.file] })) {
      toast.error("Sending files is not available here. Download it instead.");
      return;
    }
    try {
      await navigator.share({ files: [made.file], title: `${subject} resources`, text: `My ${subject} resources. Open them in Study Flow: Resources > Share > Import a share.` });
      report(made.skipped);
      onClose();
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("The share could not be sent.");
    }
  };

  const empty = files.length + links.length + folders.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Share {subject}</DialogTitle>
          <DialogDescription>
            Download one zip with everything in {subject}, in its folders. Send it by WhatsApp, email or USB; the other person imports it in Study Flow, or just opens the zip.
          </DialogDescription>
        </DialogHeader>
        {empty ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{subject} has nothing in it to share yet.</p>
        ) : (
          <PlanCounts files={files.length} links={links.length} folders={folders.length} />
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          {canSend && (
            <Button variant="outline" onClick={() => void send()} disabled={busy || empty}>
              <Send /> Send…
            </Button>
          )}
          <Button onClick={() => void download()} disabled={busy || empty}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} {progress ?? "Download zip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanCounts({ files, links, folders }: { files: number; links: number; folders: number }) {
  const tiles = [
    { icon: Paperclip, label: files === 1 ? "file" : "files", value: files, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { icon: Link2, label: links === 1 ? "link" : "links", value: links, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { icon: Folder, label: folders === 1 ? "folder" : "folders", value: folders, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="rounded-xl border border-border/60 p-3 text-center">
          <span className={`mx-auto grid size-8 place-items-center rounded-lg ${tone}`}>
            <Icon className="size-4" />
          </span>
          <p className="mt-2 font-heading text-xl font-black tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ import */

function ImportDialog({
  plan,
  entries,
  defaultSubject,
  subjects,
  onClose,
}: {
  plan: ImportPlan;
  entries: Map<string, Uint8Array>;
  defaultSubject: string;
  subjects: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(defaultSubject);
  const [progress, setProgress] = useState<string | null>(null);
  const busy = progress !== null;

  const run = async () => {
    const subject = target.trim();
    if (!subject) {
      toast.error("Choose which subject to put these in.");
      return;
    }
    const errors: string[] = [];
    let files = 0;
    let links = 0;
    try {
      for (let n = 0; n < plan.folders.length; n++) {
        setProgress(`Making folders ${n + 1} of ${plan.folders.length}…`);
        const path = plan.folders[n];
        const slash = path.lastIndexOf("/");
        const res = await createResourceFolder(subject, slash < 0 ? "" : path.slice(0, slash), path.slice(slash + 1));
        // A folder already there is fine: the files go into it.
        if (!res.success && !/already here/i.test(res.error ?? "")) errors.push(res.error ?? `${path} could not be made.`);
      }

      const batches = uploadBatches(plan.files);
      let done = 0;
      for (const batch of batches) {
        setProgress(`Adding files ${done + 1}–${done + batch.length} of ${plan.files.length}…`);
        const blobs = batch.map((f) => new File([entries.get(f.zipPath) as BlobPart], f.name, { type: mimeOf(f.name) }));
        const result = await uploadIntoResources(blobs, subject, batch[0].folder);
        files += result.added;
        errors.push(...result.errors);
        done += batch.length;
      }

      for (let n = 0; n < plan.links.length; n++) {
        setProgress(`Adding links ${n + 1} of ${plan.links.length}…`);
        const link = plan.links[n];
        const res = await addResourceLink(subject, link.folder, link.title, link.url);
        if (res.success) links++;
        else errors.push(`${link.title}: ${res.error}`);
      }
    } catch (error) {
      errors.push((error as Error).message);
    } finally {
      setProgress(null);
    }

    const added = [files && `${files} ${files === 1 ? "file" : "files"}`, links && `${links} ${links === 1 ? "link" : "links"}`].filter(Boolean).join(" and ");
    if (added) toast.success(`Imported into ${subject}`, { description: `${added} added.` });
    if (errors.length > 0) {
      toast.warning(`${errors.length} ${errors.length === 1 ? "item was" : "items were"} not imported`, {
        description: errors.slice(0, 3).join(" · ") + (errors.length > 3 ? "…" : ""),
      });
    }
    onClose();
    router.push(`/resources/${encodeURIComponent(subject)}`);
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-lg font-semibold">
            <PackageOpen className="size-5 text-primary" /> Import a share
          </DialogTitle>
          <DialogDescription>
            {plan.from ? `From ${plan.from}. ` : ""}
            These are added to your Resources. Nothing you already have is changed or removed.
          </DialogDescription>
        </DialogHeader>

        <PlanCounts files={plan.files.length} links={plan.links.length} folders={plan.folders.length} />

        <div className="space-y-1.5">
          <Label htmlFor="import-subject" className="text-xs text-muted-foreground">
            Put them in
          </Label>
          <Input id="import-subject" list="import-subjects" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} />
          <datalist id="import-subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Pick one of your subjects, or type a new name.</p>
        </div>

        {plan.skipped.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            {plan.skipped.map((s) => (
              <li key={s} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={busy || !target.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <PackageOpen />} {progress ?? "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
