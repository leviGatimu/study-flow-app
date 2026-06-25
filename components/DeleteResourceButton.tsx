'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteResource } from '@/lib/actions';
import { Button } from '@/components/ui/button';

export function DeleteResourceButton({ id, subject }: { id: string, subject: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button 
      variant="ghost" 
      size="icon"
      disabled={isPending}
      className="h-10 w-10 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-90"
      onClick={() => {
        if (confirm('Are you sure you want to delete this resource?')) {
          startTransition(() => {
            deleteResource(id, subject);
          });
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
