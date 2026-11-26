/** Shown inside the mentor frame while a page loads. */
export default function MentorLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7" aria-busy="true" aria-label="Loading">
      <div className="h-36 animate-pulse rounded-2xl bg-muted/70" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="h-80 animate-pulse rounded-2xl bg-muted/60 xl:col-span-8" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted/60 xl:col-span-4" />
      </div>
    </div>
  );
}
