'use client';

import { useState, useTransition } from 'react';
import { addMasteryItem } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { useIsArchived } from '@/components/ArchiveContext';

export function AddMasteryForm({ subject }: { subject: string }) {
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const archived = useIsArchived();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    startTransition(async () => {
      await addMasteryItem(subject, title);
      setTitle('');
    });
  };

  if (archived) return null;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        aria-label="Topic title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Chapter 1: Introduction"
        className="h-9 rounded-lg"
        disabled={isPending}
      />
      <Button 
        type="submit" 
        disabled={isPending || !title.trim()}
        variant="outline"
        size="sm"
        className="h-9 shrink-0 rounded-lg"
      >
        <Plus /> Add
      </Button>
    </form>
  );
}
