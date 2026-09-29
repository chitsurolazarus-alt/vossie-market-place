import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading seller profile">
      <div className="bg-navy"><div className="mx-auto flex max-w-5xl gap-5 px-4 py-8"><Skeleton className="h-28 w-28 bg-white/20" /><div className="flex-1 space-y-3"><Skeleton className="h-8 w-2/3 bg-white/20" /><Skeleton className="h-5 w-1/2 bg-white/20" /></div></div></div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-8 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52" />)}</div>
    </div>
  );
}
