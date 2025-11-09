import { Skeleton } from "@/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[260px] flex-col justify-between bg-sidebar p-8 shadow-xl lg:flex">
        <div className="space-y-8">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <div className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-2xl" />
            </div>
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-3/4 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-12">
        <div className="mb-8 space-y-4">
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-4 w-60 rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Skeleton className="h-[360px] w-full rounded-3xl" />
            <Skeleton className="h-[320px] w-full rounded-3xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[220px] w-full rounded-3xl" />
            <Skeleton className="h-[220px] w-full rounded-3xl" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-[280px] w-full rounded-3xl" />
          <Skeleton className="h-[280px] w-full rounded-3xl" />
        </div>
      </main>
    </div>
  );
}
