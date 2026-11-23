'use client';

import { Cake, PartyPopper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ordinal } from '@/lib/birthday';
import { celebrate, useBirthdayToday } from './BirthdayMode';

/** The Today page's birthday card: only on the day, and only for the student. */
export function BirthdayCard({ birthday, timezone, name }: { birthday: string | null | undefined; timezone: string; name: string }) {
  const { isToday, age } = useBirthdayToday(birthday, timezone);
  if (!isToday) return null;

  return (
    <div className="birthday-card relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl md:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="live-card-glow absolute -right-20 -top-24 size-80 rounded-full bg-white/25 blur-[80px]" />
        <Cake strokeWidth={1.2} className="live-card-float absolute -bottom-8 right-10 size-48 text-white/15 max-md:hidden" />
      </div>
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/20 shadow-lg ring-2 ring-white/40 backdrop-blur-md">
            <Cake className="size-8" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">It&apos;s your day</p>
            <h2 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
              Happy {age ? `${ordinal(age)} ` : ''}birthday, {name}!
            </h2>
            <p className="mt-1 max-w-xl text-sm font-medium text-white/85">
              Study Flow is dressed up for you all day. Go easy on yourself today and enjoy it.
            </p>
          </div>
        </div>
        <Button onClick={celebrate} className="h-12 shrink-0 gap-2 rounded-xl bg-white px-6 font-black text-pink-600 hover:bg-white/90">
          <PartyPopper /> Celebrate again
        </Button>
      </div>
    </div>
  );
}
