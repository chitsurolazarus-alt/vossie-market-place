import { LoadingShell, RowListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <LoadingShell label="Loading messages" width="max-w-3xl">
      <Skeleton className="mb-5 h-9 w-40" />
      <RowListSkeleton rows={6} />
    </LoadingShell>
  );
}
