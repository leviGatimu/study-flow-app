'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteSubject } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function DeleteSubjectButton({ subject }: { subject: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button 
      variant="ghost" 
      size="icon"
      disabled={isPending}
      className="h-10 w-10 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-90"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete all materials for ${subject}? This will remove all resources and mastery items.`)) {
          startTransition(async () => {
            try {
              await deleteSubject(subject);
              toast.success(`Deleted all materials for ${subject}`);
            } catch (error) {
              toast.error("Failed to delete materials");
            }
          });
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
