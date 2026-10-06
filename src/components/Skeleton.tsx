// Grey pulsing placeholders shown while data loads. Use these instead of
// "Loading..." text.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-surface-border ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-surface-border bg-surface p-5"
    >
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-muted px-6 py-12" aria-busy="true">
      <div className="mx-auto w-full max-w-md space-y-4">
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton className="mx-auto h-6 w-3/4" />
        <Skeleton className="mx-auto h-4 w-1/2" />
        <CardSkeleton />
        <CardSkeleton />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </main>
  );
}