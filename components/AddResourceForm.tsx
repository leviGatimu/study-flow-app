'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { addResource } from '@/lib/actions';
import { useIsArchived } from '@/components/ArchiveContext';
import { toast } from 'sonner';

/**
 * Add a link or upload a file to a subject's folder. With `subject` the
 * subject is fixed; otherwise the form asks for one from `allSubjects`.
 */
export function AddResourceForm({ subject: initialSubject, allSubjects = [] }: { subject?: string, allSubjects?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'LINK' | 'FILE'>('LINK');
  const [isPending, setIsPending] = useState(false);
  const [subject, setSubject] = useState(initialSubject || '');
  const archived = useIsArchived();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const targetSubject = initialSubject || subject;
    if (!targetSubject) {
      toast.error('Choose the subject this belongs to.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.append('subject', targetSubject);
    formData.append('type', type);

    setIsPending(true);
    try {
      await addResource(formData);
      toast.success(type === 'FILE' ? 'File added' : 'Link added', {
        description: `Saved to ${targetSubject}.`,
        action: {
          label: 'Open folder',
          onClick: () => router.push(`/resources/${encodeURIComponent(targetSubject)}`),
        },
      });
      setOpen(false);
      if (!initialSubject) setSubject('');
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Could not add it', {
        description: 'Check the file is not too large, then try again.',
      });
    } finally {
      setIsPending(false);
    }
  };

  if (archived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus /> Add material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Add material</DialogTitle>
          <DialogDescription>A web link or a file from this device, filed under its subject.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!initialSubject && (
            <div className="space-y-1.5">
              <Label htmlFor="resourceSubject">Subject</Label>
              <Select value={subject} onValueChange={setSubject} required>
                <SelectTrigger id="resourceSubject" className="h-10 w-full">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {allSubjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="resourceType">Type</Label>
            <Select value={type} onValueChange={(val: 'LINK' | 'FILE') => setType(val)}>
              <SelectTrigger id="resourceType" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LINK">Web link</SelectItem>
                <SelectItem value="FILE">File from this device</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resourceTitle">
              Title{type === 'FILE' && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </Label>
            <Input
              id="resourceTitle"
              name="title"
              placeholder={type === 'FILE' ? "The file's own name is used if empty" : 'e.g. Chapter 1 notes'}
              required={type === 'LINK'}
              className="h-10"
            />
          </div>

          {type === 'LINK' ? (
            <div className="space-y-1.5">
              <Label htmlFor="resourceUrl">URL</Label>
              <Input id="resourceUrl" name="url" type="url" placeholder="https://..." required className="h-10" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="resourceFile">File</Label>
              <Input id="resourceFile" name="file" type="file" required className="h-10 cursor-pointer" />
              <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, image or audio.</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending} className="h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="h-10 gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? (type === 'FILE' ? 'Uploading' : 'Adding') : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
