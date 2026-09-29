import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12" aria-busy="true" aria-label="Loading your listings">
      <Skeleton className="h-9 w-48" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
      </div>
    </section>
  );
}
