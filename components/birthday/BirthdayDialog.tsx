'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cake } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { birthdayLabel, formatBirthday, MONTH_NAMES, parseBirthday } from '@/lib/birthday';
import { setBirthday } from '@/lib/profile-actions';
import { cn } from '@/lib/utils';

const selectClass =
  'h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

/**
 * "Your birthday": a button that opens a small picker (month, day, optional
 * year). Used on the Month calendar and in Profile. Read-only screens (an
 * archive, a mentor) simply do not render it.
 */
export function BirthdayDialog({
  birthday,
  variant = 'outline',
  className,
}: {
  birthday: string | null | undefined;
  variant?: 'outline' | 'ghost' | 'default';
  className?: string;
}) {
  const router = useRouter();
  const current = parseBirthday(birthday);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(current?.month ?? 1);
  const [day, setDay] = useState(current?.day ?? 1);
  const [year, setYear] = useState(current?.year ? String(current.year) : '');
  const [pending, start] = useTransition();

  const save = (value: string | null) =>
    start(async () => {
      const res = await setBirthday(value);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      toast.success(value ? 'Birthday saved. Study Flow will celebrate with you.' : 'Birthday removed.');
      setOpen(false);
      router.refresh();
    });

  const submit = () => {
    const y = year.trim() ? Number(year.trim()) : null;
    if (year.trim() && (!Number.isInteger(y) || (y ?? 0) < 1900 || (y ?? 0) > new Date().getFullYear())) {
      toast.error('Enter the year as four digits, or leave it empty.');
      return;
    }
    const built = formatBirthday(month, day, y);
    if ('error' in built) {
      toast.error(built.error);
      return;
    }
    save(built.value);
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={cn('gap-2', className)}>
        <Cake className="text-pink-500" />
        {current ? `Birthday · ${current.day} ${MONTH_NAMES[current.month - 1].slice(0, 3)}` : 'Add your birthday'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 to-violet-500 text-white shadow-lg">
              <Cake className="size-7" />
            </span>
            <DialogTitle className="font-heading text-xl font-bold">Your birthday</DialogTitle>
            <DialogDescription>
              On the day, Study Flow dresses up for you. The year is optional; it only says which birthday it is.
            </DialogDescription>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_5rem] gap-3">
            <label className="space-y-1.5 text-sm font-medium">
              Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Day
              <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={selectClass}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            Year <span className="font-normal text-muted-foreground">(optional)</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 2007"
              className={selectClass}
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {current ? (
              <Button variant="ghost" disabled={pending} onClick={() => save(null)} className="text-muted-foreground">
                Remove
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={pending} className="bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:opacity-90">
                Save
              </Button>
            </div>
          </div>
          {current && <p className="text-center text-xs text-muted-foreground">Saved as {birthdayLabel(current)}.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
