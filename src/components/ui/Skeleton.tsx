import type { HTMLAttributes } from "react";

// Base shimmer block. Compose the shapes below from this rather than
// hand-rolling `animate-pulse bg-gray-200` everywhere.
export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg bg-surface-border ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-4 w-full ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}