'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createProject } from '@/lib/project-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function CreateProjectForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    if (!title) return;

    setIsPending(true);
    try {
      const project = await createProject({ title, description: description || undefined });
      // The next thing to do with a new project is open it.
      router.push(`/projects/${project.id}`);
    } catch (error) {
      console.error(error);
      toast.error('That project could not be created. Try again.');
      setIsPending(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="project-title">Title</Label>
        <Input
          id="project-title"
          name="title"
          placeholder="e.g. Chemistry coursework"
          className="h-11 rounded-xl"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">
          Description <span className="font-normal text-muted-foreground">Optional</span>
        </Label>
        <Textarea
          id="project-description"
          name="description"
          placeholder="What is it, and when is it due?"
          className="min-h-28 resize-none rounded-xl"
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}
