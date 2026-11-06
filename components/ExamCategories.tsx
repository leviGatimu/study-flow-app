'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { setExamCategory } from '@/lib/exam-actions';
import { inCategory, normaliseCategory, CATEGORY_MAX_LENGTH } from '@/lib/exam-category';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type PickableExam = {
  id: string;
  title: string;
  subject: string | null;
  date: string;
  category: string | null;
};

/** Name a sitting ("Midterm 1") and tick every exam that belongs to it. */
export function CategoryDialog({
  initialName,
  exams,
  names,
  onClose,
}: {
  initialName: string | null;
  exams: PickableExam[];
  names: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName ?? '');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const original = useMemo(
    () => (initialName ? exams.filter((e) => inCategory(e, initialName)).map((e) => e.id) : []),
    [exams, initialName]
  );
  const [picked, setPicked] = useState<Set<string>>(() => new Set(original));

  // Newest first: the sitting being grouped is usually the latest one.
  const sorted = useMemo(() => [...exams].sort((a, b) => b.date.localeCompare(a.date)), [exams]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) => [e.title, e.subject ?? '', e.category ?? ''].join(' ').toLowerCase().includes(q));
  }, [sorted, filter]);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = normaliseCategory(name);
    if (!clean) return setError('Give the category a name, like Midterm 1.');
    if (picked.size === 0) return setError('Tick at least one exam.');
    setError(null);
    const removed = original.filter((id) => !picked.has(id));
    startTransition(async () => {
      try {
        const result = await setExamCategory([...picked], clean);
        if (result.error) return setError(result.error);
        if (removed.length) {
          const cleared = await setExamCategory(removed, null);
          if (cleared.error) return setError(cleared.error);
        }
        toast.success(`${clean}: ${picked.size} ${picked.size === 1 ? 'exam' : 'exams'}.`);
        onClose();
        router.refresh();
      } catch {
        setError('Could not save the category. Please try again.');
      }
    });
  };

  const removeAll = () => {
    if (!original.length) return;
    startTransition(async () => {
      try {
        const result = await setExamCategory(original, null);
        if (result.error) return setError(result.error);
        toast.success(`${initialName} removed. The exams are kept.`);
        onClose();
        router.refresh();
      } catch {
        setError('Could not remove the category. Please try again.');
      }
    });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            {initialName ? `Edit ${initialName}` : 'New category'}
          </DialogTitle>
          <DialogDescription>Name the sitting, then tick every exam that belongs to it.</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              list="exam-category-names"
              value={name}
              maxLength={CATEGORY_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midterm 1"
              autoFocus
              className="h-10"
            />
            <datalist id="exam-category-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="category-filter">Exams</Label>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">{picked.size} ticked</span>
            </div>
            {exams.length > 6 && (
              <Input
                id="category-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title or subject"
                className="h-9"
              />
            )}
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1.5">
              {visible.map((e) => {
                const checked = picked.has(e.id);
                const elsewhere = e.category && !inCategory(e, name) && !original.includes(e.id) ? e.category : null;
                return (
                  <li key={e.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted/60',
                        checked && 'bg-primary/5'
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={(v) => toggle(e.id, v === true)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[e.subject, format(new Date(e.date), 'd MMM yyyy')].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {elsewhere && (
                        <span className="shrink-0 text-xs text-muted-foreground" title="Ticking moves it to this category">
                          In {elsewhere}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && <li className="px-2.5 py-3 text-sm text-muted-foreground">No exams match.</li>}
            </ul>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            {initialName && (
              <Button type="button" variant="ghost" onClick={removeAll} disabled={pending} className="text-destructive hover:text-destructive sm:mr-auto">
                Remove category
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className={cn(!initialName && 'sm:ml-auto')}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Saving' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
