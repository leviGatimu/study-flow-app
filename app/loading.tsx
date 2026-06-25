import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col space-y-12 max-w-[1600px] mx-auto skeleton-delayed pb-16">
      {/* Hero Section */}
      <section className="bg-background/80 backdrop-blur-md flex flex-col xl:flex-row xl:items-center justify-between gap-8 px-4 md:px-8 pt-10 pb-6 border-b border-border/40 mb-2">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-6 flex-wrap">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-14 w-32 rounded-2xl" />
            <Skeleton className="h-14 w-32 rounded-2xl" />
          </div>
          <Skeleton className="h-6 w-72" />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
          <Skeleton className="h-20 w-[280px] rounded-[28px]" />
          <Skeleton className="h-20 w-[220px] rounded-[28px]" />
        </div>
      </section>

      <div className="px-4 md:px-8 space-y-12">
        {/* Live Focus Card */}
        <Skeleton className="h-24 w-full rounded-[28px]" />

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            </div>

            <Skeleton className="h-32 w-full rounded-[28px]" />
            <Skeleton className="h-48 w-full rounded-[32px]" />
            <Skeleton className="h-44 w-full rounded-[32px]" />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-8">
            <Skeleton className="h-40 w-full rounded-[32px]" />
            <Skeleton className="h-40 w-full rounded-[32px]" />
            <Skeleton className="h-40 w-full rounded-[32px]" />
            <Skeleton className="h-56 w-full rounded-[32px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
