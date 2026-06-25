'use client';

import { useState } from 'react';
import { createProject } from '@/lib/project-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function CreateProjectForm() {
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    
    try {
      await createProject({ title, description });
      window.location.reload(); // Quick refresh to show new project
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6 mt-4">
      <div className="space-y-2">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Project Title</Label>
        <Input 
          name="title" 
          placeholder="e.g., E-Commerce App" 
          className="h-14 rounded-2xl bg-muted/30 border-border/60 font-bold px-6"
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</Label>
        <Textarea 
          name="description" 
          placeholder="What are you building?" 
          className="min-h-[120px] rounded-3xl bg-muted/30 border-border/60 font-medium p-6 resize-none"
        />
      </div>
      <Button 
        type="submit" 
        disabled={isPending}
        className="w-full h-16 rounded-[20px] font-heading font-black text-lg shadow-xl shadow-primary/20"
      >
        {isPending ? 'CREATING...' : 'CREATE PROJECT'}
      </Button>
    </form>
  );
}
