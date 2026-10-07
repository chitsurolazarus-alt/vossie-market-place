import type { ReactNode } from "react";
import { Skeleton } from "./ui";

/** Wrapper for route-level loading screens: announces busy state, fades in only if loading takes >150ms. */
export function LoadingShell({ label, width = "max-w-6xl", children }: { label: string; width?: string; children: ReactNode }) {
  return (
    <section className={`loading-delay mx-auto ${width} px-4 py-8`} aria-busy="true" aria-label={label}>
      {children}
    </section>
  );
}

export function TileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RowListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
        </li>
      ))}
    </ul>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}
