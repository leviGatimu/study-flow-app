'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTemplate } from '@/lib/actions';
import { Button } from '@/components/ui/button';

export function DeleteTemplateButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button 
      variant="ghost" 
      size="icon"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          deleteTemplate(id);
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
