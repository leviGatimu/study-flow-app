'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Link as LinkIcon, FileText, UploadCloud, Loader2 } from 'lucide-react';
import { addResource } from '@/lib/actions';
import { toast } from 'sonner';

export function AddResourceForm({ subject: initialSubject, allSubjects = [] }: { subject?: string, allSubjects?: string[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'LINK' | 'FILE'>('LINK');
  const [isPending, setIsPending] = useState(false);
  const [subject, setSubject] = useState(initialSubject || '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    
    // Use the state subject if initialSubject wasn't provided
    const targetSubject = initialSubject || subject;
    
    if (!targetSubject) {
      toast.error("Subject is required");
      setIsPending(false);
      return;
    }

    formData.append('subject', targetSubject);
    formData.append('type', type);
    
    try {
      await addResource(formData);
      toast.success("Resource added!", {
        description: `New ${type.toLowerCase()} saved to ${targetSubject} repository.`
      });
      setOpen(false);
      if (!initialSubject) setSubject(''); // Reset if it was a global add
    } catch (error) {
      console.error(error);
      toast.error("Upload failed", {
        description: "Make sure the file size is reasonable and try again."
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 rounded-xl font-semibold text-xs border-border/60 hover:bg-primary/10 hover:text-primary transition-colors duration-200">
          <Plus className="w-3.5 h-3.5 mr-2" /> Add material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-8 border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-heading font-black tracking-tighter">Add Resource</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {!initialSubject && (
            <div className="space-y-2">
              <Label htmlFor="resourceSubject" className="text-xs font-medium text-muted-foreground ml-1">Subject</Label>
              <Select value={subject} onValueChange={setSubject} required>
                <SelectTrigger id="resourceSubject" className="h-12 rounded-xl bg-muted/30 border-border/40 font-bold px-4">
                  <SelectValue placeholder="Select subject..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 font-bold">
                  {allSubjects.map((s) => (
                    <SelectItem key={s} value={s} className="rounded-lg font-bold py-3 cursor-pointer">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="resourceTitle" className="text-xs font-medium text-muted-foreground ml-1">Title</Label>
            <Input id="resourceTitle" name="title" placeholder="e.g., Chapter 1 Notes" required className="h-12 rounded-xl bg-muted/30 border-border/40 font-bold px-4" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resourceType" className="text-xs font-medium text-muted-foreground ml-1">Resource type</Label>
            <Select value={type} onValueChange={(val: 'LINK' | 'FILE') => setType(val)}>
              <SelectTrigger id="resourceType" className="h-12 rounded-xl bg-muted/30 border-border/40 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 font-bold">
                <SelectItem value="LINK" className="rounded-lg">Web link / URL</SelectItem>
                <SelectItem value="FILE" className="rounded-lg">PDF / document file</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'LINK' ? (
            <div className="space-y-2">
              <Label htmlFor="resourceUrl" className="text-xs font-medium text-muted-foreground ml-1">URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="resourceUrl" name="url" type="url" placeholder="https://..." required className="h-12 rounded-xl bg-muted/30 border-border/40 font-bold pl-12" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="resourceFile" className="text-xs font-medium text-muted-foreground ml-1">Upload file</Label>
              <div className="relative group">
                <Input id="resourceFile" name="file" type="file" required className="h-24 rounded-xl bg-muted/30 border-2 border-dashed border-border/40 font-bold p-8 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors file:hidden" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-muted-foreground group-hover:text-primary transition-colors duration-200">
                  <UploadCloud className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">Select PDF or image</span>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full h-14 rounded-xl font-heading font-bold gap-2">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : type === 'FILE' ? <FileText className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
            {isPending ? 'Uploading...' : 'Add to repository'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
