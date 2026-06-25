'use client';

import { useState, useTransition } from 'react';
import { toggleMasteryItem, deleteMasteryItem } from '@/lib/actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';

type MasteryItem = {
  id: string;
  title: string;
  isCompleted: boolean;
};

export function MasteryList({ items, subject }: { items: MasteryItem[], subject: string }) {
  const [isPending, startTransition] = useTransition();
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-4 bg-muted/20 rounded-2xl border border-dashed">
          No topics added yet. Start building your syllabus!
        </p>
      ) : (
        items.map((item) => (
          <div 
            key={item.id}
            className={cn(
              "flex items-center justify-between p-4 bg-card border border-border/60 rounded-2xl transition-all hover:shadow-sm group",
              item.isCompleted && "bg-success/5 border-success/20 opacity-70"
            )}
          >
            <div className="flex items-center gap-4">
              <Checkbox 
                checked={item.isCompleted}
                disabled={isPending}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    await toggleMasteryItem(item.id, checked === true, subject);
                  });
                }}
                className="h-5 w-5"
              />
              <span className={cn(
                "font-bold text-foreground transition-all",
                item.isCompleted && "line-through text-success"
              )}>
                {item.title}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete topic"
              disabled={isPending}
              onClick={() => setItemToDelete(item.id)}
              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))
      )}

      <ConfirmModal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        isPending={isPending}
        onConfirm={() => {
          const id = itemToDelete;
          if (id) {
            startTransition(async () => {
              await deleteMasteryItem(id, subject);
            });
          }
          setItemToDelete(null);
        }}
        title="Delete this topic?"
        description="This topic will be permanently removed from your syllabus. You cannot undo this action."
      />
    </div>
  );
}
