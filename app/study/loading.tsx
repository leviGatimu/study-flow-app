import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the hub's layout - header, tool tiles, subject links - in the same frame as the other hubs. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8 skeleton-delayed" aria-busy="true" aria-label="Loading study">
      <div className="space-y-2 pb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="mb-3 h-5 w-20" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mb-3 mt-8 h-5 w-44" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
