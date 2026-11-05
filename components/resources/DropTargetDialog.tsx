'use client';

import { useState, useTransition } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { uploadResourceFiles } from '@/lib/library-actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Files dropped on the Resources overview: ask which folder they go in, then
 * upload them. Inside a folder, dropping files files them straight there
 * (SubjectFolder); only the overview has no folder to assume.
 */
export function DropTargetDialog({
  files,
  folders,
  onClose,
  onDone,
}: {
  files: File[] | null;
  folders: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [folder, setFolder] = useState('');
  const [pending, start] = useTransition();
  const choices = folders.filter((f) => f !== 'Reports');

  const upload = () => {
    if (!files?.length || !folder) return;
    start(async () => {
      const form = new FormData();
      form.set('subject', folder);
      form.set('folder', '');
      for (const file of files) form.append('file', file);
      try {
        const result = await uploadResourceFiles(form);
        if (result.added) toast.success(`Added ${result.added} ${result.added === 1 ? 'file' : 'files'} to ${folder}.`);
        for (const message of result.errors) toast.error(message);
        if (result.added) onDone();
      } catch {
        toast.error('The files could not be added. Check your connection and try again.');
      }
    });
  };

  return (
    <Dialog open={files !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Add to which folder?</DialogTitle>
          <DialogDescription>
            {files?.length === 1 ? 'One file' : `${files?.length ?? 0} files`} ready to add.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
          {files?.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="truncate">{f.name}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5">
          <Label htmlFor="drop-folder">Folder</Label>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger id="drop-folder" className="w-full">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={pending || !folder}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Add files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
