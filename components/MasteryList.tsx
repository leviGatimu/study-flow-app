'use client';

import { useState, useTransition } from 'react';
import { toggleMasteryItem, deleteMasteryItem } from '@/lib/actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useArchiveReason } from '@/components/ArchiveContext';

type MasteryItem = {
  id: string;
  title: string;
  isCompleted: boolean;
};

export function MasteryList({ items, subject }: { items: MasteryItem[], subject: string }) {
  const [isPending, startTransition] = useTransition();
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const archiveReason = useArchiveReason();
  const archived = archiveReason !== null;

  return (
    <div>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">
          No topics yet. Add the chapters this subject covers.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center justify-between gap-3 py-2"
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <Checkbox 
                checked={item.isCompleted}
                title={archiveReason ?? undefined}
                disabled={isPending || archived}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    await toggleMasteryItem(item.id, checked === true, subject);
                  });
                }}
                className="size-4.5"
              />
              <span className={cn(
                "truncate text-sm text-foreground",
                item.isCompleted && "text-muted-foreground line-through"
              )}>
                {item.title}
              </span>
            </label>
            
            {!archived && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete topic"
                disabled={isPending}
                onClick={() => setItemToDelete(item.id)}
                className="size-7 shrink-0 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
        </ul>
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
