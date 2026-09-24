import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder shaped like <Page><PageHeader/><PageBody/></Page>, so a
 * page does not jump when its data arrives. `layout="split"` mirrors the
 * dashboard's 8/4 grid; the default is a panel grid.
 */
export function PageSkeleton({
  cards = 6,
  layout = "grid",
}: {
  cards?: number;
  layout?: "grid" | "split" | "list";
}) {
  return (
    <div className="flex flex-col max-w-[1600px] mx-auto w-full pb-16 skeleton-delayed">
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40 space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-8 w-72 rounded-full" />
      </div>

      <div className="px-4 md:px-8 pt-8">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          </div>
        ) : layout === "list" ? (
          <div className="space-y-3">
            {Array.from({ length: cards }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: cards }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
