'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { ExternalLink, FileText, Paperclip, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isImageUrl } from '@/lib/homework-work';
import { cn } from '@/lib/utils';

/** "hw-answer-1730800000000-my_work.pdf" -> "my_work.pdf". */
export function uploadName(url: string): string {
  const name = url.split('/').pop() ?? url;
  return name.replace(/^[a-z-]+-\d{10,}-/i, '');
}

/**
 * One optional photo or PDF: what is saved, or the file just picked (shown as
 * "not saved yet"), with replace and remove. Images preview inline.
 */
export function FileSlot({
  label,
  url,
  picked,
  removed,
  disabled,
  onPick,
  onRemove,
  onUndo,
}: {
  label: string;
  /** The saved file. */
  url: string | null;
  /** A new file waiting to be saved. */
  picked: File | null;
  /** The saved file is marked for removal on the next save. */
  removed: boolean;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const preview = useMemo(() => (picked && picked.type.startsWith('image/') ? URL.createObjectURL(picked) : null), [picked]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const showing = picked ? 'picked' : url && !removed ? 'saved' : 'none';
  const image = showing === 'picked' ? preview : showing === 'saved' && isImageUrl(url) ? url : null;
  const name = showing === 'picked' ? picked!.name : showing === 'saved' ? uploadName(url!) : '';

  return (
    <div>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      {showing === 'none' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            <Paperclip /> Attach {label}
          </Button>
          <span className="text-xs text-muted-foreground">Photo or PDF, optional.</span>
          {removed && url && (
            <button type="button" onClick={onUndo} className="text-xs font-medium text-primary hover:underline">
              Undo remove
            </button>
          )}
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-xl border bg-muted/30', showing === 'picked' ? 'border-primary/40' : 'border-border/60')}>
          {image && (
            <a href={showing === 'saved' ? url! : image} target="_blank" rel="noopener noreferrer" className="block bg-muted/50">
              {/* eslint-disable-next-line @next/next/no-img-element -- user uploads, served by our own route */}
              <img src={image} alt={`${label}: ${name}`} className="max-h-72 w-full object-contain" />
            </a>
          )}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{showing === 'picked' ? 'Not saved yet' : 'Saved'}</p>
            </div>
            {showing === 'saved' && (
              <Button asChild variant="ghost" size="icon" aria-label={`Open ${name}`}>
                <a href={url!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            )}
            {!disabled && (
              <>
                <Button type="button" variant="ghost" size="icon" aria-label={`Replace ${label}`} onClick={() => input.current?.click()}>
                  <RefreshCw />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label}`}
                  className="hover:text-destructive"
                  onClick={() => (showing === 'picked' ? onPick(null) : onRemove())}
                >
                  <X />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
