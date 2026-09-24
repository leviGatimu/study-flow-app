import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the hub's layout - header, four tiles, agenda beside related links - so nothing jumps on load. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8" aria-busy="true" aria-label="Loading plan">
      <div className="space-y-2 pb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-[480px] rounded-2xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
