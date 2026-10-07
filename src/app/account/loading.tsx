import { LoadingShell, RowListSkeleton, StatRowSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <LoadingShell label="Loading your dashboard" width="max-w-5xl">
      <Skeleton className="mb-5 h-9 w-52" />
      <StatRowSkeleton />
      <div className="mt-6"><RowListSkeleton rows={4} /></div>
    </LoadingShell>
  );
}
