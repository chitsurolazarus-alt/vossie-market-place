import { LoadingShell, TileGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <LoadingShell label="Loading listings">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-4 h-11 w-full max-w-xl" />
      <div className="mt-4 flex gap-2 overflow-hidden">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />)}</div>
      <div className="mt-5"><TileGridSkeleton count={8} /></div>
    </LoadingShell>
  );
}
