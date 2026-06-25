'use client';

import { useState, useTransition } from 'react';
import { addMasteryItem } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

export function AddMasteryForm({ subject }: { subject: string }) {
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    startTransition(async () => {
      await addMasteryItem(subject, title);
      setTitle('');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input 
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Chapter 1: Introduction"
        className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold px-4"
        disabled={isPending}
      />
      <Button 
        type="submit" 
        disabled={isPending || !title.trim()}
        className="rounded-xl font-bold gap-2 shadow-sm"
      >
        <Plus className="w-4 h-4" /> Add Topic
      </Button>
    </form>
  );
}
