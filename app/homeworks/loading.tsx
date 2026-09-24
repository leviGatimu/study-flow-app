import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the page: header, summary strip, subject chips, one grouped list. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 skeleton-delayed">
      <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-[86px] rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
