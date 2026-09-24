import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors ProgressHub's layout so the page does not jump when data lands. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 skeleton-delayed">
      <div className="space-y-2 pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-8">
        <Skeleton className="h-[104px] rounded-2xl lg:h-[82px]" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[82px] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
