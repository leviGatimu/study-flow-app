import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the dashboard (app/page.tsx) so nothing jumps when it loads. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col max-w-[1600px] mx-auto w-full pb-16 skeleton-delayed">
      <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4 md:px-8 pt-8 pb-6 border-b border-border/40">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-24 w-full sm:w-72 rounded-2xl" />
      </section>

      <div className="px-4 md:px-8 pt-8 space-y-8">
        <Skeleton className="h-72 w-full rounded-3xl" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-9 w-40 rounded-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
