import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="flex flex-col skeleton-delayed">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 md:px-8 pt-10 pb-6 border-b border-border/40 shrink-0 mb-8">
        <div className="max-w-[1600px] mx-auto space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>

      <div className="px-4 md:px-8 pb-16">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-[28px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
