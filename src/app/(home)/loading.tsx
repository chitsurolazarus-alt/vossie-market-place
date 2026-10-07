import { LoadingShell, TileGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <LoadingShell label="Loading HustleHub">
      <Skeleton className="h-56 rounded-2xl sm:h-72" />
      <Skeleton className="mt-8 h-7 w-48" />
      <div className="mt-4"><TileGridSkeleton count={4} /></div>
    </LoadingShell>
  );
}
