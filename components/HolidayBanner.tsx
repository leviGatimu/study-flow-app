import Link from "next/link";
import { PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Holiday } from "@/lib/holidays";

/**
 * Today is a public holiday: say so, so an empty day reads as a day off and
 * not as a routine that broke. Styled like TermStatusBanner, its neighbour.
 */
export function HolidayBanner({ holiday }: { holiday: Holiday | null }) {
  if (!holiday) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-primary sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <PartyPopper className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-heading text-base font-semibold text-foreground">
            {holiday.name} - your routine is off today
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            No study blocks today, and a day away from the app will not break your streak.
            Rest - or do a light review if you feel like it.
            {holiday.approximate && " (The exact day depends on the moon sighting.)"}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="shrink-0">
        <Link href="/ai">Light review</Link>
      </Button>
    </div>
  );
}
